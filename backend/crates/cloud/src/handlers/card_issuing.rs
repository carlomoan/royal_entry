// ==============================================================================
// FILE: crates/cloud/src/handlers/card_issuing.rs
// ==============================================================================
// Per-guest card issuing (removes the all-or-nothing block), family approvals
// for partly-paid guests, and the public invitation page (/i/<token>) which
// shows a QR-free invitation card that is safe to forward.
// ==============================================================================
use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    AppState,
};

/// Shared eligibility check used by card issuing and by the gate scanner so
/// the two paths can never disagree about whether a card is active.
pub async fn is_eligible_for_card(
    pool: &sqlx::PgPool,
    event: &crate::models::event::Event,
    guest_id: Uuid,
) -> AppResult<bool> {
    let (pledged, paid): (i64, i64) = sqlx::query(
        "SELECT COALESCE(pledged_amount, 0), COALESCE(amount_paid, 0) FROM pledge_tracker WHERE event_id = $1 AND guest_id = $2",
    )
    .bind(event.id)
    .bind(guest_id)
    .fetch_optional(pool)
    .await?
    .map(|r| (r.get(0), r.get(1)))
    .unwrap_or((0, 0));

    let approved: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM card_approvals WHERE event_id = $1 AND guest_id = $2 AND withdrawn_at IS NULL)",
    )
    .bind(event.id)
    .bind(guest_id)
    .fetch_one(pool)
    .await?;

    let paid_in_full = pledged == 0 || paid >= pledged;
    let meets_min_percent = pledged > 0 && paid * 100 >= pledged * i64::from(event.min_percent.max(0));
    Ok(match event.checkin_policy.as_str() {
        "full_payment" => paid_in_full,
        "min_percent" => meets_min_percent,
        _ => paid_in_full || approved, // family_approval (default)
    })
}

/// POST /api/v1/events/{eid}/guests/{gid}/issue-card
/// Issue the check-in card for one guest according to the event's policy.
pub async fn issue_card(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, guest_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?;
    let event = crate::repository::event_repository::EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }

    let guest_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM guests WHERE id = $1 AND event_id = $2)",
    )
    .bind(guest_id)
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;
    if !guest_exists {
        return Err(AppError::GuestNotFound);
    }

    if !is_eligible_for_card(state.db.pool(), &event, guest_id).await? {
        return Err(AppError::BadRequest(
            "Card not available yet — the pledge is not complete and no family approval exists".to_string(),
        ));
    }

    sqlx::query(
        "UPDATE guests SET card_issued_at = COALESCE(card_issued_at, NOW()), updated_at = NOW() WHERE id = $1",
    )
    .bind(guest_id)
    .execute(state.db.pool())
    .await?;

    tracing::info!(event_id = %event_id, guest_id = %guest_id, user_id = %user_id, "Check-in card issued");
    Ok(Json(json!({ "success": true, "message": "Check-in card issued" })))
}

/// POST /api/v1/events/{eid}/guests/{gid}/approve-card
/// Family approval for a partly-paid guest; issues the card immediately.
pub async fn approve_card(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, guest_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<ApproveCardRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?;
    let event = crate::repository::event_repository::EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }

    let (pledged, paid): (i64, i64) = sqlx::query(
        "SELECT COALESCE(pledged_amount, 0), COALESCE(amount_paid, 0) FROM pledge_tracker WHERE event_id = $1 AND guest_id = $2",
    )
    .bind(event_id)
    .bind(guest_id)
    .fetch_optional(state.db.pool())
    .await?
    .map(|r| (r.get(0), r.get(1)))
    .unwrap_or((0, 0));
    let balance = (pledged - paid).max(0);

    sqlx::query(
        r#"
        INSERT INTO card_approvals (id, event_id, guest_id, approved_by, approved_at, balance_at_approval, note)
        VALUES ($1, $2, $3, $4, NOW(), $5, $6)
        ON CONFLICT (event_id, guest_id) DO UPDATE SET
            approved_by = EXCLUDED.approved_by,
            approved_at = NOW(),
            balance_at_approval = EXCLUDED.balance_at_approval,
            note = EXCLUDED.note,
            withdrawn_at = NULL
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(guest_id)
    .bind(user_id)
    .bind(balance)
    .bind(&payload.note)
    .execute(state.db.pool())
    .await?;

    sqlx::query(
        "UPDATE guests SET card_issued_at = COALESCE(card_issued_at, NOW()), updated_at = NOW() WHERE id = $1",
    )
    .bind(guest_id)
    .execute(state.db.pool())
    .await?;

    let _ = crate::services::NotificationService::create_org(
        state.db.pool(),
        org_id,
        "card.approved",
        "Card approved",
        Some(&format!("Guest card approved with balance TZS {}", balance)),
        Some(&format!("/events/{event_id}")),
        Some(json!({"event_id": event_id, "guest_id": guest_id, "balance": balance})),
    )
    .await;

    Ok(Json(json!({ "success": true, "balance": balance })))
}

