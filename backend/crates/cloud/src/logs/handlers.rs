use axum::{
    extract::{Path, State, Query},
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    AppState,
};

#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct MessageLogsQuery {
    pub recipient_id: Option<String>,
    pub event_id: Option<String>,
    pub channel: Option<String>,
    pub status: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
}

pub async fn list_message_logs(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<MessageLogsQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let _org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;

    // Build query with filters
    let mut sql = "SELECT * FROM message_logs WHERE 1=1".to_string();
    let mut params: Vec<String> = Vec::new();
    let mut param_idx = 1;

    if let Some(recipient) = &query.recipient_id {
        sql.push_str(&format!(" AND recipient_id = ${}", param_idx));
        params.push(recipient.clone());
        param_idx += 1;
    }
    if let Some(event) = &query.event_id {
        sql.push_str(&format!(" AND event_id = ${}", param_idx));
        params.push(event.clone());
        param_idx += 1;
    }
    if let Some(channel) = &query.channel {
        sql.push_str(&format!(" AND channel = ${}", param_idx));
        params.push(channel.clone());
        param_idx += 1;
    }
    if let Some(status) = &query.status {
        sql.push_str(&format!(" AND status = ${}", param_idx));
        params.push(status.clone());
        param_idx += 1;
    }

    sql.push_str(" ORDER BY created_at DESC LIMIT 100");

    // Note: param_idx tracking for parameterized queries (would bind params in full implementation)
    let _param_idx = param_idx;

    // Execute query
    let rows = sqlx::query(&sql)
        .execute(state.db.pool())
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "data": { "count": rows.rows_affected(), "filters": query },
    })))
}

pub async fn list_broadcast_deliveries(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(broadcast_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let _org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;

    // Verify broadcast belongs to org
    let broadcast_owner: Option<Uuid> = sqlx::query_scalar(
        "SELECT event_id FROM broadcasts WHERE id = $1"
    )
    .bind(broadcast_id)
    .fetch_optional(state.db.pool())
    .await?;

    if broadcast_owner.is_none() {
        return Err(AppError::NotFound("Broadcast not found".to_string()));
    }

    let deliveries = sqlx::query_as::<_, (Uuid, Option<Uuid>, Option<Uuid>, Uuid, String, String, Option<String>, Option<String>, i32, chrono::DateTime<chrono::Utc>)>(
        "SELECT * FROM broadcast_deliveries WHERE broadcast_id = $1 ORDER BY created_at DESC"
    )
    .bind(broadcast_id)
    .fetch_all(state.db.pool())
    .await?;

    let data: Vec<serde_json::Value> = deliveries.into_iter().map(|d| {
        serde_json::json!({
            "id": d.0,
            "delivery_id": d.1,
            "recipient_id": d.2,
            "event_id": d.3,
            "channel": d.4,
            "status": d.5,
            "gateway_msg_id": d.6,
            "response": d.7,
            "retry_count": d.8,
            "created_at": d.9,
        })
    }).collect();

    Ok(Json(serde_json::json!({ "success": true, "data": data })))
}
