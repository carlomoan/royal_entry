use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, Utc};
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
    pub gate: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OverrideCheckInRequest {
    pub short_link: String,
    pub reason: String,
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
    let event = assert_event_ownership(&state, event_id, org_id).await?;

    let short_link = normalize_short_link(&payload.short_link);
    if short_link.is_empty() {
        return Err(AppError::ValidationError("short_link is required".to_string()));
    }

    let row = sqlx::query(
        r#"
        SELECT g.id AS guest_id, g.full_name, g.phone, g.email, g.device_type
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
    let guest_email: Option<String> = row.try_get("email").ok();
    let device_type: String = row.try_get("device_type").unwrap_or_default();

    let phone = guest_phone.trim().to_string();
    let email = guest_email
        .map(|e| e.trim().to_string())
        .filter(|e| !e.is_empty());
    if phone.is_empty() && email.is_none() {
        return Err(AppError::BadRequest(
            "Guest has no phone or email to send the OTP".to_string(),
        ));
    }

    // Throttle: every OTP costs money (SMS) and widens the guessing window.
    let last_minute: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM otp_tokens WHERE event_id = $1 AND invitation_short_link = $2 \
         AND created_at > NOW() - INTERVAL '60 seconds'",
    )
    .bind(event_id)
    .bind(&short_link)
    .fetch_one(state.db.pool())
    .await?;
    if last_minute > 0 {
        return Err(AppError::BadRequest(
            "A code was just sent to this guest. Wait a minute before requesting another."
                .to_string(),
        ));
    }
    let last_ten_minutes: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM otp_tokens WHERE event_id = $1 AND invitation_short_link = $2 \
         AND created_at > NOW() - INTERVAL '10 minutes'",
    )
    .bind(event_id)
    .bind(&short_link)
    .fetch_one(state.db.pool())
    .await?;
    if last_ten_minutes >= 3 {
        return Err(AppError::BadRequest(
            "Too many codes requested for this guest. Try again in a few minutes.".to_string(),
        ));
    }

    // A new code replaces any earlier unused one.
    sqlx::query(
        "UPDATE otp_tokens SET expires_at = NOW() \
         WHERE event_id = $1 AND invitation_short_link = $2 \
           AND engaged_at IS NULL AND expires_at > NOW()",
    )
    .bind(event_id)
    .bind(&short_link)
    .execute(state.db.pool())
    .await?;

    use rand::Rng;
    let code: u32 = rand::rng().random_range(100_000..1_000_000);
    let expires_at = Utc::now() + chrono::Duration::minutes(10);
    // Same hash format as verify_otp (do not change one without the other).
    let otp_hash = format!("{:?}", Sha256::digest(code.to_string().as_bytes()));
    let otp_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO otp_tokens (id, event_id, guest_id, invitation_short_link, otp_hash, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        "#,
    )
    .bind(otp_id)
    .bind(event_id)
    .bind(guest_id)
    .bind(&short_link)
    .bind(&otp_hash)
    .bind(expires_at)
    .execute(state.db.pool())
    .await?;

    // Short, plain-ASCII text so it fits one SMS unit (160 characters).
    let title: String = event.title.chars().take(40).collect();
    let sms_text = format!(
        "Msimbo wako wa kuingia {}: {}. Unaisha baada ya dakika 10.",
        title, code
    );

    let (subject, html) = if email.is_some() {
        let check_in_link = format!(
            "{}/g/{}",
            state.config.app.frontend_url.trim_end_matches('/'),
            short_link
        );
        let subject = format!("Your {} Check-in Code: {}", event.title, code);
        let html = crate::services::TemplateService::new(state.clone())
            .render_template(
                "otp_verification",
                json!({
                    "guest_name": guest_name,
                    "event_title": event.title,
                    "otp_code": code.to_string(),
                    "expires_at": expires_at.format("%H:%M").to_string(),
                    "check_in_link": check_in_link,
                }),
            )
            .await
            .unwrap_or_else(|_| {
                format!(
                    "<p>Dear {guest_name}, your check-in code for {} is <strong>{}</strong>. It expires in 10 minutes.</p>",
                    event.title, code
                )
            });
        (subject, html)
    } else {
        (String::new(), String::new())
    };

    // Feature phones cannot read email: SMS first. Smartphones: email first.
    let sms_first = device_type == "feature_phone" || email.is_none();
    let order: [&str; 2] = if sms_first { ["sms", "email"] } else { ["email", "sms"] };

    let mut delivered_via: Option<&str> = None;
    for ch in order {
        let result: AppResult<()> = match ch {
            "sms" if !phone.is_empty() => state
                .channels
                .sms(&[phone.clone()], &sms_text)
                .await
                .map(|_| ()),
            "email" if email.is_some() => state
                .channels
                .email(email.as_deref().unwrap_or_default(), &subject, &html)
                .await
                .map(|_| ()),
            _ => continue,
        };
        match result {
            Ok(()) => {
                delivered_via = Some(ch);
                break;
            }
            Err(e) => {
                tracing::warn!(guest_id = %guest_id, channel = ch, error = %e, "OTP delivery failed");
            }
        }
    }

    let Some(via) = delivered_via else {
        let _ = sqlx::query("UPDATE otp_tokens SET expires_at = NOW() WHERE id = $1")
            .bind(otp_id)
            .execute(state.db.pool())
            .await;
        return Err(AppError::BadRequest(
            "Could not deliver the code to this guest. Check their phone number or email, or use another check-in method."
                .to_string(),
        ));
    };

    // Make the OTP preview visible in the event's Messages view, with the
    // code attached so it can be read without a live SMS provider.
    match via {
        "sms" => {
            state
                .channels
                // Never persist a real OTP code — even a sandbox preview must
                // not become a bearer credential.
                .annotate_last_sandbox(&phone, "sms", event_id, guest_id, None, Some("******"))
                .await;
        }
        "email" => {
            if let Some(to) = email.as_deref() {
                state
                    .channels
                    .record_preview(
                        event_id,
                        guest_id,
                        "email",
                        to,
                        Some(&subject),
                        "Your check-in code is ******. It expires in 10 minutes.",
                        None,
                        Some("******"),
                        None,
                    )
                    .await;
            }
        }
        _ => {}
    }

    tracing::info!(guest_id = %guest_id, channel = via, "OTP sent");
    Ok(Json(json!({
        "success": true,
        "data": OtpResponse { message: format!("Code sent by {via}") }
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
    let event = assert_event_ownership(&state, event_id, org_id).await?;

    let short_link = normalize_short_link(&payload.short_link);
    let otp_hash = format!("{:?}", Sha256::digest(payload.code.trim().as_bytes()));
    let now = Utc::now();

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

    let otp_row = otp_row.ok_or(AppError::BadRequest("Invalid or expired OTP".to_string()))?;
    let otp_id: Uuid = otp_row.try_get("id")?;
    let guest_id: Uuid = otp_row.try_get("guest_id")?;

    // Mark OTP as engaged before any other work so it cannot be replayed.
    sqlx::query("UPDATE otp_tokens SET engaged_at = NOW() WHERE id = $1")
        .bind(otp_id)
        .execute(state.db.pool())
        .await?;

    let guest = load_scan_guest(&state, event_id, &short_link)
        .await?
        .ok_or(AppError::InvitationNotFound)?;
    if guest.guest_id != guest_id {
        return Err(AppError::BadRequest("Invalid or expired OTP".to_string()));
    }
    if guest.pass_state == "revoked" {
        return Err(AppError::BadRequest(
            "This pass has been revoked and can no longer be used at the gate".to_string(),
        ));
    }
    if guest.entries_used >= i64::from(guest.party_size.max(1)) {
        return Err(AppError::DuplicateScan);
    }
    ensure_card_active(&state, &event, &guest).await?;
    enforce_check_in_window(&state, event_id).await?;

    perform_check_in(
        &state,
        &guest,
        scanner_user_id,
        "otp",
        Some(format!("OTP verified: {}", payload.code)),
        payload.gate.as_deref(),
    )
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": VerifyOtpResponse {
            guest_id: Some(guest.guest_id),
            guest_name: guest.full_name,
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

// ── Shared check-in helpers ──────────────────────────────────────────────────

struct ScanGuest {
    event_id: Uuid,
    invitation_id: Uuid,
    guest_id: Uuid,
    full_name: String,
    phone: String,
    guest_category: Option<String>,
    table_number: Option<String>,
    seat_number: Option<String>,
    party_size: i32,
    device_type: String,
    card_issued_at: Option<DateTime<Utc>>,
    pass_state: String,
    booking_id: Option<Uuid>,
    last_scan_at: Option<DateTime<Utc>>,
    last_gate: Option<String>,
    company_name: Option<String>,
    package_name: Option<String>,
    entries_used: i64,
}

async fn load_scan_guest(
    state: &Arc<AppState>,
    event_id: Uuid,
    short_link: &str,
) -> AppResult<Option<ScanGuest>> {
    let row = sqlx::query(
        r#"
        SELECT i.id AS invitation_id, g.id AS guest_id, g.full_name, g.phone,
               g.guest_category, g.table_number, g.seat_number, g.party_size,
               g.device_type, g.card_issued_at, g.pass_state, g.booking_id,
               b.company_name, p.name AS package_name,
               (SELECT COUNT(*) FROM entry_scans es WHERE es.guest_id = g.id)::BIGINT AS entries_used,
               (SELECT scanned_at FROM entry_scans es WHERE es.guest_id = g.id ORDER BY scanned_at DESC LIMIT 1) AS last_scan_at,
               (SELECT gate FROM entry_scans es WHERE es.guest_id = g.id ORDER BY scanned_at DESC LIMIT 1) AS last_gate
        FROM invitations i
        JOIN guests g ON g.id = i.guest_id
        LEFT JOIN bookings b ON b.id = g.booking_id
        LEFT JOIN event_packages p ON p.id = g.package_id
        WHERE i.short_link = $1 AND g.event_id = $2
        "#,
    )
    .bind(short_link)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?;

    Ok(row.map(|row| ScanGuest {
        event_id,
        invitation_id: row.try_get("invitation_id").unwrap_or_default(),
        guest_id: row.try_get("guest_id").unwrap_or_default(),
        full_name: row.try_get("full_name").unwrap_or_default(),
        phone: row.try_get("phone").unwrap_or_default(),
        guest_category: row.try_get("guest_category").ok(),
        table_number: row.try_get("table_number").ok(),
        seat_number: row.try_get("seat_number").ok(),
        party_size: row.try_get("party_size").unwrap_or(1),
        device_type: row.try_get("device_type").unwrap_or_default(),
        card_issued_at: row.try_get("card_issued_at").ok().flatten(),
        pass_state: row.try_get("pass_state").unwrap_or_else(|_| "unnamed".into()),
        booking_id: row.try_get("booking_id").ok(),
        last_scan_at: row.try_get("last_scan_at").ok().flatten(),
        last_gate: row.try_get("last_gate").ok().flatten(),
        company_name: row.try_get("company_name").ok(),
        package_name: row.try_get("package_name").ok(),
        entries_used: row.try_get("entries_used").unwrap_or(0),
    }))
}

/// A card must be active before it can be used at the gate. If the policy now
/// allows it, issue it on the spot; otherwise explain why it is unavailable.
async fn ensure_card_active(
    state: &Arc<AppState>,
    event: &Event,
    guest: &ScanGuest,
) -> AppResult<()> {
    if guest.card_issued_at.is_some() {
        return Ok(());
    }
    if crate::handlers::card_issuing::is_eligible_for_card(state.db.pool(), event, guest.guest_id)
        .await?
    {
        sqlx::query("UPDATE guests SET card_issued_at = NOW(), updated_at = NOW() WHERE id = $1")
            .bind(guest.guest_id)
            .execute(state.db.pool())
            .await?;
        return Ok(());
    }
    Err(AppError::BadRequest(
        "Check-in card is not available yet — complete the pledge or ask the family to approve it."
            .to_string(),
    ))
}

fn otp_required_for(event: &Event, device_type: &str, corporate_pass: bool) -> bool {
    // Controlled/Maximum corporate passes always require OTP, regardless of
    // the event's general otp_mode. A forwarded QR is useless without it.
    if corporate_pass && matches!(event.pass_security_level.as_str(), "controlled" | "maximum") {
        return true;
    }
    match event.otp_mode.as_str() {
        "all" => true,
        "feature_phone_only" => device_type == "feature_phone",
        _ => false,
    }
}

async fn has_verified_otp(state: &Arc<AppState>, event_id: Uuid, guest_id: Uuid) -> AppResult<bool> {
    Ok(sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM otp_tokens
            WHERE event_id = $1 AND guest_id = $2 AND engaged_at IS NOT NULL
              AND engaged_at > NOW() - INTERVAL '10 minutes'
        )
        "#,
    )
    .bind(event_id)
    .bind(guest_id)
    .fetch_one(state.db.pool())
    .await?)
}

/// Record one entry for a guest. A card can be scanned up to `party_size`
/// times so a couple on one card can enter separately.
async fn perform_check_in(
    state: &Arc<AppState>,
    guest: &ScanGuest,
    scanner_user_id: Uuid,
    scan_source: &str,
    notes: Option<String>,
    gate: Option<&str>,
) -> AppResult<CheckInResponse> {
    let scanned_at = Utc::now();
    let entries_used = guest.entries_used + 1;

    sqlx::query(
        r#"
        INSERT INTO entry_scans (
            id, event_id, guest_id, invitation_id, scanned_by_user_id,
            scanned_at, scan_source, notes, gate
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(guest.event_id)
    .bind(guest.guest_id)
    .bind(guest.invitation_id)
    .bind(scanner_user_id)
    .bind(scanned_at)
    .bind(scan_source)
    .bind(notes)
    .bind(gate)
    .execute(state.db.pool())
    .await?;

    // Keep the invitation status in sync: only mark it scanned once every
    // person on the card has entered.
    let invitation_status = if entries_used >= i64::from(guest.party_size.max(1)) {
        "scanned"
    } else {
        "viewed"
    };
    sqlx::query(
        "UPDATE invitations SET status = $2, scan_count = scan_count + 1, last_scanned_at = $3 WHERE id = $1",
    )
    .bind(guest.invitation_id)
    .bind(invitation_status)
    .bind(scanned_at)
    .execute(state.db.pool())
    .await?;

    // Delivery can be slow; the scan is already committed, so don't make the
    // gate operator wait for an SMS provider before showing the result.
    let arrival_state = state.clone();
    let arrival_event_id = guest.event_id;
    let arrival_guest_id = guest.guest_id;
    tokio::spawn(async move {
        crate::handlers::arrival::send_arrival_sms(&arrival_state, arrival_event_id, arrival_guest_id)
            .await;
    });

    Ok(CheckInResponse {
        guest_id: guest.guest_id,
        guest_name: guest.full_name.clone(),
        guest_phone: guest.phone.clone(),
        guest_category: guest.guest_category.clone(),
        table_number: guest.table_number.clone(),
        seat_number: guest.seat_number.clone(),
        party_size: guest.party_size,
        entries_used: entries_used as i32,
        company_name: guest.company_name.clone(),
        package_name: guest.package_name.clone(),
        invitation_id: guest.invitation_id,
        scanned_at,
        status: "scanned".to_string(),
    })
}

pub async fn check_in_guest(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<CheckInRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let scanner_user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?;
    let event = assert_event_ownership(&state, event_id, org_id).await?;

    let short_link = normalize_short_link(&payload.short_link);
    if short_link.is_empty() {
        return Err(AppError::ValidationError("short_link is required".to_string()));
    }

    let guest = load_scan_guest(&state, event_id, &short_link)
        .await?
        .ok_or(AppError::InvitationNotFound)?;

    if guest.pass_state == "revoked" {
        return Err(AppError::BadRequest(
            "This pass has been revoked and can no longer be used at the gate".to_string(),
        ));
    }
    if guest.entries_used >= i64::from(guest.party_size.max(1)) {
        let when = guest
            .last_scan_at
            .map(|t| t.format("%H:%M").to_string())
            .unwrap_or_else(|| "an earlier scan".to_string());
        let gate = guest.last_gate.clone().unwrap_or_else(|| "the gate".to_string());
        return Err(AppError::AlreadyUsedAt(format!("at {when}, {gate}")));
    }
    ensure_card_active(&state, &event, &guest).await?;

    // Unnamed corporate passes may be used until the name cutoff; after it the
    // usher must capture the attendee's name before the entry is accepted.
    if guest.pass_state == "unnamed" && guest.booking_id.is_some() {
        if let Some(cutoff) = event.name_cutoff_at {
            if chrono::Utc::now() > cutoff {
                return Err(AppError::BadRequest(
                    "Name registration deadline passed. Capture the attendee name before check-in."
                        .to_string(),
                ));
            }
        }
    }

    if otp_required_for(&event, &guest.device_type, guest.booking_id.is_some())
        && !has_verified_otp(&state, event_id, guest.guest_id).await?
    {
        return Err(AppError::OtpRequired);
    }

    enforce_check_in_window(&state, event_id).await?;

    let scan_source = payload.scan_source.unwrap_or_else(|| "qr".to_string());
    let notes = payload.notes.or_else(|| {
        if scan_source.contains("offline") {
            Some("Offline check-in — review required".to_string())
        } else {
            None
        }
    });

    let response = perform_check_in(
        &state,
        &guest,
        scanner_user_id,
        &scan_source,
        notes,
        payload.gate.as_deref(),
    )
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": response,
        })),
    ))
}

