// ==============================================================================
// FILE: crates/cloud/src/handlers/booking_registration.rs
// ==============================================================================
// Company contact self-service: verify their email, register attendee names
// against unnamed passes, and receive the issued check-in credentials.
// ==============================================================================
use axum::{extract::{Path, Query, State}, Extension, Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    handlers::card_issuing::send_checkin_credentials,
    models::{corporate::Booking, user::Claims},
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct VerifyQuery {
    pub token: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterNamesRequest {
    pub passes: Vec<PassName>,
}

#[derive(Debug, Deserialize)]
pub struct PassName {
    pub guest_id: Uuid,
    pub full_name: String,
    pub phone: String,
    pub email: Option<String>,
}

#[derive(Debug, Serialize)]
struct PublicPass {
    guest_id: Uuid,
    full_name: String,
    pass_state: String,
    table_number: Option<String>,
    package_name: Option<String>,
}

async fn load_booking(state: &Arc<AppState>, token: &str) -> AppResult<(Booking, Uuid, String)> {
    let row = sqlx::query(
        r#"SELECT b.*, e.id AS event_id, e.title AS event_title
           FROM bookings b JOIN events e ON e.id = b.event_id
           WHERE b.registration_token = $1 AND e.deleted_at IS NULL"#,
    )
    .bind(token)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Booking link not found".to_string()))?;
    let booking = Booking {
        id: row.try_get("id")?,
        event_id: row.try_get("event_id")?,
        company_name: row.try_get("company_name")?,
        contact_person: row.try_get("contact_person")?,
        contact_phone: row.try_get("contact_phone")?,
        contact_email: row.try_get("contact_email").ok(),
        payment_reference: row.try_get("payment_reference").ok(),
        proof_file_id: row.try_get("proof_file_id").ok(),
        amount_paid: row.try_get("amount_paid")?,
        confirmed_at: row.try_get("confirmed_at").ok(),
        notes: row.try_get("notes").ok(),
        created_by: row.try_get("created_by").ok(),
        workflow_status: row.try_get("workflow_status").unwrap_or_else(|_| "requested".into()),
        registration_token: row.try_get("registration_token").ok(),
        contact_email_verified_at: row.try_get("contact_email_verified_at").ok(),
        contact_verification_token: row.try_get("contact_verification_token").ok(),
        contact_email_is_free: row.try_get("contact_email_is_free").unwrap_or(false),
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    };
    Ok((booking, row.try_get("event_id")?, row.try_get("event_title")?))
}

/// GET /api/v1/public/bookings/{token} — contact's registration page data.
pub async fn booking_info(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let (booking, event_id, event_title) = load_booking(&state, &token).await?;
    let passes = sqlx::query(
        r#"SELECT g.id AS guest_id, g.full_name, g.pass_state, g.table_number, p.name AS package_name
           FROM guests g LEFT JOIN event_packages p ON p.id = g.package_id
           WHERE g.booking_id = $1 ORDER BY g.full_name"#,
    )
    .bind(booking.id)
    .fetch_all(state.db.pool())
    .await?
    .into_iter()
    .map(|r| PublicPass {
        guest_id: r.try_get("guest_id").unwrap_or_default(),
        full_name: r.try_get("full_name").unwrap_or_default(),
        pass_state: r.try_get("pass_state").unwrap_or_else(|_| "unnamed".into()),
        table_number: r.try_get("table_number").ok(),
        package_name: r.try_get("package_name").ok(),
    })
    .collect::<Vec<_>>();

    Ok(Json(json!({
        "success": true,
        "data": {
            "booking_id": booking.id,
            "company_name": booking.company_name,
            "contact_person": booking.contact_person,
            "event_id": event_id,
            "event_title": event_title,
            "workflow_status": booking.workflow_status,
            "contact_email_verified": booking.contact_email_verified_at.is_some(),
            "contact_email_is_free": booking.contact_email_is_free,
            "passes": passes,
        }
    })))
}

/// GET /api/v1/public/bookings/{token}/verify?token=... — confirm contact email.
pub async fn verify_contact_email(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
    Query(query): Query<VerifyQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let (booking, _, _) = load_booking(&state, &token).await?;
    let expected = booking
        .contact_verification_token
        .as_deref()
        .ok_or(AppError::BadRequest("No verification was requested".to_string()))?;
    if expected != query.token.trim() {
        return Err(AppError::BadRequest("Invalid verification link".to_string()));
    }
    sqlx::query(
        "UPDATE bookings SET contact_email_verified_at = NOW(), contact_verification_token = NULL, updated_at = NOW() WHERE id = $1",
    )
    .bind(booking.id)
    .execute(state.db.pool())
    .await?;
    sqlx::query(
        "INSERT INTO pass_audit (id, event_id, booking_id, action, details) VALUES ($1,$2,$3,'contact_verified','{}')",
    )
    .bind(Uuid::new_v4())
    .bind(booking.event_id)
    .bind(booking.id)
    .execute(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "message": "Contact email verified" })))
}

