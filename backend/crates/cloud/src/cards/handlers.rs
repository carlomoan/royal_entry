use axum::{
    extract::{Path, State},
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    cards::repository,
    models::user::Claims,
    AppState,
};

pub async fn list_card_templates(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let templates = repository::list_by_org(state.db.pool(), org_id).await?;
    Ok(Json(serde_json::json!({ "success": true, "data": templates })))
}

pub async fn get_card_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let template = repository::get_by_id(state.db.pool(), id)
        .await?
        .ok_or(AppError::NotFound("Card template not found".to_string()))?;
    if template.org_id != org_id {
        return Err(AppError::Forbidden);
    }
    Ok(Json(serde_json::json!({ "success": true, "data": template })))
}
