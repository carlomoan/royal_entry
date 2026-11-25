use axum::{
    extract::{Path, State},
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;
use serde::Deserialize;
use crate::{
    error::{AppError, AppResult},
    templates::repository,
    models::user::Claims,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct CreateMessageTemplateRequest {
    pub name: String,
    pub channel_kind: String,
    pub subject: Option<String>,
    pub body: String,
}

pub async fn list_message_templates(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let templates = repository::list_by_org(state.db.pool(), org_id).await?;
    Ok(Json(serde_json::json!({ "success": true, "data": templates })))
}

pub async fn create_message_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateMessageTemplateRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    if !valid_channel(&payload.channel_kind) {
        return Err(AppError::ValidationError(
            "channel_kind must be sms, whatsapp, email or telegram".to_string(),
        ));
    }
    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO message_templates (id, org_id, name, channel_kind, subject, body, attachments_json, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb, NOW(), NOW())"#
    )
    .bind(id)
    .bind(org_id)
    .bind(&payload.name)
    .bind(&payload.channel_kind)
    .bind(&payload.subject)
    .bind(&payload.body)
    .execute(state.db.pool())
    .await?;
    Ok(Json(serde_json::json!({ "success": true, "data": { "id": id } })))
}

pub async fn preview_message_template(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(sample_ctx): Json<serde_json::Value>,
) -> AppResult<Json<serde_json::Value>> {
    let template = repository::get_by_id(state.db.pool(), id)
        .await?
        .ok_or(AppError::NotFound("Template not found".to_string()))?;

    // Use TemplateService to render with sample context
    let _service = crate::services::templates::TemplateService::new(state.clone());
    // Note: TemplateService uses email_templates table; for message templates we use direct Handlebars
    let mut hbs = handlebars::Handlebars::new();
    hbs.register_template_string("body", &template.body)
        .map_err(|e| AppError::BadRequest(format!("Invalid template: {}", e)))?;
    let rendered = hbs.render("body", &sample_ctx)
        .map_err(|e| AppError::BadRequest(format!("Render error: {}", e)))?;

    Ok(Json(serde_json::json!({
        "success": true,
        "data": {
            "template": template,
            "rendered_body": rendered,
        }
    })))
}

#[derive(Debug, Deserialize)]
pub struct UpdateMessageTemplateRequest {
    pub name: Option<String>,
    pub channel_kind: Option<String>,
    pub subject: Option<String>,
    pub body: Option<String>,
}

fn valid_channel(channel: &str) -> bool {
    matches!(channel, "sms" | "whatsapp" | "email" | "telegram")
}

pub async fn update_message_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateMessageTemplateRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let existing = repository::get_by_id(state.db.pool(), id)
        .await?
        .ok_or(AppError::NotFound("Template not found".to_string()))?;
    if existing.org_id != org_id {
        return Err(AppError::Forbidden);
    }
    let channel = payload.channel_kind.unwrap_or(existing.channel_kind);
    if !valid_channel(&channel) {
        return Err(AppError::ValidationError(
            "channel_kind must be sms, whatsapp, email or telegram".to_string(),
        ));
    }
    sqlx::query(
        r#"UPDATE message_templates SET name=$1, channel_kind=$2, subject=$3, body=$4, updated_at=NOW()
           WHERE id=$5 AND org_id=$6"#,
    )
    .bind(payload.name.unwrap_or(existing.name))
    .bind(channel)
    .bind(payload.subject.or(existing.subject))
    .bind(payload.body.unwrap_or(existing.body))
    .bind(id)
    .bind(org_id)
    .execute(state.db.pool())
    .await?;
    Ok(Json(serde_json::json!({ "success": true, "message": "Template updated" })))
}

pub async fn delete_message_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let existing = repository::get_by_id(state.db.pool(), id)
        .await?
        .ok_or(AppError::NotFound("Template not found".to_string()))?;
    if existing.org_id != org_id {
        return Err(AppError::Forbidden);
    }
    sqlx::query("DELETE FROM message_templates WHERE id=$1 AND org_id=$2")
        .bind(id)
        .bind(org_id)
        .execute(state.db.pool())
        .await?;
    Ok(Json(serde_json::json!({ "success": true, "message": "Template deleted" })))
}
