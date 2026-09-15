// ==============================================================================
// FILE: src/handlers/guests.rs
// ==============================================================================
// HTTP handlers for Guests CRUD

use axum::{
    extract::{Path, Query, State, Multipart},
    http::StatusCode,
    Extension, Json,
};
use std::sync::Arc;
use serde::{Deserialize};
use serde_json::json;
use uuid::Uuid;
use validator::Validate;
use csv::ReaderBuilder;
use std::io::Cursor;

use crate::{
    error::{AppError, AppResult},
    models::{
        guest::{
            CreateGuestRequest, CreateMultipleGuestsRequest, GuestResponse, PaginationMeta, UpdateGuestRequest,
        },
        user::Claims,
    },
    repository::{
        event_repository::EventRepository,
        guest_repository::GuestRepository,
    },
    services::UsageService,
    AppState,
};

// ==============================================================================
// Query filters
// ==============================================================================

#[derive(Debug, Deserialize)]
pub struct GuestFilterQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub category: Option<String>,    // VIP, Regular, Staff, etc.
    pub with_rsvp: Option<bool>,     // Include RSVP status
}

impl GuestFilterQuery {
    pub fn offset(&self) -> i64 {
        let page = self.page.unwrap_or(1);
        (page - 1) * self.per_page.unwrap_or(20)
    }

    pub fn limit(&self) -> i64 {
        self.per_page.unwrap_or(20)
    }
}

// ==============================================================================
// Utility: verify event belongs to caller's org
// ==============================================================================

async fn assert_event_ownership(
    state: &Arc<AppState>,
    event_id: Uuid,
    org_id: Uuid,
) -> AppResult<crate::models::event::Event> {
    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;

    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }

    Ok(event)
}

// ==============================================================================
// POST /api/v1/events/:event_id/guests
// ==============================================================================

/// Add a single guest to an event
///
/// Request:
/// ```json
/// {
///   "full_name": "Hassan Mohammed",
///   "phone": "+255700001001",
///   "email": "hassan@example.com",
///   "table_number": "5",
///   "guest_category": "VIP",
///   "plus_one_allowed": true,
///   "contact_method": "whatsapp"
/// }
/// ```
pub async fn create_guest(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<CreateGuestRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    // Validate input
    payload.validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    // Ensure event belongs to the caller
    assert_event_ownership(&state, event_id, org_id).await?;

    // Enforce package guest limit (1 new guest)
    if !crate::utils::rbac::is_platform_role(&claims.role) {
        UsageService::new(state.clone())
            .enforce_guest_limit(org_id, 1)
            .await?;
    }

    // Check for duplicate phone in this event
    let existing = GuestRepository::get_by_phone(
        state.db.pool(),
        event_id,
        &payload.phone,
    )
    .await?;

    if existing.is_some() {
        return Err(AppError::Conflict(format!(
            "A guest with phone {} already exists in this event",
            payload.phone
        )));
    }

    let guest = GuestRepository::create(state.db.pool(), event_id, &payload).await?;

    tracing::info!(
        event_id = %event_id,
        guest_id = %guest.id,
        phone = %guest.phone,
        "Guest added to event"
    );

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": GuestResponse::from(guest)
        })),
    ))
}

// ==============================================================================
// POST /api/v1/events/:event_id/guests/bulk
// ==============================================================================

/// Add multiple guests at once (bulk import)
///
/// Request:
/// ```json
/// {
///   "guests": [
///     { "full_name": "Hassan Mohammed", "phone": "+255700001001", "guest_category": "VIP" },
///     { "full_name": "Fatima Adili",    "phone": "+255700001002", "guest_category": "Regular" },
///     { "full_name": "Kamau Kipchoge",  "phone": "+255700001003", "guest_category": "Regular" }
///   ]
/// }
/// ```
pub async fn bulk_create_guests(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<CreateMultipleGuestsRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    assert_event_ownership(&state, event_id, org_id).await?;

    if payload.guests.is_empty() {
        return Err(AppError::BadRequest("Guests list cannot be empty".to_string()));
    }

    if payload.guests.len() > 500 {
        return Err(AppError::BadRequest(
            "Maximum 500 guests per bulk import. Split into batches.".to_string(),
        ));
    }

    // Enforce package guest limit for the batch
    if !crate::utils::rbac::is_platform_role(&claims.role) {
        UsageService::new(state.clone())
            .enforce_guest_limit(org_id, payload.guests.len() as i64)
            .await?;
    }

    // Validate all guests before inserting any
    for (i, guest) in payload.guests.iter().enumerate() {
        guest.validate().map_err(|e| {
            AppError::ValidationError(format!("Guest at index {}: {}", i, e))
        })?;
    }

    let count = payload.guests.len();
    let guests = GuestRepository::create_multiple(
        state.db.pool(),
        event_id,
        payload.guests,
    )
    .await?;

    let responses: Vec<GuestResponse> = guests
        .into_iter()
        .map(GuestResponse::from)
        .collect();

    tracing::info!(
        event_id = %event_id,
        count = count,
        "Bulk guests imported"
    );

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": responses,
            "message": format!("{} guests added successfully", count)
        })),
    ))
}

