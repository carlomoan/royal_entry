use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::Utc;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{
        event::Event,
        guest::Guest,
        invitation::{GenerateInvitationsRequest, GenerateInvitationsResult, Invitation, InvitationResponse},
        user::Claims,
    },
    repository::event_repository::EventRepository,
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

async fn list_event_guests(pool: &PgPool, event_id: Uuid) -> AppResult<Vec<Guest>> {
    let guests = sqlx::query_as::<_, Guest>(
        "SELECT * FROM guests WHERE event_id = $1 ORDER BY full_name ASC",
    )
    .bind(event_id)
    .fetch_all(pool)
    .await?;

    Ok(guests)
}

pub async fn list_invitations(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let invitations = sqlx::query_as::<_, Invitation>(
        r#"
        SELECT i.*
        FROM invitations i
        JOIN guests g ON g.id = i.guest_id
        WHERE g.event_id = $1
        ORDER BY i.created_at DESC
        "#,
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;

    let frontend_url = state.config.app.frontend_url.clone();
    let data: Vec<InvitationResponse> = invitations
        .into_iter()
        .map(|invitation| InvitationResponse::from_invitation(invitation, &frontend_url, event_id))
        .collect();

    Ok(Json(json!({
        "success": true,
        "data": data,
    })))
}

pub async fn generate_invitations(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<GenerateInvitationsRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let guests = list_event_guests(state.db.pool(), event_id).await?;
    let overwrite = payload.overwrite.unwrap_or(false);

    if guests.is_empty() {
        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "data": GenerateInvitationsResult {
                    generated: 0,
                    skipped: 0,
                    failed: 0,
                    invitations: Vec::new(),
                }
            })),
        ));
    }

    let mut tx = state.db.pool().begin().await?;
    let now = Utc::now();
    let mut generated = 0_i64;
    let mut skipped = 0_i64;
    let failed = 0_i64;
    let mut results = Vec::new();

    for guest in guests {
        let existing = sqlx::query_as::<_, Invitation>(
            "SELECT * FROM invitations WHERE guest_id = $1",
        )
        .bind(guest.id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(existing) = existing {
            if !overwrite {
                skipped += 1;
                results.push(InvitationResponse::from_invitation(
                    existing,
                    &state.config.app.frontend_url,
                    event_id,
                ));
                continue;
            }

            let short_link = format!("inv-{}", Uuid::new_v4().simple());
            let updated = sqlx::query_as::<_, Invitation>(
                r#"
                UPDATE invitations
                SET short_link = $2,
                    status = 'sent',
                    invitation_sent_at = $3,
                    created_at = $3
                WHERE guest_id = $1
                RETURNING *
                "#,
            )
            .bind(guest.id)
            .bind(short_link)
            .bind(now)
            .fetch_one(&mut *tx)
            .await?;

            generated += 1;
            results.push(InvitationResponse::from_invitation(
                updated,
                &state.config.app.frontend_url,
                event_id,
            ));
            continue;
        }

        let invitation = sqlx::query_as::<_, Invitation>(
            r#"
            INSERT INTO invitations (
                id, guest_id, short_link, status, scan_count, invitation_sent_at, created_at
            )
            VALUES ($1, $2, $3, 'sent', 0, $4, $4)
            RETURNING *
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(guest.id)
        .bind(format!("inv-{}", Uuid::new_v4().simple()))
        .bind(now)
        .fetch_one(&mut *tx)
        .await?;

        generated += 1;
        results.push(InvitationResponse::from_invitation(
            invitation,
            &state.config.app.frontend_url,
            event_id,
        ));
    }

    tx.commit().await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": GenerateInvitationsResult {
                generated,
                skipped,
                failed,
                invitations: results,
            }
        })),
    ))
}
