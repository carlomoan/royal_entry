// ==============================================================================
// FILE: src/handlers/guests.rs
// ==============================================================================
// HTTP handlers for Guests CRUD

use axum::{
    body::Body,
    extract::{Path, Query, State, Multipart},
    http::StatusCode,
    response::Response,
    Extension, Json,
};
use std::sync::Arc;
use serde::{Deserialize};
use serde_json::json;
use uuid::Uuid;
use validator::Validate;
use csv::ReaderBuilder;
use sqlx::Row;
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
    Json(mut payload): Json<CreateGuestRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    payload.phone = crate::models::guest::normalize_phone(&payload.phone);
    if let Some(whatsapp) = payload.whatsapp_phone.take() {
        payload.whatsapp_phone = Some(crate::models::guest::normalize_phone(&whatsapp));
    }
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

    // Every guest gets a check-in link (QR / entry token) automatically.
    crate::handlers::invitations::ensure_invitation(state.db.pool(), guest.id).await?;

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
    Json(mut payload): Json<CreateMultipleGuestsRequest>,
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

    // Normalise phones, then validate all guests before inserting any.
    for guest in payload.guests.iter_mut() {
        guest.phone = crate::models::guest::normalize_phone(&guest.phone);
        if let Some(whatsapp) = guest.whatsapp_phone.take() {
            guest.whatsapp_phone = Some(crate::models::guest::normalize_phone(&whatsapp));
        }
    }
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

    // Every guest gets a check-in link (QR / entry token) automatically.
    for guest in &guests {
        crate::handlers::invitations::ensure_invitation(state.db.pool(), guest.id).await?;
    }

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
#[derive(Debug, serde::Serialize)]
struct ImportRowError {
    row: usize,
    field: Option<String>,
    raw: String,
    message: String,
}

