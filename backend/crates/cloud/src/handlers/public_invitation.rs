use std::sync::Arc;

use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use image::ImageEncoder;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::invitation::{build_public_invitation_url, build_scan_url},
    AppState,
};

#[derive(Debug, sqlx::FromRow)]
struct PublicInvitationRow {
    invitation_id: Uuid,
    guest_id: Uuid,
    event_id: Uuid,
    short_link: String,
    invitation_status: String,
    scan_count: i32,
    invitation_sent_at: Option<DateTime<Utc>>,
    last_scanned_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    guest_name: String,
    guest_phone: String,
    guest_email: Option<String>,
    table_number: Option<String>,
    seat_number: Option<String>,
    party_size: i32,
    card_issued_at: Option<DateTime<Utc>>,
    guest_category: Option<String>,
    plus_one_allowed: bool,
    contact_method: String,
    title: String,
    description: Option<String>,
    event_date: NaiveDate,
    event_time: Option<String>,
    venue_name: Option<String>,
    venue_address: Option<String>,
    dress_code: Option<String>,
    card_theme: Option<String>,
    rsvp_deadline: Option<NaiveDate>,
    entry_start_time: Option<String>,
    entry_end_time: Option<String>,
    parking_instructions: Option<String>,
    rsvp_response: Option<String>,
    rsvp_responded_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct PublicInvitationPayload {
    pub invitation: PublicInvitationMeta,
    pub guest: PublicGuestMeta,
    pub event: PublicEventMeta,
    pub rsvp: PublicRsvpMeta,
}

#[derive(Debug, Serialize)]
pub struct PublicInvitationMeta {
    pub id: Uuid,
    pub short_link: String,
    pub status: String,
    pub scan_count: i32,
    pub invitation_sent_at: Option<DateTime<Utc>>,
    pub last_scanned_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub public_url: String,
    pub scan_url: String,
    pub scan_payload: String,
}

#[derive(Debug, Serialize)]
pub struct PublicGuestMeta {
    pub id: Uuid,
    pub full_name: String,
    pub phone: String,
    pub email: Option<String>,
    pub table_number: Option<String>,
    pub seat_number: Option<String>,
    pub party_size: i32,
    pub card_issued_at: Option<DateTime<Utc>>,
    pub guest_category: Option<String>,
    pub plus_one_allowed: bool,
    pub contact_method: String,
}

#[derive(Debug, Serialize)]
pub struct PublicEventMeta {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub event_date: NaiveDate,
    pub event_time: Option<String>,
    pub venue_name: Option<String>,
    pub venue_address: Option<String>,
    pub dress_code: Option<String>,
    pub card_theme: Option<String>,
    pub rsvp_deadline: Option<NaiveDate>,
    pub entry_start_time: Option<String>,
    pub entry_end_time: Option<String>,
    pub parking_instructions: Option<String>,
    parking_variants: Vec<ParkingVariantMeta>,
}

#[derive(Debug, Serialize)]
pub struct ParkingVariantMeta {
    pub class_name: String,
    pub instructions: String,
}

#[derive(Debug, Serialize)]
pub struct PublicRsvpMeta {
    pub response: String,
    pub responded_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitPublicRsvpRequest {
    pub response: String,
}

fn normalize_rsvp_response(response: &str) -> AppResult<String> {
    let normalized = response.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "confirmed" | "declined" | "pending" => Ok(normalized),
        _ => Err(AppError::BadRequest(
            "Invalid RSVP response. Use confirmed, declined, or pending".to_string(),
        )),
    }
}

async fn fetch_public_invitation(
    state: &Arc<AppState>,
    code: &str,
) -> AppResult<Option<PublicInvitationRow>> {
    let row = sqlx::query_as::<_, PublicInvitationRow>(
        r#"
        SELECT
            i.id AS invitation_id,
            i.guest_id,
            g.event_id,
            i.short_link,
            i.status AS invitation_status,
            i.scan_count,
            i.invitation_sent_at,
            i.last_scanned_at,
            i.created_at,
            g.full_name AS guest_name,
            g.phone AS guest_phone,
            g.email AS guest_email,
            g.table_number,
            g.seat_number,
            g.party_size,
            g.card_issued_at,
            g.guest_category,
            g.plus_one_allowed,
            g.contact_method,
            e.title,
            e.description,
            e.event_date,
            e.event_time,
            e.venue_name,
            e.venue_address,
            e.dress_code,
            e.card_theme,
            e.rsvp_deadline,
            e.entry_start_time,
            e.entry_end_time,
            e.parking_instructions,
            r.response AS rsvp_response,
            r.responded_at AS rsvp_responded_at
        FROM invitations i
        JOIN guests g ON g.id = i.guest_id
        JOIN events e ON e.id = g.event_id
        LEFT JOIN rsvp_responses r ON r.guest_id = g.id AND r.event_id = g.event_id
        WHERE i.short_link = $1
          AND e.deleted_at IS NULL
        "#,
    )
    .bind(code)
    .fetch_optional(state.db.pool())
    .await?;

    Ok(row)
}

async fn to_public_payload(state: &Arc<AppState>, row: PublicInvitationRow) -> PublicInvitationPayload {
    let frontend_url = &state.config.app.frontend_url;
    let parking_variants = sqlx::query_as::<_, (String, String)>(
        "SELECT class_name, instructions FROM event_parking_variants WHERE event_id = $1 ORDER BY class_name",
    )
    .bind(row.event_id)
    .fetch_all(state.db.pool())
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|(class_name, instructions)| ParkingVariantMeta { class_name, instructions })
    .collect();

