// ==============================================================================
// FILE: src/models/webhook.rs
// ==============================================================================
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WebhookEndpoint {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub url: String,
    pub secret: String,
    pub events: Vec<String>,
    pub is_active: bool,
    pub retry_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WebhookDelivery {
    pub id: Uuid,
    pub endpoint_id: Uuid,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub response_status: Option<i32>,
    pub response_body: Option<String>,
    pub attempt: i32,
    pub status: String, // pending, delivering, success, failed, abandoned
    pub error: Option<String>,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    // Joined fields
    pub url: Option<String>,
    pub secret: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WebhookEndpointResponse {
    pub id: Uuid,
    pub url: String,
    pub events: Vec<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

impl From<WebhookEndpoint> for WebhookEndpointResponse {
    fn from(e: WebhookEndpoint) -> Self {
        Self {
            id: e.id,
            url: e.url,
            events: e.events,
            is_active: e.is_active,
            created_at: e.created_at,
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateWebhookEndpointRequest {
    pub url: String,
    pub events: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateWebhookEndpointRequest {
    pub url: Option<String>,
    pub events: Option<Vec<String>>,
    pub is_active: Option<bool>,
}