#[derive(Debug, serde::Deserialize)]
pub struct ApproveCardRequest {
    pub note: Option<String>,
}

/// POST /api/v1/events/{eid}/guests/{gid}/withdraw-approval
pub async fn withdraw_approval(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, guest_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = crate::repository::event_repository::EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }
    sqlx::query(
        "UPDATE card_approvals SET withdrawn_at = NOW() WHERE event_id = $1 AND guest_id = $2 AND withdrawn_at IS NULL",
    )
    .bind(event_id)
    .bind(guest_id)
    .execute(state.db.pool())
    .await?;
    sqlx::query(
        "UPDATE guests SET card_issued_at = NULL, updated_at = NOW() WHERE id = $1",
    )
    .bind(guest_id)
    .execute(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "message": "Approval withdrawn" })))
}

/// GET /api/v1/public/invitations/{token}/card — QR-free invitation card data.
pub async fn public_invitation_card(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let row = sqlx::query(
        r#"
        SELECT e.id AS event_id, e.title, e.event_date, e.event_time, e.venue_name,
               e.venue_address, e.parking_instructions, e.payment_instructions,
               e.min_pledge_per_person, e.min_pledge_plus_one, e.card_template_id,
               g.id AS guest_id, g.full_name, g.guest_category, g.party_size,
               i.id AS invitation_id, i.short_link
        FROM invitations i
        JOIN guests g ON g.id = i.guest_id
        JOIN events e ON e.id = g.event_id
        WHERE i.short_link = $1
        "#,
    )
    .bind(&token)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::InvitationNotFound)?;

    let event_id: Uuid = row.try_get("event_id")?;
    let parking_variants: Vec<serde_json::Value> = sqlx::query(
        "SELECT class_name, instructions FROM event_parking_variants WHERE event_id = $1 ORDER BY class_name",
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?
    .into_iter()
    .map(|v| json!({
        "class_name": v.try_get::<String, _>("class_name").unwrap_or_default(),
        "instructions": v.try_get::<String, _>("instructions").unwrap_or_default(),
    }))
    .collect();
    let template_id: Option<Uuid> = row.try_get("card_template_id").ok();
    let mut template: Option<serde_json::Value> = None;
    if let Some(id) = template_id {
        template = sqlx::query_as::<_, crate::cards::model::CardTemplate>(
            "SELECT id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, is_global, created_at, updated_at FROM card_templates WHERE id = $1 AND is_active = TRUE",
        )
        .bind(id)
        .fetch_optional(state.db.pool())
        .await?
        .map(|t| serde_json::to_value(t).unwrap_or(json!({})));
    }

    Ok(Json(json!({
        "success": true,
        "data": {
            "event_id": event_id,
            "title": row.try_get::<String, _>("title")?,
            "event_date": row.try_get::<chrono::NaiveDate, _>("event_date")?.to_string(),
            "event_time": row.try_get::<Option<String>, _>("event_time").ok().flatten(),
            "venue": row.try_get::<Option<String>, _>("venue_name").ok().flatten(),
            "venue_address": row.try_get::<Option<String>, _>("venue_address").ok().flatten(),
            "parking_instructions": row.try_get::<Option<String>, _>("parking_instructions").ok().flatten(),
            "payment_instructions": row.try_get::<Option<String>, _>("payment_instructions").ok().flatten(),
            "min_pledge_per_person": row.try_get::<Option<i64>, _>("min_pledge_per_person").ok().flatten(),
            "min_pledge_plus_one": row.try_get::<Option<i64>, _>("min_pledge_plus_one").ok().flatten(),
            "guest_name": row.try_get::<String, _>("full_name")?,
            "guest_category": row.try_get::<Option<String>, _>("guest_category").ok().flatten(),
            "party_size": row.try_get::<i32, _>("party_size").unwrap_or(1),
            "parking_variants": parking_variants,
            "template": template,
        }
    })))
}