/// POST /api/v1/public/bookings/{token}/names — register attendee names.
pub async fn register_names(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
    Json(payload): Json<RegisterNamesRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let (booking, event_id, _) = load_booking(&state, &token).await?;
    if booking.contact_email_verified_at.is_none() {
        return Err(AppError::BadRequest(
            "Verify your email address before registering names".to_string(),
        ));
    }
    if booking.confirmed_at.is_none() {
        return Err(AppError::BadRequest(
            "Payment must be confirmed before names can be registered".to_string(),
        ));
    }
    let event = crate::repository::event_repository::EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if let Some(cutoff) = event.name_cutoff_at {
        if chrono::Utc::now() > cutoff {
            return Err(AppError::BadRequest(
                "The name registration deadline has passed. Contact the organizer.".to_string(),
            ));
        }
    }
    if payload.passes.is_empty() {
        return Err(AppError::ValidationError("No passes supplied".to_string()));
    }

    let mut updated = 0;
    for pass in &payload.passes {
        let state_row: Option<String> = sqlx::query_scalar(
            "SELECT pass_state FROM guests WHERE id = $1 AND booking_id = $2",
        )
        .bind(pass.guest_id)
        .bind(booking.id)
        .fetch_optional(state.db.pool())
        .await?;
        match state_row.as_deref() {
            Some("unnamed") | Some("issued") => {}
            _ => continue, // revoked or not part of this booking
        }
        if pass.full_name.trim().is_empty() || pass.phone.trim().is_empty() {
            return Err(AppError::ValidationError(
                "Each attendee needs a name and phone number".to_string(),
            ));
        }
        sqlx::query(
            r#"UPDATE guests SET full_name = $1, phone = $2, email = $3,
                   pass_state = 'named', named_at = NOW(), updated_at = NOW()
               WHERE id = $4 AND booking_id = $5"#,
        )
        .bind(pass.full_name.trim())
        .bind(pass.phone.trim())
        .bind(pass.email.as_deref())
        .bind(pass.guest_id)
        .bind(booking.id)
        .execute(state.db.pool())
        .await?;
        sqlx::query(
            "INSERT INTO pass_audit (id, event_id, booking_id, guest_id, action, details) VALUES ($1,$2,$3,$4,'pass_named',$5)",
        )
        .bind(Uuid::new_v4())
        .bind(event_id)
        .bind(booking.id)
        .bind(pass.guest_id)
        .bind(json!({"full_name": pass.full_name, "phone": pass.phone}))
        .execute(state.db.pool())
        .await?;
        let _ = send_checkin_credentials(&state, &event, pass.guest_id).await;
        updated += 1;
    }

    sqlx::query(
        "UPDATE bookings SET workflow_status = 'names_registered', updated_at = NOW() WHERE id = $1",
    )
    .bind(booking.id)
    .execute(state.db.pool())
    .await?;

    Ok(Json(json!({ "success": true, "data": { "named": updated } })))
}

/// POST /api/v1/events/{eid}/bookings/{bid}/send-verification
pub async fn send_verification(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, booking_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = crate::repository::event_repository::EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }
    let booking = sqlx::query_as::<_, Booking>(
        "SELECT * FROM bookings WHERE id = $1 AND event_id = $2",
    )
    .bind(booking_id)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Booking not found".to_string()))?;
    let email = booking
        .contact_email
        .as_deref()
        .filter(|e| !e.is_empty())
        .ok_or(AppError::BadRequest("Booking has no contact email".to_string()))?;

    let verify_token = Uuid::new_v4().simple().to_string();
    sqlx::query("UPDATE bookings SET contact_verification_token = $1, updated_at = NOW() WHERE id = $2")
        .bind(&verify_token)
        .bind(booking_id)
        .execute(state.db.pool())
        .await?;
    let link = format!(
        "{}/api/v1/public/bookings/{}/verify?token={}",
        state.config.app.frontend_url.trim_end_matches('/'),
        booking.registration_token.as_deref().unwrap_or(""),
        verify_token
    );
    let html = crate::services::channels::html_wrap(&format!(
        "<p>Dear {},</p><p>Please verify your email for the {} booking with {}.</p><p><a href=\"{}\">Verify email</a></p>",
        booking.contact_person, event.title, booking.company_name, link
    ));
    state
        .channels
        .email(email, &format!("Verify your email — {}", event.title), &html)
        .await
        .map_err(|e| AppError::EmailError(e.to_string()))?;

    Ok(Json(json!({ "success": true, "message": "Verification email sent" })))
}
