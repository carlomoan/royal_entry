// ==============================================================================
// FILE: crates/cloud/src/handlers/templates.rs
// ==============================================================================
use std::sync::Arc;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    utils::rbac::require_platform_admin,
    AppState,
};

#[derive(Debug, Serialize)]
pub struct TemplateResponse {
    pub id: Uuid,
    pub name: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTemplateRequest {
    pub name: Option<String>,
    pub content: Option<String>,
}

pub async fn list_templates(
    State(_state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    Ok(Json(json!({ "success": true, "data": [] })))
}

pub async fn create_template(
    State(_state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(_payload): Json<CreateTemplateRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    require_platform_admin(&claims)?;
    Ok((StatusCode::CREATED, Json(json!({ "success": true, "message": "Template created" }))))
}

pub async fn get_template(
    State(_state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    Err(AppError::NotFound("Template not found".to_string()))
}

pub async fn update_template(
    State(_state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(_id): Path<Uuid>,
    Json(_payload): Json<UpdateTemplateRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    Ok(Json(json!({ "success": true, "message": "Template updated" })))
}

pub async fn delete_template(
    State(_state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    Ok(Json(json!({ "success": true, "message": "Template deleted" })))
}

pub async fn preview_template(
    State(_state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(_payload): Json<serde_json::Value>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    Ok(Json(json!({ "success": true, "data": { "preview": "Preview content" } })))
}

pub async fn duplicate_template(
    State(_state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    Ok(Json(json!({ "success": true, "message": "Template duplicated" })))
}
