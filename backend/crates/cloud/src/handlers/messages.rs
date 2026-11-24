// ==============================================================================
// FILE: crates/cloud/src/handlers/messages.rs
// ==============================================================================
// Inspection of outbound message previews recorded in sandbox mode. This is
// what lets a client verify that the QR link and entry token reached SMS,
// WhatsApp and email before live provider credentials are configured.
// ==============================================================================
use axum::{extract::{Path, Query, State}, Extension, Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    repository::event_repository::EventRepository,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct MessageQuery {
    pub channel: Option<String>,
    pub limit: Option<i64>,
}

/// Never expose a full credential, even in a demo inspection view.
fn mask_secret(value: &str) -> String {
    let chars: Vec<char> = value.chars().collect();
    if chars.len() <= 4 {
        return "****".to_string();
    }
    format!("{}{}{}", chars[0], "*".repeat(chars.len().saturating_sub(4)), chars[chars.len() - 1])
}

/// Mask 6-digit OTP codes that may appear in a message body.
fn mask_codes(body: &str) -> String {
    let mut out = String::with_capacity(body.len());
    let mut digits = String::new();
    for ch in body.chars().chain(std::iter::once('\0')) {
        if ch.is_ascii_digit() {
            digits.push(ch);
            continue;
        }
        if digits.len() == 6 {
            out.push_str("******");
        } else {
            out.push_str(&digits);
        }
        digits.clear();
        if ch != '\0' {
            out.push(ch);
        }
    }
    out
}

#[derive(Debug, Serialize)]
struct MessageLog {
    id: Uuid,
    event_id: Option<Uuid>,
    guest_id: Option<Uuid>,
    channel: String,
    recipient: String,
    subject: Option<String>,
    body: String,
    qr_url: Option<String>,
    token: Option<String>,
    provider_id: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn list_event_messages(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Query(query): Query<MessageQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    // Platform admins inspect across tenants; account users are scoped.
    if !crate::utils::rbac::is_platform_role(&claims.role) && event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }
    // This view exposes credential-bearing previews. Only demo-flagged events
    // may be inspected, and only by platform administrators (route layer).
    if !event.is_demo {
        return Err(AppError::Forbidden);
    }

    let limit = query.limit.unwrap_or(100).clamp(1, 500);
    let rows = sqlx::query(
        r#"
        SELECT m.id, m.event_id, m.guest_id, m.channel, m.recipient, m.subject,
               m.body, m.qr_url, m.token, m.provider_id, m.created_at,
               g.full_name AS guest_name
        FROM sandbox_messages m
        LEFT JOIN guests g ON g.id = m.guest_id
        WHERE m.event_id = $1 AND ($2::TEXT IS NULL OR m.channel = $2)
        ORDER BY m.created_at DESC
        LIMIT $3
        "#,
    )
    .bind(event_id)
    .bind(query.channel.as_deref())
    .bind(limit)
    .fetch_all(state.db.pool())
    .await?;

    let messages = rows
        .into_iter()
        .map(|row| MessageLog {
            id: row.try_get("id").unwrap_or_default(),
            event_id: row.try_get("event_id").ok(),
            guest_id: row.try_get("guest_id").ok(),
            channel: row.try_get("channel").unwrap_or_default(),
            recipient: row.try_get("recipient").unwrap_or_default(),
            subject: row.try_get("subject").ok(),
            body: mask_codes(&row.try_get::<String, _>("body").unwrap_or_default()),
            qr_url: row.try_get("qr_url").ok(),
            token: row.try_get::<Option<String>, _>("token").ok().flatten().map(|t| mask_secret(&t)),
            provider_id: row.try_get("provider_id").ok(),
            created_at: row.try_get("created_at").unwrap_or_else(|_| chrono::Utc::now()),
        })
        .collect::<Vec<_>>();

    Ok(Json(json!({ "success": true, "data": messages })))
}
