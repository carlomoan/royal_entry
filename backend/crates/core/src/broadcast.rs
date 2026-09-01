use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Campaign {
    pub id: Uuid,
    pub event_id: Uuid,
    pub campaign_name: Option<String>,
    pub message: String,
    pub message_channel: String, // whatsapp | sms | both
    pub target_audience: String, // all | vip | confirmed | declined | not_rsvp
    pub status: String,          // pending | sending | completed | failed
    pub total_recipients: i64,
    pub successfully_sent: i64,
    pub failed_count: i64,
    pub sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct SendBroadcastRequest {
    pub campaign_name: Option<String>,
    #[validate(length(min = 1, max = 1600))]
    pub message: String,
    pub channel: String,
    pub target: String,
}

#[derive(Debug, Serialize)]
pub struct SendBroadcastResponse {
    pub campaign_id: Uuid,
    pub sent: i64,
    pub failed: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BroadcastDelivery {
    pub id: Uuid,
    pub campaign_id: Uuid,
    pub guest_id: Uuid,
    #[sqlx(default)]
    pub guest_name: String,
    #[sqlx(default)]
    pub guest_phone: String,
    pub channel: String,
    pub status: String,
    pub provider_message_id: Option<String>,
    pub error_message: Option<String>,
    pub delivered_at: DateTime<Utc>,
}
