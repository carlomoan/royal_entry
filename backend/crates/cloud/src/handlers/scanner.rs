use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::Row;
use url::Url;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{
        event::Event,
        scan::{CheckInRequest, CheckInResponse, ScanStatsResponse, ScanTimelinePoint},
        user::Claims,
    },
    repository::{event_repository::EventRepository, guest_repository::GuestRepository},
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct SendOtpRequest {
    pub short_link: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyOtpRequest {
    pub short_link: String,
    pub code: String,
}

#[derive(Debug, Serialize)]
pub struct OtpResponse {
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct VerifyOtpResponse {
    pub guest_id: Option<Uuid>,
    pub guest_name: String,
    pub verified: bool,
}

// Send OTP to a guest's phone for an SMS-link invitation (scanner role)
pub async fn send_otp(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<SendOtpRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let short_link = normalize_short_link(&payload.short_link);
    if short_link.is_empty() {
        return Err(AppError::ValidationError("short_link is required".to_string()));
    }

    // Look up the invitation + guest phone
    let row = sqlx::query(
        r#"
        SELECT g.id AS guest_id, g.full_name, g.phone
        FROM invitations i
        JOIN guests g ON g.id = i.guest_id
        WHERE i.short_link = $1 AND g.event_id = $2
        "#,
    )
    .bind(&short_link)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::InvitationNotFound)?;

    let guest_id: Uuid = row.try_get("guest_id").map_err(|_| AppError::GuestNotFound)?;
    let guest_name: String = row.try_get("full_name").unwrap_or_default();
    let guest_phone: String = row.try_get("phone").unwrap_or_default();

    if guest_phone.is_empty() {
        return Err(AppError::BadRequest("Guest has no phone number to send OTP".to_string()));
    }

    // Generate 6-digit OTP
    use rand::Rng;
    let code: u32 = rand::rng().random_range(100_000..999_999);
    let expires_at = Utc::now() + chrono::Duration::minutes(10);
    let otp_hash = format!("{:?}", Sha256::digest(code.to_string().as_bytes()));

    // Store OTP
    sqlx::query(
        r#"
        INSERT INTO otp_tokens (id, event_id, guest_id, invitation_short_link, otp_hash, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(guest_id)
    .bind(&short_link)
    .bind(&otp_hash)
    .bind(expires_at)
    .execute(state.db.pool())
    .await?;

    // Send the code via SMS
    let message = format!(
        "Your RoyalEntry entry code for {} is {}. It expires in 10 minutes.",
        guest_name, code
    );
    let _ = crate::services::MessagingService::new().send("sms", &guest_phone, &message).await;

    Ok(Json(json!({
        "success": true,
        "data": OtpResponse { message: "OTP sent to guest phone".to_string() }
    })))
}

// Verify an OTP (scanner role) — confirms guest identity and checks them in
pub async fn verify_otp(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<VerifyOtpRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let scanner_user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let short_link = normalize_short_link(&payload.short_link);
    let otp_hash = format!("{:?}", Sha256::digest(payload.code.trim().as_bytes()));
    let now = Utc::now();

    // Find valid, unexpired OTP
    let otp_row = sqlx::query(
        r#"
        SELECT id, guest_id, engaged_at
        FROM otp_tokens
        WHERE invitation_short_link = $1 AND event_id = $2 AND otp_hash = $3
          AND expires_at > $4 AND engaged_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(&short_link)
    .bind(event_id)
    .bind(&otp_hash)
    .bind(now)
    .fetch_optional(state.db.pool())
    .await?;

    let otp_id: Uuid = otp_row.as_ref().ok_or(AppError::BadRequest("Invalid or expired OTP".to_string()))?.try_get("id")?;
    let guest_id: Uuid = otp_row.as_ref().ok_or(AppError::BadRequest("Invalid or expired OTP".to_string()))?.try_get("guest_id")?;

    // Mark OTP as engaged
    sqlx::query("UPDATE otp_tokens SET engaged_at = NOW() WHERE id = $1")
        .bind(otp_id)
        .execute(state.db.pool())
        .await?;

    // Get guest + invitation
    let row = sqlx::query(
        r#"
        SELECT i.id AS invitation_id, g.full_name, i.status AS invitation_status
        FROM invitations i
        JOIN guests g ON g.id = i.guest_id
        WHERE i.short_link = $1 AND g.id = $2 AND g.event_id = $3
        "#,
    )
    .bind(&short_link)
    .bind(guest_id)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::InvitationNotFound)?;

    let invitation_id: Uuid = row.try_get("invitation_id")?;
    let guest_name: String = row.try_get("full_name").unwrap_or_default();
    let invitation_status: String = row.try_get("invitation_status").unwrap_or_default();

    if invitation_status == "scanned" {
        return Err(AppError::DuplicateScan);
    }

    // Enforce full pledge payment before check-in (only fully-paid guests get active cards)
    let pledge_status: Option<String> = sqlx::query_scalar(
        "SELECT payment_status FROM pledge_tracker WHERE event_id = $1 AND guest_id = $2",
    )
    .bind(event_id)
    .bind(guest_id)
    .fetch_optional(state.db.pool())
    .await?;

    if pledge_status.as_deref() != Some("paid") {
        return Err(AppError::BadRequest(
            "Guest pledge is not fully paid. Check-in card is inactive until full payment is received.".to_string(),
        ));
    }

    // Enforce the check-in window (entry_start_time .. entry_end_time)
    enforce_check_in_window(&state, event_id).await?;

    // Record entry scan
    let scanned_at = Utc::now();
    sqlx::query(
        r#"
        INSERT INTO entry_scans (id, event_id, guest_id, invitation_id, scanned_by_user_id, scanned_at, scan_source, notes)
        VALUES ($1, $2, $3, $4, $5, $6, 'otp', $7)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(guest_id)
    .bind(invitation_id)
    .bind(scanner_user_id)
    .bind(scanned_at)
    .bind(Some(format!("OTP verified: {}", payload.code)))
    .execute(state.db.pool())
    .await?;

    sqlx::query(
        "UPDATE invitations SET status = 'scanned', scan_count = scan_count + 1, last_scanned_at = $2 WHERE id = $1"
    )
    .bind(invitation_id)
    .bind(scanned_at)
    .execute(state.db.pool())
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": VerifyOtpResponse {
            guest_id: Some(guest_id),
            guest_name,
            verified: true,
        }
    })))
}

