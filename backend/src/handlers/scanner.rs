use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::Utc;
use serde_json::json;
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
            g.phone
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

    if invitation_status == "scanned" {
        return Err(AppError::DuplicateScan);
    }

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
