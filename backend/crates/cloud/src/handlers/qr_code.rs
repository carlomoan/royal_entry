use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    Extension,
    response::Response,
};
use std::sync::Arc;
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    models::{
        invitation::Invitation,
        user::Claims,
    },
    repository::event_repository::EventRepository,
    AppState,
};

/// Generate a QR code PNG image for an invitation
/// Returns the QR code image with the check-in URL embedded
#[axum::debug_handler]
pub async fn generate_qr_code(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, invitation_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Response> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;

    // Verify event ownership
    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }

    // Get invitation
    let invitation = sqlx::query_as::<_, Invitation>(
        "SELECT * FROM invitations WHERE id = $1 AND guest_id IN (SELECT id FROM guests WHERE event_id = $2)"
    )
    .bind(invitation_id)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Invitation not found".to_string()))?;

    let frontend_url = state.config.app.frontend_url.clone();
    let check_in_url = crate::models::invitation::build_scan_url(&frontend_url, event_id, &invitation.short_link);

    // Generate QR code using qrcode crate
    use qrcode::QrCode;
    use image::{Luma, ImageEncoder};

    let code = QrCode::new(check_in_url.as_bytes())
        .map_err(|_| AppError::InternalServerError)?;

    // Render QR code as PNG
    let image = code.render::<Luma<u8>>()
        .min_dimensions(300, 300)
        .build();

    // Convert to PNG bytes
    let mut png_bytes: Vec<u8> = Vec::new();
    {
        let encoder = image::codecs::png::PngEncoder::new(&mut png_bytes);
        encoder.write_image(
            &image,
            image.width(),
            image.height(),
            image::ColorType::L8.into(),
        ).map_err(|_| AppError::InternalServerError)?;
    }

    let headers = HeaderMap::from_iter([
        (header::CONTENT_TYPE, "image/png".parse().unwrap()),
        (header::CONTENT_DISPOSITION, "inline; filename=\"qr-code.png\"".parse().unwrap()),
    ]);

    let mut response = Response::new(png_bytes.into());
    *response.headers_mut() = headers;
    *response.status_mut() = StatusCode::OK;

    Ok(response)
}
