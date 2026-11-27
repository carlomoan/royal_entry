// ==============================================================================
// FILE: src/handlers/broadcast.rs
// ==============================================================================
use std::sync::Arc;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use serde_json::json;
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    models::{event::Event, user::Claims},
    repository::event_repository::EventRepository,
    services::MessagingService,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct SendBroadcastRequest {
    pub campaign_name: Option<String>,
    pub message: String,
    pub channel: Option<String>,
    pub target: Option<String>,
    pub guest_category: Option<String>,
    pub guest_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampaignResponse {
    pub id: Uuid,
    pub campaign_name: Option<String>,
    pub message_channel: String,
    pub target_audience: String,
    pub status: String,
    pub total_recipients: Option<i32>,
    pub successfully_sent: i32,
    pub failed_count: i32,
    pub sent_at: Option<chrono::DateTime<Utc>>,
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BroadcastDeliveryResponse {
    pub id: Uuid,
    pub campaign_id: Uuid,
    pub guest_id: Uuid,
    pub guest_name: String,
    pub guest_phone: String,
    pub channel: String,
    pub status: String,
    pub provider_message_id: Option<String>,
    pub error_message: Option<String>,
    pub delivered_at: chrono::DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
struct RecipientRow {
    guest_id: Uuid,
    phone: String,
    email: Option<String>,
}

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

async fn fetch_recipients(
    state: &Arc<AppState>,
    event_id: Uuid,
    target: &str,
    guest_category: Option<&str>,
    guest_ids: Option<&[Uuid]>,
) -> AppResult<Vec<RecipientRow>> {
    let category = guest_category.map(|s| s.to_string());
    let rows = match target {
        "vip" => {
            sqlx::query_as::<_, RecipientRow>(
                r#"SELECT g.id AS guest_id, g.phone, g.email FROM guests g WHERE g.event_id = $1 AND UPPER(COALESCE(g.guest_category, '')) = 'VIP' AND ($2::text IS NULL OR g.guest_category = $2) ORDER BY g.full_name ASC"#,
            ).bind(event_id).bind(category).fetch_all(state.db.pool()).await?
        }
        "confirmed" => {
            sqlx::query_as::<_, RecipientRow>(
                r#"SELECT g.id AS guest_id, g.phone, g.email FROM guests g JOIN rsvp_responses r ON r.guest_id = g.id AND r.event_id = g.event_id WHERE g.event_id = $1 AND r.response = 'confirmed' AND ($2::text IS NULL OR g.guest_category = $2) ORDER BY g.full_name ASC"#,
            ).bind(event_id).bind(category).fetch_all(state.db.pool()).await?
        }
        "declined" => {
            sqlx::query_as::<_, RecipientRow>(
                r#"SELECT g.id AS guest_id, g.phone, g.email FROM guests g JOIN rsvp_responses r ON r.guest_id = g.id AND r.event_id = g.event_id WHERE g.event_id = $1 AND r.response = 'declined' AND ($2::text IS NULL OR g.guest_category = $2) ORDER BY g.full_name ASC"#,
            ).bind(event_id).bind(category).fetch_all(state.db.pool()).await?
        }
        "not_rsvp" => {
            sqlx::query_as::<_, RecipientRow>(
                r#"SELECT g.id AS guest_id, g.phone, g.email FROM guests g LEFT JOIN rsvp_responses r ON r.guest_id = g.id AND r.event_id = g.event_id WHERE g.event_id = $1 AND (r.guest_id IS NULL OR r.response = 'pending') AND ($2::text IS NULL OR g.guest_category = $2) ORDER BY g.full_name ASC"#,
            ).bind(event_id).bind(category).fetch_all(state.db.pool()).await?
        }
        "paid" | "partial" | "unpaid" => {
            sqlx::query_as::<_, RecipientRow>(
                r#"SELECT g.id AS guest_id, g.phone, g.email FROM guests g JOIN pledge_tracker p ON p.guest_id = g.id AND p.event_id = g.event_id WHERE g.event_id = $1 AND CASE WHEN $2 = 'paid' THEN p.amount_paid >= p.pledged_amount WHEN $2 = 'partial' THEN p.amount_paid > 0 AND p.amount_paid < p.pledged_amount ELSE p.amount_paid = 0 END AND ($3::text IS NULL OR g.guest_category = $3) ORDER BY g.full_name ASC"#,
            ).bind(event_id).bind(target).bind(category).fetch_all(state.db.pool()).await?
        }
        "special" => {
            sqlx::query_as::<_, RecipientRow>(
                r#"SELECT g.id AS guest_id, g.phone, g.email FROM guests g WHERE g.event_id = $1 AND UPPER(COALESCE(g.guest_category, '')) IN ('SPECIAL GUEST', 'STAFF', 'SERVICE PROVIDER') AND ($2::text IS NULL OR g.guest_category = $2) ORDER BY g.full_name ASC"#,
            ).bind(event_id).bind(category).fetch_all(state.db.pool()).await?
        }
        _ => {
            sqlx::query_as::<_, RecipientRow>(
                r#"SELECT g.id AS guest_id, g.phone, g.email FROM guests g WHERE g.event_id = $1 AND ($2::text IS NULL OR g.guest_category = $2) ORDER BY g.full_name ASC"#,
            ).bind(event_id).bind(category).fetch_all(state.db.pool()).await?
        }
    };
    if let Some(ids) = guest_ids.filter(|ids| !ids.is_empty()) {
        return Ok(rows.into_iter().filter(|row| ids.contains(&row.guest_id)).collect());
    }
    Ok(rows)
}

pub async fn list_broadcasts(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let campaigns = sqlx::query_as::<_, CampaignResponse>(
        r#"SELECT id, campaign_name, message_channel, target_audience, status, total_recipients, successfully_sent, failed_count, sent_at, created_at FROM broadcast_campaigns WHERE event_id = $1 ORDER BY created_at DESC"#,
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;

    Ok(Json(json!({ "success": true, "data": campaigns })))
}

pub async fn list_broadcast_deliveries(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, campaign_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let campaign_exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM broadcast_campaigns WHERE id = $1 AND event_id = $2",
    )
    .bind(campaign_id)
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;

    if campaign_exists == 0 {
        return Err(AppError::NotFound("Broadcast campaign not found".to_string()));
    }

    let deliveries = sqlx::query_as::<_, BroadcastDeliveryResponse>(
        r#"SELECT bd.id, bd.campaign_id, bd.guest_id, g.full_name AS guest_name, g.phone AS guest_phone, bd.channel, bd.status, bd.provider_message_id, bd.error_message, bd.delivered_at FROM broadcast_deliveries bd JOIN guests g ON g.id = bd.guest_id WHERE bd.campaign_id = $1 ORDER BY bd.delivered_at DESC, g.full_name ASC"#,
    )
    .bind(campaign_id)
    .fetch_all(state.db.pool())
    .await?;

    Ok(Json(json!({ "success": true, "data": deliveries })))
}

pub async fn send_broadcast(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<SendBroadcastRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;

    let message = payload.message.trim().to_string();
    if message.is_empty() {
        return Err(AppError::ValidationError("Message is required".to_string()));
    }

    let channel = payload.channel.unwrap_or_else(|| "whatsapp".to_string());
    let target = payload.target.unwrap_or_else(|| "all".to_string());
    let campaign_name = payload.campaign_name.clone();
    let guest_category = payload.guest_category.clone();

    let recipients = fetch_recipients(&state, event_id, &target, guest_category.as_deref(), payload.guest_ids.as_deref()).await?;

    if recipients.is_empty() {
        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "data": { "sent": 0, "failed": 0, "campaign_id": null, "message": "No recipients matched the target audience" }
            })),
        ));
    }

    let now = Utc::now();
    let campaign_id = Uuid::new_v4();
    let total_recipients = recipients.len() as i32;

    sqlx::query(
        r#"INSERT INTO broadcast_campaigns (id, org_id, event_id, campaign_name, message, message_channel, target_audience, guest_category, status, total_recipients, successfully_sent, failed_count, sent_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processing', $9, 0, 0, $10, $10)"#,
    )
    .bind(campaign_id)
    .bind(org_id)
    .bind(event_id)
    .bind(campaign_name)
    .bind(&message)
    .bind(&channel)
    .bind(&target)
    .bind(guest_category)
    .bind(total_recipients)
    .bind(now)
    .execute(state.db.pool())
    .await?;

    let messaging = MessagingService::with_channels(state.channels.clone());
    let mut sent = 0_i32;
    let mut failed = 0_i32;

    // Build one personalised message per recipient first, then send SMS in a
    // single provider batch (NextSMS v2 multi) instead of one request per guest.
    let mut prepared: Vec<(Uuid, String, String)> = Vec::with_capacity(recipients.len());
    for recipient in &recipients {
        let destination = if channel == "email" {
            match recipient.email.as_deref().filter(|e| !e.trim().is_empty()) {
                Some(e) => e.to_string(),
                None => { failed += 1; continue; }
            }
        } else {
            recipient.phone.clone()
        };
        let vars = broadcast_vars(&state, &event, recipient.guest_id).await?;
        let personalized = render_placeholders(&message, &vars);
        prepared.push((recipient.guest_id, destination, personalized));
    }

    let batch_id = Uuid::new_v4();
    let mut receipts_by_guest: Vec<(Uuid, Vec<crate::services::messaging::DeliveryAttempt>)> = Vec::new();
    if channel == "sms" {
        let payloads: Vec<(String, String)> = prepared.iter().map(|(_, to, text)| (to.clone(), text.clone())).collect();
        let receipts = state.channels.sms_multi(&payloads).await?;
        for ((guest_id, _, _), receipt) in prepared.iter().zip(receipts.into_iter()) {
            receipts_by_guest.push((*guest_id, vec![crate::services::messaging::DeliveryAttempt {
                channel: "sms".to_string(), success: receipt.success,
                provider_message_id: receipt.provider_id, error_message: receipt.error,
            }]));
        }
    } else {
        for (guest_id, destination, text) in &prepared {
            let attempts = messaging.send(&channel, destination, text).await?;
            receipts_by_guest.push((*guest_id, attempts));
        }
    }

    for (guest_id, attempts) in receipts_by_guest {
        let recipient_success = attempts.iter().any(|attempt| attempt.success);
        if recipient_success { sent += 1; } else { failed += 1; }
        for attempt in attempts {
            sqlx::query(
                r#"INSERT INTO broadcast_deliveries (id, campaign_id, guest_id, channel, status, provider_message_id, error_message, delivered_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())"#,
            )
            .bind(Uuid::new_v4()).bind(campaign_id).bind(guest_id)
            .bind(&attempt.channel)
            .bind(if attempt.success { "sent" } else { "failed" })
            .bind(attempt.provider_message_id).bind(attempt.error_message)
            .execute(state.db.pool()).await?;
        }
    }
    let _ = batch_id;

    let status = if failed == 0 { "sent" } else if sent > 0 { "partial" } else { "failed" };

    sqlx::query(
        r#"UPDATE broadcast_campaigns SET status = $2, successfully_sent = $3, failed_count = $4, sent_at = NOW() WHERE id = $1"#,
    )
    .bind(campaign_id)
    .bind(status)
    .bind(sent)
    .bind(failed)
    .execute(state.db.pool())
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": { "sent": sent, "failed": failed, "campaign_id": campaign_id }
        })),
    ))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MessageHistoryItem {
    pub id: Uuid,
    pub campaign_id: Uuid,
    pub campaign_name: Option<String>,
    pub guest_id: Uuid,
    pub guest_name: String,
    pub guest_phone: String,
    pub channel: String,
    pub status: String,
    pub provider_message_id: Option<String>,
    pub error_message: Option<String>,
    pub delivered_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, serde::Deserialize)]