async fn assert_event_ownership(
    state: &Arc<AppState>,
    event_id: Uuid,
    org_id: Uuid,
) -> AppResult<Event> {
    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;

    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }

    Ok(event)
}

/// Enforce the check-in window. QR codes / SMS links are only active between
/// the event's entry_start_time and entry_end_time (set at activation).
async fn enforce_check_in_window(state: &Arc<AppState>, event_id: Uuid) -> AppResult<()> {
    let row = sqlx::query(
        "SELECT event_date, entry_start_time, entry_end_time, status FROM events WHERE id = $1",
    )
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::EventNotFound)?;

    let status: String = row.try_get("status").unwrap_or_default();
    if status != "active" {
        return Err(AppError::BadRequest(
            "Check-in is not active. The event has not been activated yet.".to_string(),
        ));
    }

    let entry_start: Option<String> = row.try_get("entry_start_time").ok();
    let entry_end: Option<String> = row.try_get("entry_end_time").ok();

    // If no window is configured, allow check-in (backwards compatible).
    let (Some(start), Some(end)) = (entry_start, entry_end) else {
        return Ok(());
    };

    let now = Utc::now().naive_utc();
    let parse = |t: &str| {
        chrono::NaiveTime::parse_from_str(t, "%H:%M")
            .or_else(|_| chrono::NaiveTime::parse_from_str(t, "%H:%M:%S"))
            .ok()
    };

    let (Some(start_t), Some(end_t)) = (parse(&start), parse(&end)) else {
        return Ok(());
    };

    let now_t = now.time();
    if now_t < start_t || now_t > end_t {
        return Err(AppError::BadRequest(format!(
            "Check-in is only allowed between {} and {} (event check-in window).",
            start, end
        )));
    }

    Ok(())
}

fn normalize_short_link(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if let Ok(url) = Url::parse(trimmed) {
        if let Some((_, value)) = url
            .query_pairs()
            .find(|(key, _)| key == "code" || key == "token" || key == "short_link")
        {
            return value.into_owned();
        }

        if let Some(segment) = url
            .path_segments()
            .and_then(|segments| segments.filter(|segment| !segment.is_empty()).next_back())
        {
            return segment.to_string();
        }
    }

    if let Some((_, value)) = url::form_urlencoded::parse(trimmed.as_bytes())
        .find(|(key, _)| key == "code" || key == "token" || key == "short_link")
    {
        return value.into_owned();
    }

    trimmed
        .trim_end_matches('/')
        .split('/')
        .next_back()
        .unwrap_or(trimmed)
        .split('?')
        .next()
        .unwrap_or(trimmed)
        .to_string()
}

