// ==============================================================================
// FILE: src/handlers/invitations.rs
// ==============================================================================
use std::sync::Arc;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::Utc;
use serde::Deserialize; // ✅ ADDED: Required for #[derive(Deserialize)]
use serde_json::json;
use sqlx::{PgPool, Row};
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    models::{
        event::Event,
        guest::Guest,
        invitation::{GenerateInvitationsRequest, GenerateInvitationsResult, Invitation, InvitationResponse},
        user::Claims,
    },
    repository::event_repository::EventRepository,
    services::MessagingService,
    AppState,
};

async fn assert_event_ownership(
    state: &Arc<AppState>,
    event_id: Uuid,
    org_id: Uuid,
) -> AppResult<Event> {
    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }
    Ok(event)
}

async fn list_event_guests(pool: &PgPool, event_id: Uuid) -> AppResult<Vec<Guest>> {
    let guests = sqlx::query_as::<_, Guest>(
        "SELECT * FROM guests WHERE event_id = $1 ORDER BY full_name ASC",
    )
    .bind(event_id)
    .fetch_all(pool)
    .await?;
    Ok(guests)
}


#[derive(Debug, Deserialize)]
pub struct SendInvitationsRequest {
    pub guest_ids: Option<Vec<Uuid>>,
    pub channel: Option<String>, // email, sms, whatsapp, telegram
    pub template_id: Option<Uuid>, // Optional card template to attach
    pub custom_message: Option<String>,
}

pub async fn list_invitations(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let invitations = sqlx::query_as::<_, Invitation>(
        r#"SELECT i.* FROM invitations i JOIN guests g ON g.id = i.guest_id WHERE g.event_id = $1 ORDER BY i.created_at DESC"#,
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;

    let frontend_url = state.config.app.frontend_url.clone();
    let data: Vec<InvitationResponse> = invitations
        .into_iter()
        .map(|invitation| InvitationResponse::from_invitation(invitation, &frontend_url, event_id))
        .collect();

    Ok(Json(json!({ "success": true, "data": data })))
}

pub async fn generate_invitations(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<GenerateInvitationsRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let all_guests = list_event_guests(state.db.pool(), event_id).await?;
    let guests: Vec<Guest> = match payload.guest_ids {
        Some(ids) if !ids.is_empty() => all_guests
            .into_iter()
            .filter(|guest| ids.contains(&guest.id))
            .collect(),
        _ => all_guests,
    };
    let overwrite = payload.overwrite.unwrap_or(false);

    if guests.is_empty() {
        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "data": GenerateInvitationsResult { generated: 0, skipped: 0, failed: 0, invitations: Vec::new() }
            })),
        ));
    }

    let mut tx = state.db.pool().begin().await?;
    let now = Utc::now();
    let mut generated = 0_i64;
    let mut skipped = 0_i64;
    let failed = 0_i64;
    let mut results = Vec::new();

    for guest in guests {
        let existing = sqlx::query_as::<_, Invitation>(
            "SELECT * FROM invitations WHERE guest_id = $1",
        )
        .bind(guest.id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(existing) = existing {
            if !overwrite {
                skipped += 1;
                results.push(InvitationResponse::from_invitation(
                    existing,
                    &state.config.app.frontend_url,
                    event_id,
                ));
                continue;
            }
            let short_link = format!("inv-{}", Uuid::new_v4().simple());
            let updated = sqlx::query_as::<_, Invitation>(
                r#"UPDATE invitations SET short_link = $2, status = 'sent', invitation_sent_at = $3, created_at = $3 WHERE guest_id = $1 RETURNING *"#,
            )
            .bind(guest.id)
            .bind(short_link)
            .bind(now)
            .fetch_one(&mut *tx)
            .await?;
            generated += 1;
            results.push(InvitationResponse::from_invitation(
                updated,
                &state.config.app.frontend_url,
                event_id,
            ));
            continue;
        }

        let invitation = sqlx::query_as::<_, Invitation>(
            r#"INSERT INTO invitations (id, guest_id, short_link, status, scan_count, invitation_sent_at, created_at) VALUES ($1, $2, $3, 'sent', 0, $4, $4) RETURNING *"#,
        )
        .bind(Uuid::new_v4())
        .bind(guest.id)
        .bind(format!("inv-{}", Uuid::new_v4().simple()))
        .bind(now)
        .fetch_one(&mut *tx)
        .await?;
        generated += 1;
        results.push(InvitationResponse::from_invitation(
            invitation,
            &state.config.app.frontend_url,
            event_id,
        ));
    }

    tx.commit().await?;
    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": GenerateInvitationsResult { generated, skipped, failed, invitations: results }
        })),
    ))
}

