// ==============================================================================
// FILE: src/handlers/guests.rs
// ==============================================================================
// HTTP handlers for Guests CRUD

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension, Json,
};
use std::sync::Arc;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;
use validator::Validate;

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
