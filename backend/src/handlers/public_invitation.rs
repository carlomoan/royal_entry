use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
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

fn to_public_payload(state: &Arc<AppState>, row: PublicInvitationRow) -> PublicInvitationPayload {
    let frontend_url = &state.config.app.frontend_url;

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
        "data": to_public_payload(&state, fresh),
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
        "data": to_public_payload(&state, fresh),
    })))
}
