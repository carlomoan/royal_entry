use crate::{
    cards::{
        model::*,
        repository,
    },
    error::{AppError, AppResult},
    files::storage::Storage,
    models::user::Claims,
    AppState,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use image::{imageops::FilterType, DynamicImage, ImageFormat, Rgba};
use qrcode::QrCode;
use sqlx::Row;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Response,
    Extension, Json,
};
use serde_json::json;
use std::{io::Cursor, sync::Arc};
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
    Extension(claims): Extension<Claims>,
    Json(payload): Json<RenderCardRequest>,
) -> AppResult<Response> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let png = render_for_guest(&state, org_id, payload.event_id, payload.guest_id, payload.template_id).await?;
    let mut response = Response::new(axum::body::Body::from(png));
    response.headers_mut().insert("content-type", "image/png".parse().map_err(|_| AppError::InternalServerError)?);
    response.headers_mut().insert("content-disposition", "attachment; filename=\"invitation.png\"".parse().map_err(|_| AppError::InternalServerError)?);
    *response.status_mut() = StatusCode::OK;
    Ok(response)
}

pub async fn render_cards_bulk(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<BulkRenderCardsRequest>,
) -> AppResult<Json<serde_json::Value>> {
    if payload.guest_ids.is_empty() || payload.guest_ids.len() > 250 {
        return Err(AppError::BadRequest("Bulk rendering requires between 1 and 250 guests".to_string()));
    }
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let mut cards = Vec::with_capacity(payload.guest_ids.len());
    for guest_id in payload.guest_ids {
        let png = render_for_guest(&state, org_id, payload.event_id, guest_id, payload.template_id).await?;
        cards.push(json!({ "guest_id": guest_id, "png_base64": BASE64.encode(png) }));
    }
    Ok(Json(json!({ "success": true, "data": { "cards": cards } })))
}

async fn render_for_guest(
    state: &Arc<AppState>,
    org_id: Uuid,
    event_id: Uuid,
    guest_id: Uuid,
    requested_template_id: Option<Uuid>,
) -> AppResult<Vec<u8>> {
    let event = sqlx::query("SELECT organization_id, card_template_id FROM events WHERE id = $1 AND deleted_at IS NULL")
        .bind(event_id)
        .fetch_optional(state.db.pool())
        .await?
        .ok_or(AppError::EventNotFound)?;
    let event_org_id: Uuid = event.try_get("organization_id")?;
    if event_org_id != org_id {
        return Err(AppError::Forbidden);
    }
    let template_id = requested_template_id
        .or(event.try_get::<Option<Uuid>, _>("card_template_id")?)
        .ok_or_else(|| AppError::BadRequest("Select a card template for this event first".to_string()))?;
    let template = repository::get_template(state.db.pool(), template_id, org_id).await?;
    if !template.is_active {
        return Err(AppError::BadRequest("The selected card template is inactive".to_string()));
    }

    let guest_exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM guests WHERE id = $1 AND event_id = $2)")
        .bind(guest_id)
        .bind(event_id)
        .fetch_one(state.db.pool())
        .await?;
    if !guest_exists {
        return Err(AppError::GuestNotFound);
    }

    let short_link: String = sqlx::query_scalar("SELECT short_link FROM invitations WHERE guest_id = $1")
        .bind(guest_id)
        .fetch_optional(state.db.pool())
        .await?
        .ok_or(AppError::InvitationNotFound)?;
    let frontend_url = state.config.app.frontend_url.trim_end_matches('/');
    let qr_url = format!("{frontend_url}/g/{short_link}");

    let config = &template.theme_config;
    let file_id = config
        .get("front_file_id")
        .and_then(serde_json::Value::as_str)
        .or(template.background_file_id.as_deref())
        .ok_or_else(|| AppError::BadRequest("Template has no front_file_id".to_string()))?;
    if file_id.contains('/') || file_id.contains('\\') || file_id.contains("..") || !file_id.ends_with(".png") {
        return Err(AppError::Forbidden);
    }
    let storage = crate::files::storage::LocalStorage::new("uploads/cards");
    let storage_path = format!("{org_id}/{file_id}");
    let front_bytes = storage.download(&storage_path).await.map_err(|_| AppError::FileNotFound)?;
    let mut front = image::load_from_memory(&front_bytes)
        .map_err(|_| AppError::BadRequest("Template background is not a supported raster image".to_string()))?
        .to_rgba8();

    let position = config.get("qr_position").and_then(serde_json::Value::as_object)
        .ok_or_else(|| AppError::BadRequest("Template qr_position is missing".to_string()))?;
    let number = |key: &str| -> AppResult<f64> {
        position.get(key).and_then(serde_json::Value::as_f64)
            .filter(|value| value.is_finite())
            .ok_or_else(|| AppError::BadRequest(format!("qr_position.{key} must be a finite number")))
    };
    let percent = |value: f64| if value <= 1.0 { value * 100.0 } else { value };
    let x = percent(number("x")?).clamp(0.0, 100.0);
    let y = percent(number("y")?).clamp(0.0, 100.0);
    let w = percent(number("w")?).clamp(0.1, 100.0);
    let h = percent(number("h")?).clamp(0.1, 100.0);
    let left = ((x / 100.0) * f64::from(front.width())).round() as u32;
    let top = ((y / 100.0) * f64::from(front.height())).round() as u32;
    let width = (((w / 100.0) * f64::from(front.width())).round() as u32).min(front.width().saturating_sub(left));
    let height = (((h / 100.0) * f64::from(front.height())).round() as u32).min(front.height().saturating_sub(top));
    if width == 0 || height == 0 {
        return Err(AppError::BadRequest("QR position falls outside the card bounds".to_string()));
    }

    let qr_code = QrCode::new(qr_url.as_bytes()).map_err(|error| AppError::QrGenerationError(error.to_string()))?;
    let qr = qr_code
        .render::<Rgba<u8>>()
        .min_dimensions(width.max(1), height.max(1))
        .dark_color(Rgba([0, 0, 0, 255]))
        .light_color(Rgba([0, 0, 0, 0]))
        .build();
    let qr = image::imageops::resize(&qr, width, height, FilterType::Nearest);
    image::imageops::overlay(&mut front, &qr, i64::from(left), i64::from(top));

    let mut output = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(front)
        .write_to(&mut output, ImageFormat::Png)
        .map_err(|_| AppError::InternalServerError)?;
    Ok(output.into_inner())
}
