// ==============================================================================
// FILE: src/handlers/notifications.rs
// ==============================================================================
use std::sync::Arc;
use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;
use crate::{
    error::AppResult,
    models::user::Claims,
    services::NotificationService,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub limit: Option<i64>,
}

/// GET /api/v1/notifications
pub async fn list_notifications(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let svc = NotificationService::new(state.clone());
    let items = svc.list_for(&claims, q.limit.unwrap_or(20).min(50)).await?;
    Ok(Json(json!({ "success": true, "data": items })))
}

/// GET /api/v1/notifications/unread-count
pub async fn unread_count(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let svc = NotificationService::new(state.clone());
    let count = svc.unread_count(&claims).await?;
    Ok(Json(json!({ "success": true, "data": { "count": count } })))
}

/// POST /api/v1/notifications/{id}/read
pub async fn mark_read(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let svc = NotificationService::new(state.clone());
    svc.mark_read(&claims, id).await?;
    Ok(Json(json!({ "success": true })))
}

/// POST /api/v1/notifications/read-all
pub async fn mark_all_read(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let svc = NotificationService::new(state.clone());
    svc.mark_all_read(&claims).await?;
    Ok(Json(json!({ "success": true })))
}
