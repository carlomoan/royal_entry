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
    pub is_global: bool, // Platform-owned template, selectable by every organization
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
    pub is_global: bool,
    /// Whether the requesting organization created this template (write access).
    pub is_owned: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl CardTemplateResponse {
    pub fn from_template(template: CardTemplate, caller_org_id: Uuid) -> Self {
        Self {
            is_owned: template.org_id == caller_org_id,
            id: template.id,
            org_id: template.org_id,
            name: template.name,
            description: template.description,
            theme_config: template.theme_config,
            background_file_id: template.background_file_id,
            preview_image_url: template.preview_image_url,
            is_active: template.is_active,
            is_global: template.is_global,
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
    pub is_active: Option<bool>,
    /// Only honored for platform roles; org accounts always create private templates.
    pub is_global: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCardTemplateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub theme_config: Option<Value>,
    pub background_file_id: Option<String>,
    pub preview_image_url: Option<String>,
    pub is_active: Option<bool>,
    pub is_global: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RenderCardRequest {
    pub template_id: Option<Uuid>,
    pub event_id: Uuid,
    pub guest_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct BulkRenderCardsRequest {
    pub event_id: Uuid,
    pub guest_ids: Vec<Uuid>,
    pub template_id: Option<Uuid>,
}
