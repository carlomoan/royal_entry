use crate::{
    cards::{
        model::*,
        renderer::{parse_theme_config, render_card},
        repository,
    },
    error::{AppError, AppResult},
    models::user::Claims,
    qr::render::render_qr_png,
    AppState,
};
use sqlx::Row;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Response,
    Extension, Json,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

pub async fn list_card_templates(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let templates = repository::list_templates(state.db.pool(), org_id).await?;
    Ok(Json(json!({ "success": true, "data": templates })))
}

pub async fn get_card_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let template = repository::get_template(state.db.pool(), id, org_id).await?;
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
    let template = repository::create_template(state.db.pool(), org_id, payload).await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true, "message": "Card template created", "data": { "id": template.id }
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
    let template = repository::update_template(state.db.pool(), id, org_id, payload).await?;
    Ok(Json(
        json!({ "success": true, "message": "Card template updated", "data": template }),
    ))
}

pub async fn delete_card_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    repository::delete_template(state.db.pool(), id, org_id).await?;
    Ok(Json(
        json!({ "success": true, "message": "Card template deleted" }),
    ))
}

pub async fn upload_template_image(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    mut multipart: axum::extract::Multipart,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let _ = repository::get_template(state.db.pool(), id, org_id).await?; // Verify ownership

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        if field.name() == Some("image") {
            let content_type = field.content_type().unwrap_or("image/png").to_string();
            let data = field
                .bytes()
                .await
                .map_err(|e| AppError::BadRequest(e.to_string()))?;
            let ext = if content_type.contains("png") {
                "png"
            } else {
                "jpg"
            };
            let filename = format!("card_template_{}.{}", id, ext);

            let upload_dir = std::path::Path::new("uploads/card_templates");
            std::fs::create_dir_all(upload_dir).map_err(|_| AppError::InternalServerError)?;
            let file_path = upload_dir.join(&filename);
            std::fs::write(&file_path, &data).map_err(|_| AppError::InternalServerError)?;

            let image_url = format!("/uploads/card_templates/{}", filename);
            sqlx::query("UPDATE card_templates SET preview_image_url = $1, updated_at = NOW() WHERE id = $2")
                .bind(&image_url)
                .bind(id)
                .execute(state.db.pool())
                .await?;

            return Ok(Json(
                json!({ "success": true, "data": { "image_url": image_url } }),
            ));
        }
    }
    Err(AppError::BadRequest("No image file provided".to_string()))
}

pub async fn render_card_template(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<RenderCardRequest>,
) -> AppResult<Response> {
    let template = sqlx::query_as::<_, CardTemplate>(
        "SELECT id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, created_at, updated_at FROM card_templates WHERE id = $1"
    ).bind(payload.template_id)
    .fetch_optional(state.db.pool()).await?
    .ok_or(AppError::NotFound("Card template not found".to_string()))?;

    let theme_config = parse_theme_config(&template.theme_config)?;

    let event = sqlx::query("SELECT title, event_date, event_time, venue_name, venue_address, main_characters FROM events WHERE id = $1")
        .bind(payload.event_id).fetch_optional(state.db.pool()).await?
        .ok_or(AppError::EventNotFound)?;

    let event_title: String = event.try_get("title").unwrap_or_default();
    let event_date: chrono::NaiveDate = event.try_get("event_date").unwrap_or_default();
    let event_time: Option<String> = event.try_get("event_time").ok();
    let venue_name: Option<String> = event.try_get("venue_name").ok().flatten();
    let venue_address: Option<String> = event.try_get("venue_address").ok().flatten();
    let main_characters: Option<String> = event.try_get("main_characters").ok().flatten();

    let guest = sqlx::query("SELECT full_name, guest_category, table_number FROM guests WHERE id = $1 AND event_id = $2")
        .bind(payload.guest_id).bind(payload.event_id).fetch_optional(state.db.pool()).await?
        .ok_or(AppError::GuestNotFound)?;

    let guest_name: String = guest.try_get("full_name").unwrap_or_default();
    let guest_category: Option<String> = guest.try_get("guest_category").ok().flatten();
    let table_number: Option<String> = guest.try_get("table_number").ok().flatten();

    let invitation = sqlx::query("SELECT short_link FROM invitations WHERE guest_id = $1")
        .bind(payload.guest_id)
        .fetch_optional(state.db.pool())
        .await?;
    let short_link: Option<String> = invitation.and_then(|row| row.try_get("short_link").ok());

    let qr_url = if let Some(ref link) = short_link {
        format!("{}/g/{}", state.config.app.frontend_url, link)
    } else {
        format!(
            "{}/events/{}/guest/{}",
            state.config.app.frontend_url, payload.event_id, payload.guest_id
        )
    };
    let qr_png = render_qr_png(&qr_url).unwrap_or_default();

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

    let table_val = table_number.clone().unwrap_or_default();
    render_data.insert("GUEST_TABLE".to_string(), table_val.clone());
    render_data.insert("GUEST_SEATNO".to_string(), table_val);
    render_data.insert("QR_CODE".to_string(), qr_url);

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

    let card_png = render_card(
        &theme_config,
        background_bytes.as_deref(),
        &qr_png,
        &render_data,
    )?;

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
