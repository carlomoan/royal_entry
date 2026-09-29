// ==============================================================================
// FILE: crates/cloud/src/handlers/card_templates.rs
// ==============================================================================
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Response,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    cards::renderer::{parse_theme_config, render_card},
    error::{AppError, AppResult},
    models::user::Claims,
    qr::render::render_qr_png,
    AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CardTemplateResponse {
    pub id: Uuid,
    pub org_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub theme_config: Value,
    pub background_file_id: Option<String>,
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
    pub background_file_id: Option<String>,
    pub preview_image_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCardTemplateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub theme_config: Option<Value>,
    pub background_file_id: Option<String>,
    pub preview_image_url: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RenderCardRequest {
    pub template_id: Uuid,
    pub event_id: Uuid,
    pub guest_id: Uuid,
}

pub async fn list_card_templates(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;

    let templates = sqlx::query_as::<_, CardTemplateResponse>(
        "SELECT id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, created_at, updated_at FROM card_templates WHERE org_id = $1 ORDER BY created_at DESC"
    )
    .bind(org_id)
    .fetch_all(state.db.pool())
    .await?;

    Ok(Json(json!({ "success": true, "data": templates })))
}

pub async fn get_card_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;

    let template = sqlx::query_as::<_, CardTemplateResponse>(
        "SELECT id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, created_at, updated_at FROM card_templates WHERE id = $1 AND org_id = $2"
    )
    .bind(id)
    .bind(org_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Card template not found".to_string()))?;

    Ok(Json(json!({ "success": true, "data": template })))
}

pub async fn create_card_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateCardTemplateRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;

    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Template name is required".to_string(),
        ));
    }

    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO card_templates (id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())"
    )
    .bind(id)
    .bind(org_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.theme_config)
    .bind(&payload.background_file_id)
    .bind(&payload.preview_image_url)
    .execute(state.db.pool())
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": "Card template created",
            "data": { "id": id }
        })),
    ))
}

pub async fn update_card_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCardTemplateRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;

    sqlx::query(
        "UPDATE card_templates SET name = COALESCE($3, name), description = COALESCE($4, description), theme_config = COALESCE($5, theme_config), background_file_id = COALESCE($6, background_file_id), preview_image_url = COALESCE($7, preview_image_url), is_active = COALESCE($8, is_active), updated_at = NOW() WHERE id = $1 AND org_id = $2"
    )
    .bind(id)
    .bind(org_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&payload.theme_config)
    .bind(&payload.background_file_id)
    .bind(&payload.preview_image_url)
    .bind(payload.is_active)
    .execute(state.db.pool())
    .await?;

    Ok(Json(
        json!({ "success": true, "message": "Card template updated" }),
    ))
}

pub async fn delete_card_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;

    let result = sqlx::query("DELETE FROM card_templates WHERE id = $1 AND org_id = $2")
        .bind(id)
        .bind(org_id)
        .execute(state.db.pool())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Card template not found".to_string()));
    }

    Ok(Json(
        json!({ "success": true, "message": "Card template deleted" }),
    ))
}

