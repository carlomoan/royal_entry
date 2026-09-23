use sqlx::PgPool;
use crate::error::{AppResult, AppError};
use uuid::Uuid;

pub async fn list_by_broadcast(pool: &PgPool, broadcast_id: Uuid) -> AppResult<Vec<serde_json::Value>> {
    sqlx::query_as::<_, (Uuid, Option<Uuid>, Option<Uuid>, Uuid, String, String, Option<String>, Option<String>, i32, chrono::DateTime<chrono::Utc>)>(
        "SELECT * FROM message_logs WHERE campaign_id = $1 ORDER BY created_at DESC"
    )
    .bind(broadcast_id)
    .fetch_all(pool)
    .await
    .map_err(|_| AppError::InternalServerError)
    .map(|rows| {
        rows.into_iter().map(|r| {
            serde_json::json!({
                "id": r.0,
                "delivery_id": r.1,
                "recipient_id": r.2,
                "event_id": r.3,
                "channel": r.4,
                "status": r.5,
                "gateway_msg_id": r.6,
                "response": r.7,
                "retry_count": r.8,
                "created_at": r.9,
            })
        }).collect()
    })
}