// ==============================================================================
// GET /api/v1/events/:event_id/guests
// ==============================================================================

/// List all guests for an event (with optional filters and RSVP status)
pub async fn list_guests(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Query(filters): Query<GuestFilterQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    assert_event_ownership(&state, event_id, org_id).await?;

    let limit  = filters.limit();
    let offset = filters.offset();
    let page   = filters.page.unwrap_or(1);
    let per_page = filters.per_page.unwrap_or(20);

    // Include RSVP status if requested
    if filters.with_rsvp.unwrap_or(false) {
        let (guests, total) = GuestRepository::list_with_rsvp(
            state.db.pool(),
            event_id,
            limit,
            offset,
        )
        .await?;

        return Ok(Json(json!({
            "success": true,
            "data": guests,
            "pagination": PaginationMeta::new(page, per_page, total)
        })));
    }

    let (guests, total) = GuestRepository::list_by_event(
        state.db.pool(),
        event_id,
        limit,
        offset,
    )
    .await?;

    let responses: Vec<GuestResponse> = guests
        .into_iter()
        .map(GuestResponse::from)
        .collect();

    Ok(Json(json!({
        "success": true,
        "data": responses,
        "pagination": PaginationMeta::new(page, per_page, total)
    })))
}

// ==============================================================================
// GET /api/v1/events/:event_id/guests/:guest_id
// ==============================================================================

/// Get a single guest by ID
pub async fn get_guest(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, guest_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    assert_event_ownership(&state, event_id, org_id).await?;

    let guest = GuestRepository::get_by_id(state.db.pool(), guest_id)
        .await?
        .ok_or(AppError::GuestNotFound)?;

    // Ensure guest belongs to the right event
    if guest.event_id != event_id {
        return Err(AppError::GuestNotFound);
    }

    Ok(Json(json!({
        "success": true,
        "data": GuestResponse::from(guest)
    })))
}

// ==============================================================================
// PUT /api/v1/events/:event_id/guests/:guest_id
// ==============================================================================

/// Update a guest's details
///
/// Request (all fields optional):
/// ```json
/// {
///   "table_number": "12",
///   "guest_category": "VIP",
///   "plus_one_allowed": true
/// }
/// ```
pub async fn update_guest(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, guest_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateGuestRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    assert_event_ownership(&state, event_id, org_id).await?;

    // Verify guest belongs to this event
    let existing = GuestRepository::get_by_id(state.db.pool(), guest_id)
        .await?
        .ok_or(AppError::GuestNotFound)?;

    if existing.event_id != event_id {
        return Err(AppError::GuestNotFound);
    }

    let updated = GuestRepository::update(state.db.pool(), guest_id, &payload).await?;

    Ok(Json(json!({
        "success": true,
        "data": GuestResponse::from(updated)
    })))
}

// ==============================================================================
// DELETE /api/v1/events/:event_id/guests/:guest_id
// ==============================================================================

/// Remove a guest from an event
pub async fn delete_guest(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, guest_id)): Path<(Uuid, Uuid)>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    assert_event_ownership(&state, event_id, org_id).await?;

    let existing = GuestRepository::get_by_id(state.db.pool(), guest_id)
        .await?
        .ok_or(AppError::GuestNotFound)?;

    if existing.event_id != event_id {
        return Err(AppError::GuestNotFound);
    }

    GuestRepository::delete(state.db.pool(), guest_id).await?;

    tracing::info!(
        event_id = %event_id,
        guest_id = %guest_id,
        "Guest removed from event"
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Guest removed successfully"
        })),
    ))
}

// ==============================================================================
// GET /api/v1/events/:event_id/guests/count
// ==============================================================================

