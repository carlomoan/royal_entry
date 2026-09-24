use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CardTemplate {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub theme_config: serde_json::Value,
    pub preview_image_url: Option<String>,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardPlaceholder {
    pub placeholder_type: String, // "qr" | "text"
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub rotation: Option<i32>,
    pub text_content: Option<String>, // for text placeholders
}
