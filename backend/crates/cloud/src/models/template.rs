// ==============================================================================
// FILE: src/models/template.rs
// ==============================================================================
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EmailTemplate {
    pub id: Uuid,
    pub name: String,
    pub subject: String,
    pub html_body: String,
    pub text_body: Option<String>,
    pub variables: Vec<String>,
    pub category: String,
    pub is_active: bool,
    pub is_system: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub subject: String,
    pub html_body: String,
    pub text_body: Option<String>,
    pub category: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateTemplateRequest {
    pub name: Option<String>,
    pub subject: Option<String>,
    pub html_body: Option<String>,
    pub text_body: Option<String>,
    pub category: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct RenderedTemplate {
    pub subject: String,
    pub html_body: String,
    pub text_body: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TemplatePreview {
    pub template: EmailTemplate,
    pub sample_variables: serde_json::Value,
}
