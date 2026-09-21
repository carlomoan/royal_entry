use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MessageTemplate {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub channel_kind: String,
    pub subject: Option<String>,
    pub body: String,
    pub attachments_json: Option<serde_json::Value>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}
