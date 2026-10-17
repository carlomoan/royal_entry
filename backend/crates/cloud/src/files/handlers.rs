use axum::{
    extract::{Multipart, Path, State},
    http::{header, HeaderValue, StatusCode},
    response::Response,
    Extension, Json,
};
use image::{DynamicImage, ImageFormat};
use std::{io::Cursor, sync::Arc};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    files::storage::{LocalStorage, Storage},
    models::user::Claims,
    AppState,
};

pub async fn upload_file(
    State(_state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let mut uploaded: Option<(String, Vec<u8>, String)> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|error| AppError::BadRequest(format!("Invalid multipart upload: {error}")))?
    {
        if field.name() != Some("file") {
            continue;
        }
        let name = field.file_name().unwrap_or("background").to_string();
        let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
        let bytes = field
            .bytes()
            .await
            .map_err(|error| AppError::BadRequest(format!("Could not read upload: {error}")))?;
        uploaded = Some((name, bytes.to_vec(), content_type));
        break;
    }

    let (file_name, bytes, content_type) = uploaded.ok_or_else(|| {
        AppError::BadRequest("Choose an image file to upload".to_string())
    })?;
    if bytes.is_empty() {
        return Err(AppError::BadRequest("The uploaded image is empty".to_string()));
    }
    if bytes.len() > 20 * 1024 * 1024 {
        return Err(AppError::BadRequest("Image must be smaller than 20 MB".to_string()));
    }
    if !content_type.starts_with("image/") {
        return Err(AppError::InvalidFileType);
    }

    let image = image::load_from_memory(&bytes)
        .map_err(|_| AppError::BadRequest("Could not decode image. Upload PNG, JPEG, or WEBP; SVG must be converted by the browser.".to_string()))?;
    let png = encode_png(image)?;
    let file_id = format!("{}.png", Uuid::new_v4());
    let storage_path = format!("{org_id}/{file_id}");
    let storage = LocalStorage::new("uploads/cards");
    storage
        .upload(std::path::Path::new(&storage_path), png, "image/png")
        .await?;

    let preview_url = format!("/api/v1/files/{}", file_id);
    Ok(Json(serde_json::json!({
        "success": true,
        "data": {
            "file_id": file_id,
            "file_name": file_name,
            "url": preview_url,
            "mime_type": "image/png"
        }
    })))
}

pub async fn download_file(
    State(_state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(file_id): Path<String>,
) -> AppResult<Response> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    if file_id.contains('/') || file_id.contains('\\') || file_id.contains("..") || !file_id.ends_with(".png") {
        return Err(AppError::Forbidden);
    }

    let storage = LocalStorage::new("uploads/cards");
    let storage_path = format!("{org_id}/{file_id}");
    let bytes = storage.download(&storage_path).await.map_err(|_| AppError::FileNotFound)?;
    let mut response = Response::new(axum::body::Body::from(bytes));
    response.headers_mut().insert(header::CONTENT_TYPE, HeaderValue::from_static("image/png"));
    response.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("private, max-age=3600"));
    *response.status_mut() = StatusCode::OK;
    Ok(response)
}

fn encode_png(image: DynamicImage) -> AppResult<Vec<u8>> {
    let mut bytes = Vec::new();
    image
        .write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png)
        .map_err(|_| AppError::InternalServerError)?;
    Ok(bytes)
}
