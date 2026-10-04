use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CardTemplate {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub theme_config: Value, // Stores v2 JSON schema (version, size, variables, pages)
    pub background_file_id: Option<String>, // Legacy/Top-level fallback
    pub preview_image_url: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct CardTemplateResponse {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub theme_config: Value,
    pub background_file_id: Option<String>,
    pub preview_image_url: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<CardTemplate> for CardTemplateResponse {
    fn from(template: CardTemplate) -> Self {
        Self {
            id: template.id,
            org_id: template.org_id,
            name: template.name,
            description: template.description,
            theme_config: template.theme_config,
            background_file_id: template.background_file_id,
            preview_image_url: template.preview_image_url,
            is_active: template.is_active,
            created_at: template.created_at,
            updated_at: template.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateCardTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub theme_config: Value,
    pub background_file_id: Option<String>,
    pub preview_image_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCardTemplateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub theme_config: Option<Value>,
    pub background_file_id: Option<String>,
    pub preview_image_url: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RenderCardRequest {
    pub template_id: Uuid,
    pub event_id: Uuid,
    pub guest_id: Uuid,
}