/// Render a personalized invitation card as PNG
/// POST /api/v1/cards/render
pub async fn render_card_template(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<RenderCardRequest>,
) -> AppResult<Response> {
    // 1. Fetch the card template
    let template = sqlx::query_as::<_, CardTemplateResponse>(
        "SELECT id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, created_at, updated_at FROM card_templates WHERE id = $1"
    )
    .bind(payload.template_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Card template not found".to_string()))?;

    // 2. Parse theme config
    let theme_config = parse_theme_config(&template.theme_config)?;

    // 3. Fetch event data
    let event = sqlx::query(
        "SELECT title, event_date, event_time, venue_name, venue_address, main_characters FROM events WHERE id = $1"
    )
    .bind(payload.event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::EventNotFound)?;

    let event_title: String = event.try_get("title").unwrap_or_default();
    let event_date: chrono::NaiveDate = event.try_get("event_date").unwrap_or_default();
    let event_time: Option<String> = event.try_get("event_time").ok();
    let venue_name: Option<String> = event.try_get("venue_name").ok().flatten();
    let venue_address: Option<String> = event.try_get("venue_address").ok().flatten();
    let main_characters: Option<String> = event.try_get("main_characters").ok().flatten();

    // 4. Fetch guest data
    let guest = sqlx::query(
        "SELECT full_name, phone, email, guest_category, table_number, device_type FROM guests WHERE id = $1 AND event_id = $2"
    )
    .bind(payload.guest_id)
    .bind(payload.event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::GuestNotFound)?;

    let guest_name: String = guest.try_get("full_name").unwrap_or_default();
    let guest_category: Option<String> = guest.try_get("guest_category").ok().flatten();
    let table_number: Option<String> = guest.try_get("table_number").ok().flatten();

    // 5. Fetch invitation for QR code
    let invitation = sqlx::query("SELECT id, short_link FROM invitations WHERE guest_id = $1")
        .bind(payload.guest_id)
        .fetch_optional(state.db.pool())
        .await?;

    let short_link = invitation
        .as_ref()
        .and_then(|row| row.try_get::<String, _>("short_link").ok());

    // 6. Generate QR code
    let qr_url = if let Some(ref link) = short_link {
        format!("{}/g/{}", state.config.app.frontend_url, link)
    } else {
        format!(
            "{}/events/{}/guest/{}",
            state.config.app.frontend_url, payload.event_id, payload.guest_id
        )
    };

    let qr_png = render_qr_png(&qr_url).unwrap_or_default();

    // 7. Build render data (variable replacements)
    let mut render_data = std::collections::HashMap::new();
    render_data.insert("EVENT_TITLE".to_string(), event_title);
    render_data.insert(
        "EVENT_DATE".to_string(),
        event_date.format("%A, %d %B %Y").to_string(),
    );
    render_data.insert(
        "EVENT_START_TIME".to_string(),
        event_time.unwrap_or_default(),
    );
    render_data.insert("EVENT_VENUE".to_string(), venue_name.unwrap_or_default());
    render_data.insert(
        "EVENT_ADDRESS".to_string(),
        venue_address.unwrap_or_default(),
    );
    render_data.insert(
        "EVENT_CHARACTERS".to_string(),
        main_characters.unwrap_or_default(),
    );
    render_data.insert("GUEST_NAME".to_string(), guest_name.clone());
    render_data.insert(
        "GUEST_CATEGORY".to_string(),
        guest_category.unwrap_or_default(),
    );
    render_data.insert(
        "GUEST_TABLE".to_string(),
        table_number.clone().unwrap_or_default(),
    );
    render_data.insert(
        "GUEST_SEATNO".to_string(),
        table_number.clone().unwrap_or_default(),
    );

    // 8. Load background image if available
    let background_bytes = if let Some(ref file_id) = template.background_file_id {
        sqlx::query("SELECT path FROM files WHERE id = $1")
            .bind(file_id)
            .fetch_optional(state.db.pool())
            .await?
            .and_then(|row| row.try_get::<String, _>("path").ok())
            .and_then(|path| std::fs::read(path).ok())
    } else {
        None
    };

    // 9. Render the card
    let card_png = render_card(
        &theme_config,
        background_bytes.as_deref(),
        &qr_png,
        &render_data,
    )?;

    // 10. Return PNG response
    let filename = format!("invitation_{}.png", guest_name.replace(' ', "_"));
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "image/png")
        .header(
            "Content-Disposition",
            format!("attachment; filename=\"{}\"", filename),
        )
        .body(axum::body::Body::from(card_png))
        .unwrap())
}