/// Get total guest count for an event (lightweight endpoint for dashboard)
pub async fn guest_count(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    assert_event_ownership(&state, event_id, org_id).await?;

    let total = GuestRepository::count_by_event(state.db.pool(), event_id).await?;

    Ok(Json(json!({
        "success": true,
        "data": { "total": total }
    })))
}

// ==============================================================================
// POST /api/v1/events/:event_id/guests/import
// ==============================================================================

/// Import guests from CSV file
///
/// Expected CSV columns: full_name, phone, email, table_number, guest_category, plus_one_allowed, contact_method
/// Example:
/// full_name,phone,email,table_number,guest_category,plus_one_allowed,contact_method
/// "John Doe","+255700001001","john@example.com","5","VIP",true,whatsapp
/// "Jane Smith","+255700001002","jane@example.com","3","Regular",false,sms
///
/// Returns: { success: true, data: { imported: 2, skipped: 0, errors: [] } }
pub async fn import_guests_csv(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    mut multipart: Multipart,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    assert_event_ownership(&state, event_id, org_id).await?;

    // Extract CSV file from multipart
    let mut csv_data = None;
    while let Some(field) = multipart.next_field().await.map_err(|e| AppError::BadRequest(e.to_string()))? {
        if field.name() == Some("file") {
            let data = field.bytes().await.map_err(|e| AppError::BadRequest(e.to_string()))?;
            csv_data = Some(data);
            break;
        }
    }

    let csv_bytes = csv_data.ok_or_else(|| AppError::BadRequest("No CSV file provided".to_string()))?;
    let csv_str = String::from_utf8(csv_bytes.to_vec()).map_err(|_| AppError::BadRequest("Invalid UTF-8 in CSV".to_string()))?;

    let mut reader = ReaderBuilder::new()
        .has_headers(true)
        .trim(csv::Trim::All)
        .from_reader(Cursor::new(csv_str));

    let headers = reader.headers().map_err(|e| AppError::BadRequest(e.to_string()))?.clone();

    // Validate required columns
    let required = ["full_name", "phone"];
    for req in required {
        if !headers.iter().any(|h| h == req) {
            return Err(AppError::BadRequest(format!("Missing required column: {}", req)));
        }
    }

    let mut guests_to_import = Vec::new();
    let mut errors = Vec::new();
    let mut row_num = 1;

    for result in reader.deserialize() {
        row_num += 1;
        let record: Result<CreateGuestRequest, _> = result;
        match record {
            Ok(guest) => {
                // Validate
                if let Err(e) = guest.validate() {
                    errors.push(format!("Row {}: {}", row_num, e));
                    continue;
                }
                guests_to_import.push(guest);
            }
            Err(e) => {
                errors.push(format!("Row {}: {}", row_num, e));
            }
        }
    }

    if guests_to_import.is_empty() && errors.is_empty() {
        return Err(AppError::BadRequest("No valid guests found in CSV".to_string()));
    }

    // Bulk insert valid guests
    let mut imported = 0;
    let mut skipped = 0;
    let mut import_errors = Vec::new();

    for guest in guests_to_import {
        // Check for duplicate phone in this event
        let existing = GuestRepository::get_by_phone(state.db.pool(), event_id, &guest.phone).await?;
        if existing.is_some() {
            skipped += 1;
            import_errors.push(format!("Phone {} already exists in this event", guest.phone));
            continue;
        }

        match GuestRepository::create(state.db.pool(), event_id, &guest).await {
            Ok(_) => imported += 1,
            Err(e) => {
                skipped += 1;
                import_errors.push(format!("Failed to import guest {}: {}", guest.full_name, e));
            }
        }
    }

    Ok(Json(json!({
        "success": true,
        "data": {
            "imported": imported,
            "skipped": skipped,
            "errors": import_errors
        }
    })))
}

// ==============================================================================
// GET /api/v1/events/:event_id/guests/template
// ==============================================================================

/// Download CSV template for guest import
pub async fn download_guest_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<axum::response::Response> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    assert_event_ownership(&state, event_id, org_id).await?;

    let csv = "full_name,phone,email,whatsapp_phone,device_type,table_number,guest_category,plus_one_allowed,contact_method\nJohn Doe,+255700001001,john@example.com,+255700001001,smartphone,5,VIP,true,whatsapp\nJane Smith,+255700001002,jane@example.com,,feature_phone,3,Regular,false,sms\n";

    let filename = format!("guest_import_template_{}.csv", event_id);

    Ok(axum::response::Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/csv")
        .header("Content-Disposition", format!("attachment; filename=\"{}\"", filename))
        .body(csv.into())
        .unwrap())
}
