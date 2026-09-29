// ==============================================================================
// FILE: crates/cloud/src/handlers/card_templates.rs
// ==============================================================================
use std::sync::Arc;
use axum::{
    extract::{Path, State, Multipart},
    http::StatusCode,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use serde_json::{json, Value};
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
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

#[derive(Debug, Deserialize)]
pub struct PreviewCardRequest {
    pub template_id: Uuid,
    pub event_id: Option<Uuid>,
    pub guest_id: Option<Uuid>,
}

pub async fn list_card_templates(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let templates = sqlx::query_as::<_, CardTemplateResponse>(
        "SELECT id, name, description, theme_config, preview_image_url, is_active, created_at, updated_at FROM card_templates ORDER BY created_at DESC"
    )
    .fetch_all(state.db.pool())
    .await?;
    
    Ok(Json(json!({ "success": true, "data": templates })))
}

pub async fn get_card_template(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let template = sqlx::query_as::<_, CardTemplateResponse>(
        "SELECT id, name, description, theme_config, preview_image_url, is_active, created_at, updated_at FROM card_templates WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Card template not found".to_string()))?;
    
    Ok(Json(json!({ "success": true, "data": template })))
}

pub async fn create_card_template(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<CreateCardTemplateRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
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

pub async fn update_card_template(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCardTemplateRequest>,
) -> AppResult<Json<serde_json::Value>> {
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

pub async fn delete_card_template(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query("DELETE FROM card_templates WHERE id = $1")
        .bind(id)
        .execute(state.db.pool())
        .await?;
    
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Card template not found".to_string()));
    }
    
    Ok(Json(json!({ "success": true, "message": "Card template deleted" })))
}

pub async fn upload_template_image(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    mut multipart: Multipart,
) -> AppResult<Json<serde_json::Value>> {
    while let Some(field) = multipart.next_field().await.map_err(|e| AppError::BadRequest(e.to_string()))? {
        if field.name() == Some("image") {
            let content_type = field.content_type().unwrap_or("image/png").to_string();
            let _data = field.bytes().await.map_err(|e| AppError::BadRequest(e.to_string()))?;
            let ext = if content_type.contains("png") { "png" } else { "jpg" };
            let filename = format!("card_template_{}.{}", id, ext);
            let image_url = format!("/uploads/card_templates/{}", filename);
            
            sqlx::query("UPDATE card_templates SET preview_image_url = $2, updated_at = NOW() WHERE id = $1")
                .bind(id)
                .bind(&image_url)
                .execute(state.db.pool())
                .await?;
            
            return Ok(Json(json!({ "success": true, "data": { "image_url": image_url } })));
        }
    }
    
    Err(AppError::BadRequest("No image file provided".to_string()))
}

pub async fn preview_card_template(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<PreviewCardRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let template = sqlx::query_as::<_, CardTemplateResponse>(
        "SELECT * FROM card_templates WHERE id = $1 AND is_active = TRUE"
    )
    .bind(payload.template_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Active template not found".to_string()))?;
    
    let mut sample_data = serde_json::Map::new();
    
    if let Some(event_id) = payload.event_id {
        let event = sqlx::query(
            "SELECT title, event_date, venue_name, venue_address, main_characters FROM events WHERE id = $1"
        )
        .bind(event_id)
        .fetch_optional(state.db.pool())
        .await?;
        
        if let Some(row) = event {
            sample_data.insert("event_title".to_string(), json!(row.try_get::<String, _>("title").unwrap_or_default()));
            sample_data.insert("event_date".to_string(), json!(row.try_get::<chrono::NaiveDate, _>("event_date").map(|d| d.to_string()).unwrap_or_default()));
            sample_data.insert("venue_name".to_string(), json!(row.try_get::<Option<String>, _>("venue_name").unwrap_or_default()));
            sample_data.insert("venue_address".to_string(), json!(row.try_get::<Option<String>, _>("venue_address").unwrap_or_default()));
            sample_data.insert("main_characters".to_string(), json!(row.try_get::<Option<String>, _>("main_characters").unwrap_or_default()));
        }
    }
    
    if let Some(guest_id) = payload.guest_id {
        let guest = sqlx::query(
            "SELECT full_name, phone, email, guest_category, table_number, device_type FROM guests WHERE id = $1"
        )
        .bind(guest_id)
        .fetch_optional(state.db.pool())
        .await?;
        
        if let Some(row) = guest {
            sample_data.insert("guest_name".to_string(), json!(row.try_get::<String, _>("full_name").unwrap_or_default()));
            sample_data.insert("guest_phone".to_string(), json!(row.try_get::<String, _>("phone").unwrap_or_default()));
            sample_data.insert("guest_email".to_string(), json!(row.try_get::<Option<String>, _>("email").unwrap_or_default()));
            sample_data.insert("guest_category".to_string(), json!(row.try_get::<Option<String>, _>("guest_category").unwrap_or_default()));
            sample_data.insert("table_number".to_string(), json!(row.try_get::<Option<String>, _>("table_number").unwrap_or_default()));
            
            // Fixed: Handle device_type as Option<String>
            let device_type = row.try_get::<Option<String>, _>("device_type").unwrap_or(Some("smartphone".to_string()));
            sample_data.insert("device_type".to_string(), json!(device_type));
        }
        
        let invitation = sqlx::query(
            "SELECT short_link FROM invitations WHERE guest_id = $1"
        )
        .bind(guest_id)
        .fetch_optional(state.db.pool())
        .await?;
        
        if let Some(row) = invitation {
            let short_link: String = row.try_get("short_link").unwrap_or_default();
            let qr_url = format!("{}/g/{}", state.config.app.frontend_url, short_link);
            sample_data.insert("qr_code_url".to_string(), json!(qr_url));
            sample_data.insert("short_link".to_string(), json!(short_link));
        }
    }
    
    Ok(Json(json!({
        "success": true,
        "data": {
            "template": template,
            "render_data": sample_data
        }
    })))
}