// ==============================================================================
// FILE: src/handlers/broadcast.rs
// ==============================================================================
use std::sync::Arc;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
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
        r#"INSERT INTO broadcast_campaigns (id, event_id, campaign_name, message, message_channel, target_audience, guest_category, status, total_recipients, successfully_sent, failed_count, sent_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing', $8, 0, 0, $9, $9)"#,
    )
    .bind(campaign_id)
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

    let messaging = MessagingService::new();
    let mut sent = 0_i32;
    let mut failed = 0_i32;

    for recipient in recipients {
        let destination = if channel == "email" {
            recipient.email.as_deref().ok_or_else(|| AppError::BadRequest("A selected guest has no email address".to_string()))?
        } else {
            &recipient.phone
        };
        let attempts = messaging.send(&channel, destination, &message).await?;
        let recipient_success = attempts.iter().any(|attempt| attempt.success);
        if recipient_success { sent += 1; } else { failed += 1; }

        for attempt in attempts {
            sqlx::query(
                r#"INSERT INTO broadcast_deliveries (id, campaign_id, guest_id, channel, status, provider_message_id, error_message, delivered_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())"#,
            )
            .bind(Uuid::new_v4())
            .bind(campaign_id)
            .bind(recipient.guest_id)
            .bind(&attempt.channel)
            .bind(if attempt.success { "sent" } else { "failed" })
            .bind(attempt.provider_message_id)
            .bind(attempt.error_message)
            .execute(state.db.pool())
            .await?;
        }
    }

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