/// Send the actual entry credential (check-in link + token) to a guest whose
/// pass has been issued. This is deliberately separate from invitations: an
/// invitation carries no entry rights.
pub async fn send_checkin_credentials(
    state: &Arc<AppState>,
    event: &crate::models::event::Event,
    guest_id: Uuid,
) -> AppResult<bool> {
    let guest = sqlx::query_as::<_, crate::models::guest::Guest>(
        "SELECT * FROM guests WHERE id = $1",
    )
    .bind(guest_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::GuestNotFound)?;

    let invitation = crate::handlers::invitations::ensure_invitation(state.db.pool(), guest_id).await?;
    let link = format!(
        "{}/g/{}",
        state.config.app.frontend_url.trim_end_matches('/'),
        invitation.short_link
    );
    let token = crate::models::invitation::generate_human_friendly_code(&invitation.id);
    let body = format!(
        "Dear {name},\n\nYour check-in card for {title} is ready.\n\nCheck-in card: {link}\nEntry code: {code}\n\nShow the QR code or quote the entry code at the gate. Do not forward this message.\n\nRoyalEntry",
        name = guest.full_name,
        title = event.title,
        link = link,
        code = token,
    );
    let qr_url = format!(
        "{}/api/v1/public/invitations/{}/qr",
        state.config.app.frontend_url.trim_end_matches('/'),
        invitation.short_link
    );

    // Feature phones cannot open WhatsApp or email: SMS only. Smartphones get
    // WhatsApp first, then email, then SMS as the last resort.
    let vars = json!({
        "guest_name": guest.full_name,
        "event_title": event.title,
        "check_in_link": link,
        "entry_code": token,
        "qr_url": qr_url,
    });
    let sms_body = crate::services::templates::render_sms_template(
        state.db.pool(), event.organization_id, "checkin_card", &vars,
    )
    .await
    .unwrap_or_else(|| format!(
        "{} — your check-in card for {} is ready. Open {} or quote code {}. Do not forward.",
        guest.full_name, event.title, link, token
    ));

    let subject = format!("Your check-in card — {}", event.title);
    let email = guest.email.as_deref().filter(|e| !e.trim().is_empty());
    let phone = guest.phone.trim();
    let feature_phone = guest.device_type == "feature_phone";
    let mut used_channel: Option<&str> = None;
    let mut recipient = String::new();
    let mut delivered = false;

    if !feature_phone && !phone.is_empty() && state.channels.is_whatsapp_ready() {
        let receipt = state.channels.whatsapp_text(phone, &sms_body).await;
        if receipt.as_ref().map(|r| r.success).unwrap_or(false) {
            delivered = true;
            used_channel = Some("whatsapp");
            recipient = phone.to_string();
        } else if let Err(e) = receipt {
            tracing::warn!(guest_id = %guest_id, error = %e, "WhatsApp check-in delivery failed, trying email");
        }
    }

    if !delivered {
        if let Some(to) = email {
            if state.channels.is_email_ready() {
                let html = crate::services::channels::html_wrap(&body.replace('\n', "<br>"));
                if state.channels.email(to, &subject, &html).await
                    .map(|r| r.success).unwrap_or(false)
                {
                    delivered = true;
                    used_channel = Some("email");
                    recipient = to.to_string();
                }
            }
        }
    }

    if !delivered && !phone.is_empty() && state.channels.is_sms_ready() {
        let receipts = state.channels.sms(&[phone.to_string()], &sms_body).await;
        if receipts.as_ref().map(|rs| rs.iter().any(|r| r.success)).unwrap_or(false) {
            delivered = true;
            used_channel = Some("sms");
            recipient = phone.to_string();
        }
    }

    if let Some(channel) = used_channel {
        state.channels.record_preview(
            event.id, guest_id, channel, &recipient, Some(&subject),
            &sms_body, Some(&qr_url), Some(&token), None,
        ).await;
    }

    Ok(delivered)
}