pub struct HistoryQuery {
    pub limit: Option<i64>,
    pub channel: Option<String>,
}

/// GET /events/{eid}/message-history — every broadcast delivery across all
/// channels, newest first. Used by the Broadcast page's history table.
pub async fn list_message_history(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Query(query): Query<HistoryQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let limit = query.limit.unwrap_or(200).clamp(1, 500);
    let items = sqlx::query_as::<_, MessageHistoryItem>(
        r#"
        SELECT bd.id, bd.campaign_id, bc.campaign_name, bd.guest_id,
               g.full_name AS guest_name, g.phone AS guest_phone,
               bd.channel, bd.status, bd.provider_message_id, bd.error_message,
               bd.delivered_at
        FROM broadcast_deliveries bd
        JOIN broadcast_campaigns bc ON bc.id = bd.campaign_id
        JOIN guests g ON g.id = bd.guest_id
        WHERE bc.event_id = $1 AND ($2::TEXT IS NULL OR bd.channel = $2)
        ORDER BY bd.delivered_at DESC
        LIMIT $3
        "#,
    )
    .bind(event_id)
    .bind(query.channel.as_deref())
    .bind(limit)
    .fetch_all(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": items })))
}

/// Replace `[variable]` and `{{variable}}` placeholders with per-recipient
/// values. Unknown placeholders are left untouched so the operator can see
/// what was not filled.
fn render_placeholders(template: &str, vars: &std::collections::HashMap<String, String>) -> String {
    let bracket = regex::Regex::new(r"\[([a-zA-Z0-9_]+)\]").unwrap();
    let braces = regex::Regex::new(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}").unwrap();
    let replace = |caps: &regex::Captures| -> String {
        let key = caps.get(1).map(|m| m.as_str().to_ascii_lowercase()).unwrap_or_default();
        vars.get(&key).cloned().unwrap_or_else(|| caps.get(0).unwrap().as_str().to_string())
    };
    let out = bracket.replace_all(template, replace).to_string();
    braces.replace_all(&out, replace).to_string()
}

/// Build the variable map for one guest. The check-in token is the human-
/// friendly code derived from the invitation id — the same one sent in the
/// check-in card and accepted by the gate scanner.
async fn broadcast_vars(
    state: &Arc<AppState>,
    event: &Event,
    guest_id: Uuid,
) -> AppResult<std::collections::HashMap<String, String>> {
    let mut vars = std::collections::HashMap::new();
    let row = sqlx::query(
        r#"SELECT g.full_name, g.phone, g.table_number, g.guest_category,
                  i.short_link, i.id AS invitation_id
           FROM guests g LEFT JOIN invitations i ON i.guest_id = g.id WHERE g.id = $1"#,
    )
    .bind(guest_id)
    .fetch_optional(state.db.pool())
    .await?;
    if let Some(row) = row {
        let name: String = row.try_get("full_name").unwrap_or_default();
        let phone: String = row.try_get("phone").unwrap_or_default();
        let table: String = row.try_get("table_number").unwrap_or_default();
        let category: String = row.try_get("guest_category").unwrap_or_default();
        let short_link: Option<String> = row.try_get("short_link").ok();
        let invitation_id: Option<Uuid> = row.try_get("invitation_id").ok();
        vars.insert("fullname".into(), name.clone());
        vars.insert("full_name".into(), name.clone());
        vars.insert("name".into(), name);
        vars.insert("phone".into(), phone);
        vars.insert("table".into(), table);
        vars.insert("category".into(), category);
        if let Some(link) = short_link {
            let token = invitation_id
                .map(|id| crate::models::invitation::generate_human_friendly_code(&id))
                .unwrap_or_default();
            vars.insert("checkintoken".into(), token.clone());
            vars.insert("entry_code".into(), token.clone());
            vars.insert("token".into(), token);
            vars.insert(
                "checkinlink".into(),
                format!("{}/g/{}", state.config.app.frontend_url.trim_end_matches('/'), link),
            );
            vars.insert(
                "qrurl".into(),
                format!("{}/api/v1/public/invitations/{}/qr", state.config.app.frontend_url.trim_end_matches('/'), link),
            );
        }
    }
    vars.insert("event".into(), event.title.clone());
    vars.insert("eventtitle".into(), event.title.clone());
    vars.insert("date".into(), event.event_date.to_string());
    vars.insert(
        "venue".into(),
        event.venue_name.clone().unwrap_or_default(),
    );
    Ok(vars)
}

/// DELETE /events/{eid}/broadcasts/{id} — remove a campaign and all its
/// delivery rows (e.g. a failed batch the operator wants to discard).
pub async fn delete_broadcast(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, campaign_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM broadcast_campaigns WHERE id = $1 AND event_id = $2",
    )
    .bind(campaign_id).bind(event_id).fetch_one(state.db.pool()).await?;
    if exists == 0 {
        return Err(AppError::NotFound("Broadcast not found".to_string()));
    }
    sqlx::query("DELETE FROM broadcast_deliveries WHERE campaign_id = $1")
        .bind(campaign_id).execute(state.db.pool()).await?;
    sqlx::query("DELETE FROM broadcast_campaigns WHERE id = $1 AND event_id = $2")
        .bind(campaign_id).bind(event_id).execute(state.db.pool()).await?;
    Ok(Json(json!({ "success": true, "message": "Broadcast and its delivery records deleted" })))
}

/// DELETE /events/{eid}/broadcasts/{id}/deliveries — clear delivery rows but
/// keep the campaign in history.
pub async fn delete_broadcast_deliveries(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, campaign_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let result = sqlx::query(
        "DELETE FROM broadcast_deliveries WHERE campaign_id = $1 AND campaign_id IN (SELECT id FROM broadcast_campaigns WHERE event_id = $2)",
    )
    .bind(campaign_id).bind(event_id).execute(state.db.pool()).await?;
    Ok(Json(json!({ "success": true, "data": { "deleted": result.rows_affected() } })))
}