    PublicInvitationPayload {
        invitation: PublicInvitationMeta {
            id: row.invitation_id,
            short_link: row.short_link.clone(),
            status: row.invitation_status,
            scan_count: row.scan_count,
            invitation_sent_at: row.invitation_sent_at,
            last_scanned_at: row.last_scanned_at,
            created_at: row.created_at,
            public_url: build_public_invitation_url(frontend_url, &row.short_link),
            scan_url: build_scan_url(frontend_url, row.event_id, &row.short_link),
            scan_payload: row.short_link.clone(),
        },
        guest: PublicGuestMeta {
            id: row.guest_id,
            full_name: row.guest_name,
            phone: row.guest_phone,
            email: row.guest_email,
            table_number: row.table_number,
            seat_number: row.seat_number,
            party_size: row.party_size,
            card_issued_at: row.card_issued_at,
            guest_category: row.guest_category,
            plus_one_allowed: row.plus_one_allowed,
            contact_method: row.contact_method,
        },
        event: PublicEventMeta {
            id: row.event_id,
            title: row.title,
            description: row.description,
            event_date: row.event_date,
            event_time: row.event_time,
            venue_name: row.venue_name,
            venue_address: row.venue_address,
            dress_code: row.dress_code,
            card_theme: row.card_theme,
            rsvp_deadline: row.rsvp_deadline,
            entry_start_time: row.entry_start_time,
            entry_end_time: row.entry_end_time,
            parking_instructions: row.parking_instructions,
            parking_variants,
        },
        rsvp: PublicRsvpMeta {
            response: row.rsvp_response.unwrap_or_else(|| "pending".to_string()),
            responded_at: row.rsvp_responded_at,
        },
    }
}

pub async fn get_public_invitation(
    State(state): State<Arc<AppState>>,
    Path(code): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let existing = fetch_public_invitation(&state, &code)
        .await?
        .ok_or(AppError::InvitationNotFound)?;

    if matches!(existing.invitation_status.as_str(), "pending" | "sent") {
        sqlx::query(
            r#"
            UPDATE invitations
            SET status = 'viewed'
            WHERE id = $1 AND status IN ('pending', 'sent')
            "#,
        )
        .bind(existing.invitation_id)
        .execute(state.db.pool())
        .await?;
    }

    let fresh = fetch_public_invitation(&state, &code)
        .await?
        .ok_or(AppError::InvitationNotFound)?;

    Ok(Json(json!({
        "success": true,
        "data": to_public_payload(&state, fresh).await,
    })))
}

pub async fn submit_public_rsvp(
    State(state): State<Arc<AppState>>,
    Path(code): Path<String>,
    Json(payload): Json<SubmitPublicRsvpRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let response = normalize_rsvp_response(&payload.response)?;
    let invitation = fetch_public_invitation(&state, &code)
        .await?
        .ok_or(AppError::InvitationNotFound)?;

    if let Some(deadline) = invitation.rsvp_deadline {
        if Utc::now().date_naive() > deadline {
            return Err(AppError::BadRequest(
                "RSVP deadline has passed for this invitation".to_string(),
            ));
        }
    }

    let responded_at = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO rsvp_responses (guest_id, event_id, response, responded_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (guest_id, event_id)
        DO UPDATE SET
            response = EXCLUDED.response,
            responded_at = EXCLUDED.responded_at
        "#,
    )
    .bind(invitation.guest_id)
    .bind(invitation.event_id)
    .bind(&response)
    .bind(responded_at)
    .execute(state.db.pool())
    .await?;

    let fresh = fetch_public_invitation(&state, &code)
        .await?
        .ok_or(AppError::InvitationNotFound)?;

    Ok(Json(json!({
        "success": true,
        "message": "RSVP updated",
        "data": to_public_payload(&state, fresh).await,
    })))
}

#[derive(Debug, Deserialize)]
pub struct SubmitPublicPledgeRequest {
    pub pledged_amount: i64,
}

