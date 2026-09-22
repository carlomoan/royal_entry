use std::sync::Arc;
use axum::{extract::{Path, Query, State}, http::StatusCode, Extension, Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;
use crate::{
    error::{AppResult},
    models::user::Claims,
    models::webhook::{CreateWebhookEndpointRequest, UpdateWebhookEndpointRequest},
    services::WebhookService,
    utils::rbac::require_platform_admin,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct WebhookOrgQuery { pub organization_id: Option<Uuid> }

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeliveryRow {
    pub id: Uuid,
    pub endpoint_id: Uuid,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub response_status: Option<i32>,
    pub response_body: Option<String>,
    pub attempt: i32,
    pub status: String,
    pub error: Option<String>,
    pub next_retry_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
}

fn resolve_org(q: Option<Uuid>) -> Uuid { q.unwrap_or_else(Uuid::nil) }

pub async fn list_webhooks(
    State(state): State<Arc<AppState>>, Extension(claims): Extension<Claims>, Query(q): Query<WebhookOrgQuery>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let svc = WebhookService::new(state.clone());
    let endpoints = svc.list_endpoints(resolve_org(q.organization_id)).await?;
    Ok(Json(json!({ "success": true, "data": endpoints })))
}

pub async fn create_webhook(
    State(state): State<Arc<AppState>>, Extension(claims): Extension<Claims>, Query(q): Query<WebhookOrgQuery>, Json(payload): Json<CreateWebhookEndpointRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    require_platform_admin(&claims)?;
    let svc = WebhookService::new(state.clone());
    let endpoint = svc.create_endpoint(resolve_org(q.organization_id), payload).await?;
    Ok((StatusCode::CREATED, Json(json!({ "success": true, "data": endpoint }))))
}

pub async fn update_webhook(
    State(state): State<Arc<AppState>>, Extension(claims): Extension<Claims>, Query(q): Query<WebhookOrgQuery>, Path(id): Path<Uuid>, Json(payload): Json<UpdateWebhookEndpointRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let svc = WebhookService::new(state.clone());
    let endpoint = svc.update_endpoint(resolve_org(q.organization_id), id, payload).await?;
    Ok(Json(json!({ "success": true, "data": endpoint })))
}

pub async fn delete_webhook(
    State(state): State<Arc<AppState>>, Extension(claims): Extension<Claims>, Query(q): Query<WebhookOrgQuery>, Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let svc = WebhookService::new(state.clone());
    svc.delete_endpoint(resolve_org(q.organization_id), id).await?;
    Ok(Json(json!({ "success": true, "message": "Webhook deleted" })))
}

pub async fn list_webhook_deliveries(
    State(state): State<Arc<AppState>>, Extension(claims): Extension<Claims>, Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let deliveries = sqlx::query_as::<_, DeliveryRow>(
        "SELECT * FROM webhook_deliveries WHERE endpoint_id = $1 ORDER BY created_at DESC LIMIT 50",
    ).bind(id).fetch_all(state.db.pool()).await?;
    Ok(Json(json!({ "success": true, "data": deliveries })))
}

pub async fn test_webhook(
    State(state): State<Arc<AppState>>, Extension(claims): Extension<Claims>, Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let svc = WebhookService::new(state.clone());
    let delivery = svc.test_endpoint(id).await?;
    Ok(Json(json!({ "success": true, "data": delivery })))
}
