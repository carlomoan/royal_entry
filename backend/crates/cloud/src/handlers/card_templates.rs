use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    utils::rbac::require_platform_admin,
    AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CardTemplateResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub theme_config: Value,
    pub preview_image_url: Option<String>,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCardTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub theme_config: Value,
    pub preview_image_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCardTemplateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub theme_config: Option<Value>,
    pub preview_image_url: Option<String>,
    pub is_active: Option<bool>,
}

/// List all global card templates (available to all organizations)
pub async fn list_card_templates(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let templates = sqlx::query_as::<_, CardTemplateResponse>(
        "SELECT id, name, description, theme_config, preview_image_url, is_active, created_at, updated_at FROM card_templates ORDER BY created_at DESC"
    )
    .fetch_all(state.db.pool())
    .await?;

    Ok(Json(json!({ "success": true, "data": templates })))
}

/// Create a new global card template
pub async fn create_card_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateCardTemplateRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    require_platform_admin(&claims)?;

    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("Template name is required".to_string()));
    }

    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO card_templates (id, name, description, theme_config, preview_image_url, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())"
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.theme_config)
    .bind(&payload.preview_image_url)
    .execute(state.db.pool())
    .await?;

    Ok((StatusCode::CREATED, Json(json!({
        "success": true,
        "message": "Card template created",
        "data": { "id": id }
    }))))
}

/// Update a card template
pub async fn update_card_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCardTemplateRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    sqlx::query(
        "UPDATE card_templates SET name = COALESCE($2, name), description = COALESCE($3, description), theme_config = COALESCE($4, theme_config), preview_image_url = COALESCE($5, preview_image_url), is_active = COALESCE($6, is_active), updated_at = NOW() WHERE id = $1"
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.theme_config)
    .bind(&payload.preview_image_url)
    .bind(payload.is_active)
    .execute(state.db.pool())
    .await?;

    Ok(Json(json!({ "success": true, "message": "Card template updated" })))
}

/// Delete a card template
pub async fn delete_card_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let result = sqlx::query("DELETE FROM card_templates WHERE id = $1")
        .bind(id)
        .execute(state.db.pool())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Card template not found".to_string()));
    }

    Ok(Json(json!({ "success": true, "message": "Card template deleted" })))
}
