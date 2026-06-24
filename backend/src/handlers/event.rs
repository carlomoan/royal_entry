// ==============================================================================
// FILE: src/handlers/events.rs
// ==============================================================================
// HTTP handlers for Events CRUD

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension, Json,
};
use sqlx::Row;
use std::sync::Arc;
use serde_json::json;
use validator::Validate;
use crate::models::{PaginationMeta, PaginationQuery};
use crate::models::event::UpdateEventRequest;
use crate::{AppState, AppError, AppResult};
use crate::models::{Claims, CreateEventRequest, ActivateEventRequest, EventResponse};
use crate::repository::EventRepository;
use uuid::Uuid;
// ==============================================================================
// POST /api/v1/events
// ==============================================================================

/// Create a new event
///
/// Request:
/// ```json
/// {
///   "title": "Amina & Ahmed Wedding",
///   "event_date": "2025-06-15",
///   "venue_name": "Golden Tulip Hotel, Dar es Salaam",
///   "venue_address": "Ohio Street, Dar es Salaam",
///   "dress_code": "Black Tie",
///   "card_theme": "elegant",
///   "guest_count_expected": 300,
///   "rsvp_deadline": "2025-06-01"
/// }
/// ```
pub async fn create_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateEventRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    // Validate input
    payload.validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::InvalidToken)?;

    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    // Create event in database
    let event = EventRepository::create(
        state.db.pool(),
        org_id,
        user_id,
        &payload,
    )
    .await?;

    tracing::info!(
        user_id = %user_id,
        event_id = %event.id,
        title = %event.title,
        "Event created"
    );

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": EventResponse::from(event)
        })),
    ))
}

// ==============================================================================
// GET /api/v1/events
// ==============================================================================

/// List all events for the current organization
pub async fn list_events(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Query(pagination): Query<PaginationQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    let limit = pagination.limit();
    let offset = pagination.offset();
    let page = pagination.page.unwrap_or(1);
    let per_page = pagination.per_page.unwrap_or(20);

    let (events, total) = EventRepository::list_by_organization(
        state.db.pool(),
        org_id,
        limit,
        offset,
    )
    .await?;

    let event_responses: Vec<EventResponse> = events
        .into_iter()
        .map(EventResponse::from)
        .collect();

    Ok(Json(json!({
        "success": true,
        "data": event_responses,
        "pagination": PaginationMeta::new(page, per_page, total)
    })))
}

// ==============================================================================
// GET /api/v1/events/:id
// ==============================================================================

/// Get a single event by ID
pub async fn get_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;

    // Ensure event belongs to caller's organization
    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }

    Ok(Json(json!({
        "success": true,
        "data": EventResponse::from(event)
    })))
}

// ==============================================================================
// PUT /api/v1/events/:id
// ==============================================================================

/// Update an existing event
///
/// Request (all fields optional):
/// ```json
/// {
///   "venue_name": "Hyatt Regency Dar es Salaam",
///   "guest_count_expected": 350
/// }
/// ```
pub async fn update_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<UpdateEventRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    // Verify event exists and belongs to org
    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;

    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }

    // Can only update draft events
    if event.status == "active" || event.status == "completed" {
        return Err(AppError::BadRequest(
            "Cannot update an active or completed event".to_string(),
        ));
    }

    let updated = EventRepository::update(state.db.pool(), event_id, &payload).await?;

    Ok(Json(json!({
        "success": true,
        "data": EventResponse::from(updated)
    })))
}

// ==============================================================================
// POST /api/v1/events/:id/activate
// ==============================================================================

/// Activate an event (set entry window, start accepting scans)
///
/// Request:
/// ```json
/// {
///   "entry_start_time": "12:00:00",
///   "entry_end_time": "18:00:00"
/// }
/// ```
pub async fn activate_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<ActivateEventRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;

    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }

    // Must be approved to activate
    if event.approval_status != "approved" {
        return Err(AppError::BadRequest(
            "Event must be approved before activation".to_string(),
        ));
    }

    if event.status == "active" {
        return Err(AppError::Conflict("Event is already active".to_string()));
    }

    let activated = EventRepository::activate(
        state.db.pool(),
        event_id,
        payload.entry_start_time,
        payload.entry_end_time,
    )
    .await?;

    tracing::info!(event_id = %event_id, "Event activated");

    Ok(Json(json!({
        "success": true,
        "data": EventResponse::from(activated),
        "message": "Event activated successfully"
    })))
}

// ==============================================================================
// DELETE /api/v1/events/:id
// ==============================================================================

/// Soft delete an event
pub async fn delete_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;

    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }

    // Cannot delete active events
    if event.status == "active" {
        return Err(AppError::BadRequest(
            "Cannot delete an active event. Complete it first.".to_string(),
        ));
    }

    EventRepository::delete(state.db.pool(), event_id).await?;

    tracing::info!(event_id = %event_id, "Event deleted");

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "message": "Event deleted successfully"
        })),
    ))
}

// ==============================================================================
// GET /api/v1/events/:id/summary
// ==============================================================================

/// Get event with guest & arrival summary (for dashboard)
pub async fn get_event_summary(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;

    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }

    // Get aggregated stats from database
    let row = sqlx::query(
        r#"
        SELECT
            COUNT(DISTINCT g.id) as total_guests,
            COUNT(DISTINCT CASE WHEN i.status = 'scanned' THEN g.id END) as guests_arrived,
            COUNT(DISTINCT CASE WHEN r.response = 'confirmed' THEN g.id END) as rsvp_confirmed,
            COUNT(DISTINCT CASE WHEN r.response = 'declined' THEN g.id END) as rsvp_declined,
            COUNT(DISTINCT CASE WHEN i.status = 'sent' THEN g.id END) as invitations_sent,
            COALESCE(SUM(CASE WHEN pt.payment_status = 'paid' THEN pt.amount_paid ELSE 0 END), 0) as michango_collected
        FROM events e
        LEFT JOIN guests g ON e.id = g.event_id
        LEFT JOIN invitations i ON g.id = i.guest_id
        LEFT JOIN rsvp_responses r ON g.id = r.guest_id AND e.id = r.event_id
        LEFT JOIN pledge_tracker pt ON e.id = pt.event_id AND g.id = pt.guest_id
        WHERE e.id = $1
        "#,
    )
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "event": EventResponse::from(event),
            "summary": {
                "total_guests": row.try_get::<i64, _>("total_guests").unwrap_or(0),
                "guests_arrived": row.try_get::<i64, _>("guests_arrived").unwrap_or(0),
                "rsvp_confirmed": row.try_get::<i64, _>("rsvp_confirmed").unwrap_or(0),
                "rsvp_declined": row.try_get::<i64, _>("rsvp_declined").unwrap_or(0),
                "invitations_sent": row.try_get::<i64, _>("invitations_sent").unwrap_or(0),
                "michango_collected_tsh": row.try_get::<i64, _>("michango_collected").unwrap_or(0)
            }
        }
    })))
}
