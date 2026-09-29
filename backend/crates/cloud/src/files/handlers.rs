use axum::{
    extract::{Multipart, State},
    Extension, Json,
};
use std::sync::Arc;
use crate::{
    error::{AppError, AppResult},
    files::storage::Storage,
    models::user::Claims,
    AppState,
};

pub async fn upload_file(
    State(_state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = uuid::Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;

    let mut file_id = String::new();
    let mut file_content: Vec<u8> = Vec::new();
    let mut file_name = String::new();

    while let Some(field) = multipart.next_field().await.map_err(|_| AppError::BadRequest("Multipart error".to_string()))? {
        let name = field.name().unwrap_or("file").to_string();
        if name == "file" {
            file_name = field.file_name().unwrap_or("upload").to_string();
            file_content = field.bytes().await.map_err(|_| AppError::InternalServerError)?.to_vec();
            file_id = format!("{}_{}", org_id, file_name);
        }
    }

    if file_content.is_empty() {
        return Err(AppError::BadRequest("No file uploaded".to_string()));
    }

    // Use local storage for now
    let storage = crate::files::storage::LocalStorage::new("uploads");
    storage.upload(std::path::Path::new(&file_id), file_content, "application/octet-stream").await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "data": { "file_id": file_id, "file_name": file_name }
    })))
}
