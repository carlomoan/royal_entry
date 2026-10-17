use axum::{
    extract::{Path, State, Query},
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use sqlx::FromRow;
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
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, FromRow)]
struct MessageLogRow {
    id: Uuid,
    campaign_id: Uuid,
    delivery_id: Option<Uuid>,
    recipient_id: Option<Uuid>,
    event_id: Option<Uuid>,
    recipient_name: Option<String>,
    channel: String,
    status: String,
    gateway_msg_id: Option<String>,
    response: Option<String>,
    retry_count: i32,
    created_at: DateTime<Utc>,
}

pub async fn list_message_logs(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<MessageLogsQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let recipient_id = query.recipient_id.as_deref().map(Uuid::parse_str).transpose()
        .map_err(|_| AppError::BadRequest("recipient_id must be a UUID".to_string()))?;
    let event_id = query.event_id.as_deref().map(Uuid::parse_str).transpose()
        .map_err(|_| AppError::BadRequest("event_id must be a UUID".to_string()))?;
    let from = query.from.as_deref().map(DateTime::parse_from_rfc3339).transpose()
        .map_err(|_| AppError::BadRequest("from must be an RFC3339 timestamp".to_string()))?
        .map(|value| value.with_timezone(&Utc));
    let to = query.to.as_deref().map(DateTime::parse_from_rfc3339).transpose()
        .map_err(|_| AppError::BadRequest("to must be an RFC3339 timestamp".to_string()))?
        .map(|value| value.with_timezone(&Utc));
    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(50).clamp(1, 200);
    let offset = (page - 1) * per_page;

    let rows = sqlx::query_as::<_, MessageLogRow>(
        r#"SELECT ml.id, ml.campaign_id, ml.delivery_id, ml.recipient_id, ml.event_id,
                  g.full_name AS recipient_name, ml.channel, ml.status, ml.gateway_msg_id,
                  ml.response, ml.retry_count, ml.created_at
           FROM message_logs ml
           JOIN broadcast_campaigns bc ON bc.id = ml.campaign_id
           JOIN events e ON e.id = bc.event_id
           LEFT JOIN guests g ON g.id = ml.recipient_id
           WHERE e.organization_id = $1
             AND ($2::uuid IS NULL OR ml.recipient_id = $2)
             AND ($3::uuid IS NULL OR ml.event_id = $3)
             AND ($4::text IS NULL OR ml.channel = $4)
             AND ($5::text IS NULL OR ml.status = $5)
             AND ($6::timestamptz IS NULL OR ml.created_at >= $6)
             AND ($7::timestamptz IS NULL OR ml.created_at <= $7)
           ORDER BY ml.created_at DESC LIMIT $8 OFFSET $9"#,
    )
    .bind(org_id)
    .bind(recipient_id)
    .bind(event_id)
    .bind(query.channel.as_deref())
    .bind(query.status.as_deref())
    .bind(from)
    .bind(to)
    .bind(per_page)
    .bind(offset)
    .fetch_all(state.db.pool())
    .await?;

    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM message_logs ml
           JOIN broadcast_campaigns bc ON bc.id = ml.campaign_id
           JOIN events e ON e.id = bc.event_id
           WHERE e.organization_id = $1
             AND ($2::uuid IS NULL OR ml.recipient_id = $2)
             AND ($3::uuid IS NULL OR ml.event_id = $3)
             AND ($4::text IS NULL OR ml.channel = $4)
             AND ($5::text IS NULL OR ml.status = $5)
             AND ($6::timestamptz IS NULL OR ml.created_at >= $6)
             AND ($7::timestamptz IS NULL OR ml.created_at <= $7)"#,
    )
    .bind(org_id)
    .bind(recipient_id)
    .bind(event_id)
    .bind(query.channel.as_deref())
    .bind(query.status.as_deref())
    .bind(from)
    .bind(to)
    .fetch_one(state.db.pool())
    .await?;

    let logs: Vec<serde_json::Value> = rows.into_iter().map(|row| serde_json::json!({
        "id": row.id,
        "campaign_id": row.campaign_id,
        "delivery_id": row.delivery_id,
        "event_id": row.event_id,
        "recipient_id": row.recipient_id,
        "recipient_name": row.recipient_name,
        "channel": row.channel,
        "status": row.status,
        "gateway_msg_id": row.gateway_msg_id,
        "response": row.response,
        "retry_count": row.retry_count,
        "created_at": row.created_at,
    })).collect();

    Ok(Json(serde_json::json!({
        "success": true,
        "data": logs,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": if total == 0 { 0 } else { (total + per_page - 1) / per_page }
        }
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
        "SELECT event_id FROM broadcast_campaigns WHERE id = $1"
    )
    .bind(broadcast_id)
    .fetch_optional(state.db.pool())
    .await?;

    if broadcast_owner.is_none() {
        return Err(AppError::NotFound("Broadcast not found".to_string()));
    }

    let deliveries = sqlx::query_as::<_, (Uuid, Option<Uuid>, Option<Uuid>, Uuid, String, String, Option<String>, Option<String>, i32, chrono::DateTime<chrono::Utc>)>(
        "SELECT id, campaign_id, guest_id, channel, status, provider_message_id, error_message, retry_count, delivered_at
         FROM broadcast_deliveries WHERE campaign_id = $1 ORDER BY delivered_at DESC"
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