pub async fn import_guests_csv(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    mut multipart: Multipart,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let mut csv_data = None;
    while let Some(field) = multipart.next_field().await.map_err(|e| AppError::BadRequest(e.to_string()))? {
        if field.name() == Some("file") {
            csv_data = Some(field.bytes().await.map_err(|e| AppError::BadRequest(e.to_string()))?);
            break;
        }
    }
    let csv_bytes = csv_data.ok_or_else(|| AppError::BadRequest("No CSV file provided".to_string()))?;

    let mut reader = ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(Cursor::new(csv_bytes.to_vec()));

    let headers = reader.headers().map_err(|e| AppError::BadRequest(e.to_string()))?.clone();
    let header_names: Vec<String> = headers.iter().map(|h| h.trim().to_lowercase()).collect();
    for required in ["full_name", "phone"] {
        if !header_names.iter().any(|h| h == required) {
            return Err(AppError::BadRequest(format!(
                "Missing required column '{}'. Found: {:?}", required, header_names
            )));
        }
    }
    let idx = |name: &str| header_names.iter().position(|h| h == name);
    let name_i = idx("full_name").unwrap();
    let phone_i = idx("phone").unwrap();
    let email_i = idx("email");
    let whatsapp_i = idx("whatsapp_phone").or_else(|| idx("whatsapp"));
    let device_i = idx("device_type").or_else(|| idx("device"));
    let table_i = idx("table_number");
    let category_i = idx("guest_category").or_else(|| idx("category"));
    let plus_one_i = idx("plus_one_allowed").or_else(|| idx("plus_one"));
    let contact_i = idx("contact_method").or_else(|| idx("contact"));

    let mut candidates: Vec<(usize, CreateGuestRequest)> = Vec::new();
    let mut errors: Vec<ImportRowError> = Vec::new();
    let mut seen: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut total_rows = 0usize;
    let mut invalid_rows = 0usize;

    for result in reader.records() {
        total_rows += 1;
        let row = match result {
            Ok(r) => r,
            Err(e) => {
                invalid_rows += 1;
                errors.push(ImportRowError { row: total_rows, field: None, raw: String::new(), message: format!("CSV parse error: {}", e) });
                continue;
            }
        };
        let raw = row.iter().collect::<Vec<_>>().join(",");
        let get = |i: Option<usize>| -> Option<String> {
            i.and_then(|n| row.get(n)).map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
        };

        let full_name = get(Some(name_i)).unwrap_or_default();
        let raw_phone = get(Some(phone_i)).unwrap_or_default();
        let phone = crate::models::guest::normalize_phone(&raw_phone);

        let mut row_ok = true;
        if full_name.len() < 2 {
            errors.push(ImportRowError { row: total_rows, field: Some("full_name".into()), raw: raw.clone(), message: "Name is missing or too short".into() });
            row_ok = false;
        }
        if phone.len() < 10 || phone.len() > 15 || !phone.chars().all(|c| c.is_ascii_digit()) {
            errors.push(ImportRowError { row: total_rows, field: Some("phone".into()), raw: raw.clone(), message: format!("Invalid phone '{}' — use 785023234, 0785023234, 065023234 or +255785023234", raw_phone) });
            row_ok = false;
        }
        if !row_ok {
            invalid_rows += 1;
            continue;
        }

        if let Some(first_row) = seen.get(&phone) {
            errors.push(ImportRowError { row: total_rows, field: Some("phone".into()), raw: raw.clone(), message: format!("Duplicate phone in file — first seen on row {}", first_row) });
            invalid_rows += 1;
            continue;
        }
        seen.insert(phone.clone(), total_rows);

        let guest = CreateGuestRequest {
            full_name,
            phone,
            email: get(email_i),
            whatsapp_phone: get(whatsapp_i).map(|v| crate::models::guest::normalize_phone(&v)),
            device_type: get(device_i),
            table_number: get(table_i),
            guest_category: get(category_i),
            plus_one_allowed: get(plus_one_i).map(|v| v.eq_ignore_ascii_case("true") || v == "1" || v.eq_ignore_ascii_case("yes")),
            contact_method: get(contact_i),
        };
        if let Err(e) = guest.validate() {
            errors.push(ImportRowError { row: total_rows, field: None, raw: raw.clone(), message: format!("Validation failed: {}", e) });
            invalid_rows += 1;
            continue;
        }
        candidates.push((total_rows, guest));
    }

    let mut imported = 0usize;
    let mut duplicates = 0usize;
    let mut failed_rows = 0usize;
    for (row, guest) in candidates {
        if let Some(_existing) = GuestRepository::get_by_phone(state.db.pool(), event_id, &guest.phone).await? {
            duplicates += 1;
            errors.push(ImportRowError { row, field: Some("phone".into()), raw: guest.phone.clone(), message: "Phone already exists in this event".into() });
            continue;
        }
        match GuestRepository::create(state.db.pool(), event_id, &guest).await {
            Ok(created) => {
                imported += 1;
                let _ = crate::handlers::invitations::ensure_invitation(state.db.pool(), created.id).await;
            }
            Err(e) => {
                failed_rows += 1;
                errors.push(ImportRowError { row, field: None, raw: guest.phone.clone(), message: format!("Database error: {}", e) });
            }
        }
    }

    Ok(Json(json!({
        "success": true,
        "data": {
            "total_rows": total_rows,
            "imported": imported,
            "duplicates": duplicates,
            "invalid_rows": invalid_rows,
            "failed_rows": failed_rows,
            "skipped": duplicates + invalid_rows + failed_rows,
            "errors": errors,
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

#[derive(Debug, Deserialize)]
pub struct VerifyEmailQuery {
    pub token: String,
}

/// POST /api/v1/events/{eid}/guests/{id}/verify-email — send a verification email.
pub async fn send_email_verification(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, guest_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let row = sqlx::query("SELECT email, full_name FROM guests WHERE id = $1 AND event_id = $2")
        .bind(guest_id)
        .bind(event_id)
        .fetch_optional(state.db.pool())
        .await?
        .ok_or(AppError::GuestNotFound)?;
    let email: Option<String> = row.try_get("email").ok();
    let full_name: String = row.try_get("full_name").unwrap_or_default();
    let email = email
        .filter(|e| !e.trim().is_empty())
        .ok_or_else(|| AppError::BadRequest("Guest has no email address".to_string()))?;

    let token = format!("{}-{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    sqlx::query(
        "UPDATE guests SET email_verification_token = $1, updated_at = NOW() WHERE id = $2",
    )
    .bind(&token)
    .bind(guest_id)
    .execute(state.db.pool())
    .await?;

    let verify_url = format!(
        "{}/api/v1/public/verify-email?token={}",
        state.config.app.frontend_url.trim_end_matches('/'),
        token
    );
    let html = format!(
        "<div style=\"background:#f1f5f9;padding:24px;font-family:Arial,sans-serif;\"><div style=\"max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;\"><div style=\"background:#0a1628;padding:20px;text-align:center;\"><h1 style=\"color:#c9a84c;margin:0;font-size:20px;\">RoyalEntry</h1></div><div style=\"padding:24px;text-align:center;\"><p style=\"color:#334e68;\">Hi {full_name},</p><p style=\"color:#334e68;\">Please confirm your email address so you can receive invitations and updates.</p><a href=\"{verify_url}\" style=\"display:inline-block;background:#c9a84c;color:#0a1628;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px;\">Confirm Email</a></div></div></div>"
    );
    let _ = state
        .channels
        .email(&email, "Confirm your email — RoyalEntry", &html)
        .await;

    Ok(Json(json!({ "success": true, "message": "Verification email sent" })))
}

/// GET /api/v1/public/verify-email?token=... — confirm a guest's email.
pub async fn verify_guest_email(
    State(state): State<Arc<AppState>>,
    Query(query): Query<VerifyEmailQuery>,
) -> Result<Response, AppError> {
    let token = query.token.trim().to_string();
    if token.is_empty() {
        return Err(AppError::BadRequest("Missing token".to_string()));
    }
    let updated = sqlx::query(
        "UPDATE guests SET email_verified = TRUE, email_verification_token = NULL, updated_at = NOW() \
         WHERE email_verification_token = $1",
    )
    .bind(&token)
    .execute(&*state.db.pool())
    .await?;

    let html = if updated.rows_affected() > 0 {
        "<html><body style=\"font-family:Arial,sans-serif;text-align:center;padding:48px;background:#f1f5f9;\"><div style=\"max-width:420px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;\"><h1 style=\"color:#0a1628;\">Email verified &#10003;</h1><p style=\"color:#334e68;\">Thank you for confirming your email address.</p></div></body></html>"
    } else {
        "<html><body style=\"font-family:Arial,sans-serif;text-align:center;padding:48px;background:#f1f5f9;\"><div style=\"max-width:420px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;\"><h1 style=\"color:#b45309;\">Invalid or expired link</h1><p style=\"color:#334e68;\">This verification link is no longer valid.</p></div></body></html>"
    };
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/html")
        .body(Body::from(html))
        .unwrap())
}