/// POST /events/{eid}/guests/{gid}/send-checkin — issue (if eligible) and send
/// the check-in card/token to one guest via WhatsApp → Email → SMS.
pub async fn send_checkin_to_guest(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, guest_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = crate::repository::event_repository::EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM guests WHERE id = $1 AND event_id = $2)",
    )
    .bind(guest_id)
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;
    if !exists {
        return Err(AppError::GuestNotFound);
    }

    let issued: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT card_issued_at FROM guests WHERE id = $1",
    )
    .bind(guest_id)
    .fetch_one(state.db.pool())
    .await?;
    if issued.is_none() {
        if !is_eligible_for_card(state.db.pool(), &event, guest_id).await? {
            return Err(AppError::BadRequest(
                "Check-in card is not available yet — complete the pledge or ask the family to approve it."
                    .to_string(),
            ));
        }
        sqlx::query("UPDATE guests SET card_issued_at = NOW(), updated_at = NOW() WHERE id = $1")
            .bind(guest_id)
            .execute(state.db.pool())
            .await?;
    }

    let delivered = send_checkin_credentials(&state, &event, guest_id).await?;
    Ok(Json(json!({
        "success": true,
        "data": {
            "guest_id": guest_id,
            "delivered": delivered,
            "message": if delivered { "Check-in details sent" } else { "Card issued, but no channel could deliver it" }
        }
    })))
}

#[derive(Debug, serde::Deserialize)]
pub struct BulkSendCheckinRequest {
    pub guest_ids: Vec<Uuid>,
}

/// POST /events/{eid}/guests/send-checkin — bulk delivery for selected guests.
pub async fn send_checkin_bulk(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<BulkSendCheckinRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = crate::repository::event_repository::EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }
    if payload.guest_ids.is_empty() {
        return Err(AppError::ValidationError("No guests selected".to_string()));
    }

    let mut sent = 0;
    let mut failed = 0;
    let mut errors = Vec::new();
    for guest_id in &payload.guest_ids {
        let eligible: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM guests WHERE id = $1 AND event_id = $2)",
        )
        .bind(guest_id)
        .bind(event_id)
        .fetch_one(state.db.pool())
        .await?;
        if !eligible {
            failed += 1;
            continue;
        }
        let issued: Option<DateTime<Utc>> = sqlx::query_scalar(
            "SELECT card_issued_at FROM guests WHERE id = $1",
        )
        .bind(guest_id)
        .fetch_one(state.db.pool())
        .await?;
        if issued.is_none() {
            if !is_eligible_for_card(state.db.pool(), &event, *guest_id).await? {
                failed += 1;
                errors.push(format!("{}: card not available yet", guest_id));
                continue;
            }
            sqlx::query("UPDATE guests SET card_issued_at = NOW(), updated_at = NOW() WHERE id = $1")
                .bind(guest_id)
                .execute(state.db.pool())
                .await?;
        }
        match send_checkin_credentials(&state, &event, *guest_id).await {
            Ok(true) => sent += 1,
            Ok(false) => {
                failed += 1;
                errors.push(format!("{}: no channel delivered", guest_id));
            }
            Err(e) => {
                failed += 1;
                errors.push(format!("{}: {}", guest_id, e));
            }
        }
    }
    Ok(Json(json!({
        "success": true,
        "data": { "sent": sent, "failed": failed, "errors": errors }
    })))
}