/// Authorised manual check-in when no OTP channel can deliver a code. The
/// operator and reason are stored with the scan so it can be reviewed later.
pub async fn override_check_in(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<OverrideCheckInRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let operator_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    if payload.reason.trim().is_empty() {
        return Err(AppError::ValidationError(
            "A reason is required for a manual override".to_string(),
        ));
    }
    let short_link = normalize_short_link(&payload.short_link);
    let guest = load_scan_guest(&state, event_id, &short_link)
        .await?
        .ok_or(AppError::InvitationNotFound)?;
    if guest.entries_used >= i64::from(guest.party_size.max(1)) {
        return Err(AppError::DuplicateScan);
    }

    let notes = format!(
        "Manual override by {}: {}",
        operator_id,
        payload.reason.trim()
    );
    let response = perform_check_in(&state, &guest, operator_id, "override", Some(notes), None).await?;

    tracing::warn!(event_id = %event_id, guest_id = %guest.guest_id, operator_id = %operator_id, "Manual check-in override used");
    Ok(Json(json!({ "success": true, "data": response })))
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

#[derive(Debug, Deserialize)]
pub struct CaptureNameRequest {
    pub short_link: String,
    pub full_name: String,
    pub phone: Option<String>,
}

/// POST /events/{eid}/scan/capture-name — after the name cutoff, the usher
/// captures the attendee's identity for an unnamed pass before check-in.
pub async fn capture_name(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<CaptureNameRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let actor_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?;
    let event = assert_event_ownership(&state, event_id, org_id).await?;
    if payload.full_name.trim().is_empty() {
        return Err(AppError::ValidationError("Attendee name is required".to_string()));
    }
    let short_link = normalize_short_link(&payload.short_link);
    let guest = load_scan_guest(&state, event_id, &short_link)
        .await?
        .ok_or(AppError::InvitationNotFound)?;
    if guest.booking_id.is_none() || guest.pass_state != "unnamed" {
        return Err(AppError::BadRequest("This pass does not need name capture".to_string()));
    }
    sqlx::query(
        r#"UPDATE guests SET full_name = $1, phone = COALESCE($2, phone),
               pass_state = 'named', named_at = NOW(), updated_at = NOW()
           WHERE id = $3"#,
    )
    .bind(payload.full_name.trim())
    .bind(payload.phone.as_deref())
    .bind(guest.guest_id)
    .execute(state.db.pool())
    .await?;
    sqlx::query(
        r#"INSERT INTO pass_audit
               (id, event_id, booking_id, guest_id, action, actor_id, actor_role, details)
           VALUES ($1, $2, $3, $4, 'gate_name_captured', $5, $6, $7)"#,
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(guest.booking_id)
    .bind(guest.guest_id)
    .bind(actor_id)
    .bind(&claims.role)
    .bind(json!({"full_name": payload.full_name, "review_required": true}))
    .execute(state.db.pool())
    .await?;
    let _ = event; // ownership already asserted
    Ok(Json(json!({ "success": true, "message": "Name captured — entry logged for review" })))
}