/// POST /api/v1/public/invitations/{code}/pledge — a guest confirms their
/// pledge from the QR-free invitation page. No login required; the token is
/// the capability. Existing pledges can only be changed before any payment.
pub async fn submit_public_pledge(
    State(state): State<Arc<AppState>>,
    Path(code): Path<String>,
    Json(payload): Json<SubmitPublicPledgeRequest>,
) -> AppResult<Json<serde_json::Value>> {
    if payload.pledged_amount <= 0 {
        return Err(AppError::ValidationError(
            "Pledge amount must be greater than zero".to_string(),
        ));
    }
    if payload.pledged_amount > 1_000_000_000 {
        return Err(AppError::ValidationError(
            "Pledge amount is too large".to_string(),
        ));
    }

    let row = sqlx::query(
        r#"
        SELECT g.id AS guest_id, g.event_id, g.full_name, e.organization_id,
               e.pledge_deadline_at
        FROM invitations i
        JOIN guests g ON g.id = i.guest_id
        JOIN events e ON e.id = g.event_id
        WHERE i.short_link = $1 AND e.deleted_at IS NULL
        "#,
    )
    .bind(&code)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::InvitationNotFound)?;

    let guest_id: Uuid = row.try_get("guest_id")?;
    let event_id: Uuid = row.try_get("event_id")?;
    let guest_name: String = row.try_get("full_name").unwrap_or_default();
    let org_id: Uuid = row.try_get("organization_id")?;
    let deadline: Option<DateTime<Utc>> = row.try_get("pledge_deadline_at").ok();

    let existing_paid: Option<i64> = sqlx::query_scalar(
        "SELECT amount_paid FROM pledge_tracker WHERE event_id = $1 AND guest_id = $2",
    )
    .bind(event_id)
    .bind(guest_id)
    .fetch_optional(state.db.pool())
    .await?;
    if existing_paid.map(|paid| paid > 0).unwrap_or(false) {
        return Err(AppError::Conflict(
            "This pledge already has payments recorded. Contact the organizer to change it."
                .to_string(),
        ));
    }

    let deadline_date = deadline.map(|d| d.date_naive());
    let pledge_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO pledge_tracker
            (id, event_id, guest_id, pledged_amount, amount_paid, payment_status,
             payment_deadline, notes)
        VALUES ($1, $2, $3, $4, 0, 'pending', $5, 'Confirmed by guest on invitation page')
        ON CONFLICT (event_id, guest_id) DO UPDATE SET
            pledged_amount = EXCLUDED.pledged_amount,
            payment_deadline = COALESCE(EXCLUDED.payment_deadline, pledge_tracker.payment_deadline),
            payment_status = 'pending',
            updated_at = NOW()
        RETURNING id
        "#,
    )
    .bind(pledge_id)
    .bind(event_id)
    .bind(guest_id)
    .bind(payload.pledged_amount)
    .bind(deadline_date)
    .fetch_one(state.db.pool())
    .await?;

    let _ = crate::services::NotificationService::create_org(
        state.db.pool(),
        org_id,
        "pledge.confirmed",
        "Guest confirmed a pledge",
        Some(&format!(
            "{} pledged TZS {} from their invitation page",
            guest_name, payload.pledged_amount
        )),
        Some(&format!("/events/{event_id}")),
        Some(json!({"event_id": event_id, "guest_id": guest_id})),
    )
    .await;

    Ok(Json(json!({
        "success": true,
        "data": {
            "pledged_amount": payload.pledged_amount,
            "payment_deadline": deadline_date.map(|d| d.to_string()),
            "message": "Pledge confirmed. The family will review your check-in card."
        }
    })))
}

/// GET /api/v1/public/invitations/{code}/qr — public QR PNG for a guest's
/// check-in card. The QR payload is the `/g/<token>` card URL, which the
/// scanner resolves back to the short link.
pub async fn public_invitation_qr(
    State(state): State<Arc<AppState>>,
    Path(code): Path<String>,
) -> AppResult<axum::response::Response> {
    let invitation = sqlx::query_as::<_, crate::models::invitation::Invitation>(
        "SELECT * FROM invitations WHERE short_link = $1",
    )
    .bind(&code)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::InvitationNotFound)?;

    let url = format!(
        "{}/g/{}",
        state.config.app.frontend_url.trim_end_matches('/'),
        invitation.short_link
    );
    let qr = qrcode::QrCode::new(url.as_bytes())
        .map_err(|_| AppError::QrGenerationError("Could not encode check-in URL".to_string()))?;
    let image = qr.render::<image::Luma<u8>>().min_dimensions(300, 300).build();
    let mut png: Vec<u8> = Vec::new();
    image::codecs::png::PngEncoder::new(&mut png)
        .write_image(&image, image.width(), image.height(), image::ColorType::L8.into())
        .map_err(|_| AppError::QrGenerationError("Could not encode PNG".to_string()))?;

    use axum::http::header;
    let headers = axum::http::HeaderMap::from_iter([
        (header::CONTENT_TYPE, "image/png".parse().unwrap()),
        (header::CACHE_CONTROL, "public, max-age=300".parse().unwrap()),
    ]);
    Ok((headers, png).into_response())
}