/// Render a personalized invitation card by invitation ID
/// GET /api/v1/events/{eid}/invitations/{inv_id}/render-card
pub async fn render_invitation_card(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<Claims>,
    Path(eid): Path<Uuid>,
    Path(inv_id): Path<Uuid>,
) -> AppResult<Response> {
    // 1. Fetch invitation with guest and event info
    let invitation = sqlx::query(
        "SELECT i.id, i.guest_id, i.short_link, g.event_id, g.full_name, g.phone, g.email, g.guest_category, g.table_number, g.device_type, e.title, e.event_date, e.event_time, e.venue_name, e.venue_address, e.main_characters, e.card_template_id FROM invitations i JOIN guests g ON g.id = i.guest_id JOIN events e ON e.id = g.event_id WHERE i.id = $1 AND e.id = $2"
    )
    .bind(inv_id)
    .bind(eid)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Invitation not found".to_string()))?;

    let guest_id: Uuid = invitation.try_get("guest_id").unwrap();
    let event_id: Uuid = invitation.try_get("event_id").unwrap();
    let guest_name: String = invitation.try_get("full_name").unwrap_or_default();
    let guest_category: Option<String> = invitation.try_get("guest_category").ok().flatten();
    let table_number: Option<String> = invitation.try_get("table_number").ok().flatten();
    let device_type: Option<String> = invitation.try_get("device_type").ok().flatten();
    let event_title: String = invitation.try_get("title").unwrap_or_default();
    let event_date: chrono::NaiveDate = invitation.try_get("event_date").unwrap_or_default();
    let event_time: Option<String> = invitation.try_get("event_time").ok();
    let venue_name: Option<String> = invitation.try_get("venue_name").ok().flatten();
    let venue_address: Option<String> = invitation.try_get("venue_address").ok().flatten();
    let main_characters: Option<String> = invitation.try_get("main_characters").ok().flatten();
    let card_template_id: Option<Uuid> = invitation.try_get("card_template_id").ok().flatten();
    let short_link: Option<String> = invitation.try_get("short_link").ok().flatten();

    // 2. Fetch card template (use event's template or default)
    let template_id = if let Some(id) = card_template_id {
        id
    } else {
        // Try to get the first active template for the organization
        match sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM card_templates WHERE org_id = (SELECT org_id FROM events WHERE id = $1) AND is_active = true ORDER BY created_at DESC LIMIT 1"
        )
        .bind(event_id)
        .fetch_one(state.db.pool())
        .await
        {
            Ok(id) => id,
            Err(_) => {
                // If no template found, return error
                return Err(AppError::NotFound("No active card template found".to_string()));
            }
        }
    };

    let template = sqlx::query_as::<_, CardTemplateResponse>(
        "SELECT id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, created_at, updated_at FROM card_templates WHERE id = $1"
    )
    .bind(template_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Card template not found".to_string()))?;

    // 3. Parse theme config
    let theme_config = parse_theme_config(&template.theme_config)?;

    // 4. Generate QR code
    let qr_url = if let Some(ref link) = short_link {
        format!("{}/g/{}", state.config.app.frontend_url, link)
    } else {
        format!(
            "{}/events/{}/guest/{}",
            state.config.app.frontend_url, event_id, guest_id
        )
    };

    let qr_png = render_qr_png(&qr_url).unwrap_or_default();

    // 5. Build render data
    let mut render_data = std::collections::HashMap::new();
    render_data.insert("EVENT_TITLE".to_string(), event_title);
    render_data.insert(
        "EVENT_DATE".to_string(),
        event_date.format("%A, %d %B %Y").to_string(),
    );
    render_data.insert(
        "EVENT_START_TIME".to_string(),
        event_time.unwrap_or_default(),
    );
    render_data.insert("EVENT_VENUE".to_string(), venue_name.unwrap_or_default());
    render_data.insert(
        "EVENT_ADDRESS".to_string(),
        venue_address.unwrap_or_default(),
    );
    render_data.insert(
        "EVENT_CHARACTERS".to_string(),
        main_characters.unwrap_or_default(),
    );
    render_data.insert("GUEST_NAME".to_string(), guest_name.clone());
    render_data.insert(
        "GUEST_CATEGORY".to_string(),
        guest_category.unwrap_or_default(),
    );
    let table_value = table_number.clone().unwrap_or_default();
    render_data.insert("GUEST_TABLE".to_string(), table_value.clone());
    render_data.insert("GUEST_SEATNO".to_string(), table_value);

    // 6. Load background image
    let background_bytes = if let Some(ref file_id) = template.background_file_id {
        sqlx::query("SELECT path FROM files WHERE id = $1")
            .bind(file_id)
            .fetch_optional(state.db.pool())
            .await?
            .and_then(|row| row.try_get::<String, _>("path").ok())
            .and_then(|path| std::fs::read(path).ok())
    } else {
        None
    };

    // 7. Render the card
    let card_png = render_card(
        &theme_config,
        background_bytes.as_deref(),
        &qr_png,
        &render_data,
    )?;

    // 8. Return PNG response
    let filename = format!("invitation_{}.png", guest_name.replace(' ', "_"));
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "image/png")
        .header(
            "Content-Disposition",
            format!("attachment; filename=\"{}\"", filename),
        )
        .body(axum::body::Body::from(card_png))
        .unwrap())
}
