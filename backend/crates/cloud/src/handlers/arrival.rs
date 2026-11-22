// ==============================================================================
// FILE: crates/cloud/src/handlers/arrival.rs
// ==============================================================================
// Arrival messages: content per event/class with scheduled release, a venue QR
// (/w/<event>) that only shows the message to guests who have arrived, and an
// SMS sent right after check-in for feature-phone guests.
// ==============================================================================
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ArrivalMessage {
    pub id: Uuid,
    pub event_id: Uuid,
    pub guest_category: Option<String>,
    pub title: String,
    pub body: String,
    pub media_url: Option<String>,
    pub media_type: Option<String>,
    pub contribution_block: Option<String>,
    pub release_at: Option<chrono::DateTime<Utc>>,
    pub is_active: bool,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateArrivalMessageRequest {
    pub guest_category: Option<String>,
    pub title: String,
    pub body: String,
    pub media_url: Option<String>,
    pub media_type: Option<String>,
    pub contribution_block: Option<String>,
    pub release_at: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct VenueMessageRequest {
    pub code: String,
}

async fn assert_event_ownership(
    state: &Arc<AppState>,
    event_id: Uuid,
    org_id: Uuid,
) -> AppResult<()> {
    let event = crate::repository::event_repository::EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

/// GET /api/v1/events/{eid}/arrival-messages
pub async fn list_messages(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let rows = sqlx::query_as::<_, ArrivalMessage>(
        "SELECT * FROM arrival_messages WHERE event_id = $1 ORDER BY release_at NULLS FIRST, created_at DESC",
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": rows })))
}

/// POST /api/v1/events/{eid}/arrival-messages
pub async fn create_message(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<CreateArrivalMessageRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    if payload.title.trim().is_empty() || payload.body.trim().is_empty() {
        return Err(AppError::BadRequest("Title and body are required".to_string()));
    }
    let release_at = payload
        .release_at
        .as_ref()
        .map(|s| s.parse::<chrono::DateTime<Utc>>())
        .transpose()
        .map_err(|_| AppError::BadRequest("Invalid release_at".to_string()))?;
    let id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO arrival_messages (id, event_id, guest_category, title, body, media_url, media_type, contribution_block, release_at, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        "#,
    )
    .bind(id)
    .bind(event_id)
    .bind(&payload.guest_category)
    .bind(&payload.title)
    .bind(&payload.body)
    .bind(&payload.media_url)
    .bind(&payload.media_type)
    .bind(&payload.contribution_block)
    .bind(release_at)
    .bind(payload.is_active.unwrap_or(true))
    .execute(state.db.pool())
    .await?;
    Ok((StatusCode::CREATED, Json(json!({ "success": true, "data": { "id": id } }))))
}

/// DELETE /api/v1/events/{eid}/arrival-messages/{id}
pub async fn delete_message(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    sqlx::query("DELETE FROM arrival_messages WHERE id = $1 AND event_id = $2")
        .bind(id)
        .bind(event_id)
        .execute(state.db.pool())
        .await?;
    Ok(Json(json!({ "success": true })))
}

/// GET /api/v1/public/w/{event_id} — venue QR landing info (no message yet).
pub async fn venue_info(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let row = sqlx::query(
        "SELECT title, venue_name, event_date FROM events WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::EventNotFound)?;
    Ok(Json(json!({
        "success": true,
        "data": {
            "event_id": event_id,
            "title": row.try_get::<String, _>("title")?,
            "venue": row.try_get::<Option<String>, _>("venue_name").ok().flatten(),
            "event_date": row.try_get::<chrono::NaiveDate, _>("event_date")?.to_string(),
        }
    })))
}

/// POST /api/v1/public/w/{event_id}/view — reveal the message only if the guest
/// identified by their check-in code (or phone) has actually arrived.
pub async fn venue_message(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<VenueMessageRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let code = payload.code.trim();
    if code.is_empty() {
        return Err(AppError::BadRequest("Enter your check-in code".to_string()));
    }

    // Resolve guest by short-link / scan payload / phone, and require arrival.
    let guest = sqlx::query(
        r#"
        SELECT DISTINCT g.id, g.full_name, g.guest_category
        FROM guests g
        LEFT JOIN invitations i ON i.guest_id = g.id
        WHERE g.event_id = $1 AND (i.short_link = $2 OR g.phone = $2)
        LIMIT 1
        "#,
    )
    .bind(event_id)
    .bind(code)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::GuestNotFound)?;
    let guest_id: Uuid = guest.try_get("id")?;

    let arrived: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM entry_scans WHERE event_id = $1 AND guest_id = $2)",
    )
    .bind(event_id)
    .bind(guest_id)
    .fetch_one(state.db.pool())
    .await?;
    if !arrived {
        return Err(AppError::Forbidden);
    }

    let category: Option<String> = guest.try_get("guest_category").ok();
    let now = Utc::now();
    let messages = sqlx::query_as::<_, ArrivalMessage>(
        r#"
        SELECT * FROM arrival_messages
        WHERE event_id = $1 AND is_active = TRUE
          AND (guest_category IS NULL OR guest_category = $2)
          AND (release_at IS NULL OR release_at <= $3)
        ORDER BY (guest_category = $2) DESC, created_at DESC
        "#,
    )
    .bind(event_id)
    .bind(&category)
    .bind(now)
    .fetch_all(state.db.pool())
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "guest_name": guest.try_get::<String, _>("full_name")?,
            "messages": messages,
        }
    })))
}

/// Send the arrival message by SMS right after check-in (feature phones).
pub async fn send_arrival_sms(
    state: &Arc<AppState>,
    event_id: Uuid,
    guest_id: Uuid,
) {
    let guest = sqlx::query(
        "SELECT full_name, phone, device_type, guest_category FROM guests WHERE id = $1 AND event_id = $2",
    )
    .bind(guest_id)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await
    .ok()
    .flatten();
    let Some(guest) = guest else { return };
    let device: String = guest.try_get("device_type").unwrap_or_default();
    if device != "feature_phone" {
        return;
    }
    let category: Option<String> = guest.try_get("guest_category").ok();
    let message = sqlx::query_as::<_, ArrivalMessage>(
        r#"
        SELECT * FROM arrival_messages
        WHERE event_id = $1 AND is_active = TRUE
          AND (guest_category IS NULL OR guest_category = $2)
          AND (release_at IS NULL OR release_at <= NOW())
        ORDER BY (guest_category = $2) DESC, created_at DESC LIMIT 1
        "#,
    )
    .bind(event_id)
    .bind(&category)
    .fetch_optional(state.db.pool())
    .await
    .ok()
    .flatten();
    let Some(message) = message else { return };

    // Keep it to one SMS unit where possible.
    let mut text = format!("Karibu {}! {}", guest.try_get::<String, _>("full_name").unwrap_or_default(), message.body);
    if let Some(contribution) = &message.contribution_block {
        text.push(' ');
        text.push_str(contribution);
    }
    if text.chars().count() > 160 {
        text = text.chars().take(157).collect::<String>() + "...";
    }
    let phone: String = guest.try_get("phone").unwrap_or_default();
    if let Err(e) = state.channels.sms_checked(&[phone], &text).await {
        tracing::warn!(error = %e, "Arrival SMS was not delivered");
    }
}
