// ==============================================================================
// FILE: crates/cloud/src/handlers/telegram.rs
// ==============================================================================
// Telegram bot webhook. A bot cannot message a guest first, so each guest opts
// in by pressing the bot's /start link with their invite token:
//
//     https://t.me/<yourbot>?start=<invitation_short_link>
//
// When they press Start, Telegram POSTs an update here; we read the chat_id and
// the /start token, resolve the guest from their invitation, and store the
// chat_id on the guest so broadcasts can reach them later.
// ==============================================================================
use axum::{extract::State, http::{HeaderMap, StatusCode}, Json};
use serde_json::Value;
use std::sync::Arc;
use uuid::Uuid;
use crate::{error::{AppError, AppResult}, AppState};

pub async fn telegram_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(update): Json<Value>,
) -> AppResult<StatusCode> {
    // If a webhook secret is configured, Telegram sends it in
    // X-Telegram-Bot-Api-Secret-Token — reject anything that doesn't match so
    // strangers can't spam /start tokens.
    if let Ok(expected) = std::env::var("TELEGRAM_WEBHOOK_SECRET") {
        if !expected.trim().is_empty() {
            let provided = headers
                .get("x-telegram-bot-api-secret-token")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");
            if provided != expected.trim() {
                return Err(AppError::Forbidden);
            }
        }
    }
    let chat_id = update
        .pointer("/message/chat/id")
        .and_then(Value::as_i64);
    let text = update
        .pointer("/message/text")
        .and_then(Value::as_str)
        .map(|s| s.trim().to_string());

    if let (Some(chat_id), Some(text)) = (chat_id, text) {
        // Expect "/start <invite_token>"
        let token = text.split_whitespace().nth(1).map(|s| s.trim().to_string());
        if let Some(token) = token {
            let guest_id: Option<Uuid> = sqlx::query_scalar(
                "SELECT guest_id FROM invitations WHERE short_link = $1",
            )
            .bind(&token)
            .fetch_optional(state.db.pool())
            .await?;

            if let Some(guest_id) = guest_id {
                sqlx::query(
                    "UPDATE guests SET telegram_chat_id = $1, updated_at = NOW() WHERE id = $2",
                )
                .bind(chat_id.to_string())
                .bind(guest_id)
                .execute(state.db.pool())
                .await?;
                tracing::info!(guest_id = %guest_id, chat_id, "Guest linked Telegram");
            } else {
                tracing::debug!(token = %token, "Telegram /start with unknown invite token");
            }
        }
    }

    Ok(StatusCode::OK)
}

/// Convenience: send a Telegram message to a guest's linked chat_id.
/// Returns Ok(false) when the guest has not linked Telegram.
pub async fn send_guest_telegram(
    state: &Arc<AppState>,
    guest_id: Uuid,
    text: &str,
) -> AppResult<bool> {
    let chat_id: Option<String> = sqlx::query_scalar(
        "SELECT telegram_chat_id FROM guests WHERE id = $1",
    )
    .bind(guest_id)
    .fetch_optional(state.db.pool())
    .await?
    .flatten();

    let Some(chat_id) = chat_id else {
        return Ok(false);
    };

    let receipt = state.channels.telegram(&chat_id, text).await?;
    Ok(receipt.success)
}