pub async fn check_in_guest(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<CheckInRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let scanner_user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let short_link = normalize_short_link(&payload.short_link);
    if short_link.is_empty() {
        return Err(AppError::ValidationError("short_link is required".to_string()));
    }

    let row = sqlx::query(
        r#"
        SELECT
            i.id AS invitation_id,
            i.status AS invitation_status,
            g.id AS guest_id,
            g.full_name,
            g.phone,
            g.guest_category,
            g.table_number
        FROM invitations i
        JOIN guests g ON g.id = i.guest_id
        WHERE i.short_link = $1 AND g.event_id = $2
        "#,
    )
    .bind(&short_link)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::InvitationNotFound)?;

    let invitation_id: Uuid = row.try_get("invitation_id").map_err(|_| AppError::InvitationNotFound)?;
    let invitation_status: String = row.try_get("invitation_status").unwrap_or_else(|_| "pending".to_string());
    let guest_id: Uuid = row.try_get("guest_id").map_err(|_| AppError::GuestNotFound)?;
    let guest_name: String = row.try_get("full_name").unwrap_or_default();
    let guest_phone: String = row.try_get("phone").unwrap_or_default();
    let guest_category: Option<String> = row.try_get("guest_category").ok();
    let table_number: Option<String> = row.try_get("table_number").ok();

    if invitation_status == "scanned" {
        return Err(AppError::DuplicateScan);
    }

    // Enforce full pledge payment before check-in (only fully-paid guests get active cards)
    let pledge_status: Option<String> = sqlx::query_scalar(
        "SELECT payment_status FROM pledge_tracker WHERE event_id = $1 AND guest_id = $2",
    )
    .bind(event_id)
    .bind(guest_id)
    .fetch_optional(state.db.pool())
    .await?;

    if pledge_status.as_deref() != Some("paid") {
        return Err(AppError::BadRequest(
            "Guest pledge is not fully paid. Check-in card is inactive until full payment is received.".to_string(),
        ));
    }

    // Enforce the check-in window (entry_start_time .. entry_end_time)
    enforce_check_in_window(&state, event_id).await?;

    let scanned_at = Utc::now();
    let scan_source = payload.scan_source.unwrap_or_else(|| "qr".to_string());

    sqlx::query(
        r#"
        INSERT INTO entry_scans (
            id, event_id, guest_id, invitation_id, scanned_by_user_id,
            scanned_at, scan_source, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(guest_id)
    .bind(invitation_id)
    .bind(scanner_user_id)
    .bind(scanned_at)
    .bind(scan_source)
    .bind(payload.notes)
    .execute(state.db.pool())
    .await?;

    sqlx::query(
        r#"
        UPDATE invitations
        SET status = 'scanned',
            scan_count = scan_count + 1,
            last_scanned_at = $2
        WHERE id = $1
        "#,
    )
    .bind(invitation_id)
    .bind(scanned_at)
    .execute(state.db.pool())
    .await?;

    let response = CheckInResponse {
        guest_id,
        guest_name,
        guest_phone,
        guest_category,
        table_number,
        invitation_id,
        scanned_at,
        status: "scanned".to_string(),
    };

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": response,
        })),
    ))
}

pub async fn scan_stats(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let total_guests = GuestRepository::count_by_event(state.db.pool(), event_id).await?;

    let arrived: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(DISTINCT guest_id)
        FROM entry_scans
        WHERE event_id = $1
        "#,
    )
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;

    let timeline_rows = sqlx::query(
        r#"
        SELECT TO_CHAR(DATE_TRUNC('hour', scanned_at), 'HH24:00') AS hour, COUNT(*) AS count
        FROM entry_scans
        WHERE event_id = $1
        GROUP BY DATE_TRUNC('hour', scanned_at)
        ORDER BY DATE_TRUNC('hour', scanned_at)
        "#,
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;

    let timeline = timeline_rows
        .into_iter()
        .map(|row| ScanTimelinePoint {
            hour: row.try_get("hour").unwrap_or_else(|_| "00:00".to_string()),
            count: row.try_get("count").unwrap_or(0),
        })
        .collect();

    let pending = (total_guests - arrived).max(0);
    let arrival_rate_percent = if total_guests > 0 {
        (arrived * 100) / total_guests
    } else {
        0
    };

    let response = ScanStatsResponse {
        total_guests,
        arrived,
        pending,
        arrival_rate_percent,
        timeline,
    };

    Ok(Json(json!({
        "success": true,
        "data": response,
    })))
}