pub async fn send_invitations(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<SendInvitationsRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = assert_event_ownership(&state, event_id, org_id).await?;
    let all_guests = list_event_guests(state.db.pool(), event_id).await?;
    let guests: Vec<Guest> = match payload.guest_ids {
        Some(ids) if !ids.is_empty() => all_guests
            .into_iter()
            .filter(|guest| ids.contains(&guest.id))
            .collect(),
        _ => all_guests,
    };

    if guests.is_empty() {
        return Err(AppError::BadRequest("No guests to invite".to_string()));
    }

    let frontend_url = state.config.app.frontend_url.clone();
    let messaging = MessagingService::new();
    let mut sent = 0_i64;
    let mut failed = 0_i64;
    let mut errors = Vec::new();

    for guest in &guests {
        let invitation = sqlx::query_as::<_, Invitation>(
            "SELECT * FROM invitations WHERE guest_id = $1",
        )
        .bind(guest.id)
        .fetch_optional(state.db.pool())
        .await?;

        let Some(invitation) = invitation else {
            failed += 1;
            errors.push(format!("{}: no invitation link generated", guest.full_name));
            continue;
        };

        let pledge = sqlx::query(
            "SELECT pledged_amount, amount_paid FROM pledge_tracker WHERE event_id = $1 AND guest_id = $2",
        )
        .bind(event_id)
        .bind(guest.id)
        .fetch_optional(state.db.pool())
        .await?;

        let check_in_link = crate::models::invitation::build_scan_url(&frontend_url, event_id, &invitation.short_link);

        // ✅ FIXED: Use .as_str() instead of .as_deref() for String fields
        let device_type = guest.device_type.as_str();
        let channel = payload.channel.as_deref().unwrap_or_else(|| {
            if device_type == "feature_phone" { "sms" } else { guest.contact_method.as_str() }
        });

        let pledge_line = match pledge {
            Some(row) => {
                let pledged: i64 = row.try_get("pledged_amount")?;
                let paid: i64 = row.try_get("amount_paid")?;
                let remaining = (pledged - paid).max(0);
                let status = if paid >= pledged { "paid in full" } else if paid > 0 { "partially paid" } else { "unpaid" };
                format!("Pledge: TZS {} · Status: {} · Remaining: TZS {}", pledged, status, remaining)
            }
            None => "No pledge required".to_string(),
        };

        let message = format!(
            "Dear {name},\n\nYou are cordially invited to {title} on {date} at {venue}.\n{characters}\n{pledge}\n\nYour check-in card: {link}\n\nRoyalEntry",
            name = guest.full_name,
            title = event.title,
            date = event.event_date.format("%B %d, %Y"),
            venue = event.venue_name.as_deref().unwrap_or("the venue"),
            characters = event.main_characters.as_deref().map(|c| format!("Main characters: {}", c)).unwrap_or_default(),
            pledge = pledge_line,
            link = check_in_link,
        );

        let destination = if channel == "email" {
            guest.email.as_deref().ok_or_else(|| {
                AppError::BadRequest(format!("{} has no email address", guest.full_name))
            })?
        } else {
            &guest.phone
        };
        let attempts = messaging.send(channel, destination, &message).await?;
        let ok = attempts.iter().any(|a| a.success);

        if ok {
            sent += 1;
            sqlx::query(
                "UPDATE invitations SET status = 'sent', invitation_sent_at = NOW() WHERE id = $1",
            )
            .bind(invitation.id)
            .execute(state.db.pool())
            .await?;
        } else {
            failed += 1;
            errors.push(format!("{}: delivery failed", guest.full_name));
        }
    }

    sqlx::query("UPDATE events SET invitation_sent_at = NOW(), updated_at = NOW() WHERE id = $1")
        .bind(event_id)
        .execute(state.db.pool())
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": { "sent": sent, "failed": failed, "errors": errors }
    })))
}
