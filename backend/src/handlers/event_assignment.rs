// ==============================================================================
// Event staff assignment handlers — assign account-scoped users to events
// so they can be granted event-level roles (scanner, host, etc.).
// ==============================================================================

use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct AssignStaffRequest {
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StaffAssignment {
    pub id: Uuid,
    pub event_id: Uuid,
    pub user_id: Uuid,
    pub user_email: String,
    pub user_full_name: String,
    pub user_role: String,
    pub assigned_by_user_id: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// List all users assigned to a given event.
pub async fn list_event_staff(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;

    // Verify the event belongs to the caller's org
    let event_owner: Uuid =
        sqlx::query_scalar("SELECT organization_id FROM events WHERE id = $1 AND deleted_at IS NULL")
            .bind(event_id)
            .fetch_optional(state.db.pool())
            .await?
            .ok_or(AppError::EventNotFound)?;
    if event_owner != org_id {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query(
        r#"
        SELECT
            ea.id, ea.event_id, ea.user_id, u.email AS user_email,
            u.full_name AS user_full_name, u.role AS user_role,
            ea.assigned_by_user_id, ea.created_at
        FROM event_assignments ea
        JOIN users u ON u.id = ea.user_id
        WHERE ea.event_id = $1
        ORDER BY ea.created_at DESC
        "#,
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;

    let mut staff = Vec::new();
    for row in rows {
        staff.push(StaffAssignment {
            id: row.try_get("id")?,
            event_id: row.try_get("event_id")?,
            user_id: row.try_get("user_id")?,
            user_email: row.try_get("user_email")?,
            user_full_name: row.try_get("user_full_name")?,
            user_role: row.try_get("user_role")?,
            assigned_by_user_id: row.try_get("assigned_by_user_id")?,
            created_at: row.try_get("created_at")?,
        });
    }
    Ok(Json(serde_json::json!({ "success": true, "data": staff })))
}

/// Assign an account-scoped user to an event with a given event-level role.
pub async fn assign_staff_to_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<AssignStaffRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let assigner_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?;

    // Verify the event belongs to the caller's org
    let event_owner: Uuid =
        sqlx::query_scalar("SELECT organization_id FROM events WHERE id = $1 AND deleted_at IS NULL")
            .bind(event_id)
            .fetch_optional(state.db.pool())
            .await?
            .ok_or(AppError::EventNotFound)?;
    if event_owner != org_id {
        return Err(AppError::Forbidden);
    }

    // Verify the user being assigned belongs to the same org (account-scoped rule)
    let user_org: Option<Uuid> =
        sqlx::query_scalar("SELECT organization_id FROM users WHERE id = $1")
            .bind(payload.user_id)
            .fetch_optional(state.db.pool())
            .await?;
    match user_org {
        Some(uid) if uid == org_id => {}
        Some(_) => return Err(AppError::Forbidden),
        None => return Err(AppError::NotFound("User not found".to_string())),
    }

    sqlx::query(
        r#"
        INSERT INTO event_assignments (id, event_id, user_id, assigned_by_user_id, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (event_id, user_id) DO NOTHING
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(payload.user_id)
    .bind(assigner_id)
    .execute(state.db.pool())
    .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Staff member assigned to event"
    })))
}

/// Remove a staff member from an event.
pub async fn remove_staff_from_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, user_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;

    // Verify the event belongs to the caller's org
    let event_owner: Uuid =
        sqlx::query_scalar("SELECT organization_id FROM events WHERE id = $1 AND deleted_at IS NULL")
            .bind(event_id)
            .fetch_optional(state.db.pool())
            .await?
            .ok_or(AppError::EventNotFound)?;
    if event_owner != org_id {
        return Err(AppError::Forbidden);
    }

    sqlx::query("DELETE FROM event_assignments WHERE event_id = $1 AND user_id = $2")
        .bind(event_id)
        .bind(user_id)
        .execute(state.db.pool())
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Staff member removed from event"
    })))
}

/// List account users that are *available* to be assigned to this event
/// (i.e. account-scoped users, excluding already-assigned and platform roles).
pub async fn list_assignable_users(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;

    let event_owner: Uuid =
        sqlx::query_scalar("SELECT organization_id FROM events WHERE id = $1 AND deleted_at IS NULL")
            .bind(event_id)
            .fetch_optional(state.db.pool())
            .await?
            .ok_or(AppError::EventNotFound)?;
    if event_owner != org_id {
        return Err(AppError::Forbidden);
    }

    let rows = sqlx::query(
        r#"
        SELECT u.id, u.email, u.full_name, u.role, u.is_active
        FROM users u
        WHERE u.organization_id = $1
          AND u.is_active = TRUE
          AND u.role NOT IN ('superadmin', 'platform_admin', 'system_admin')
          AND u.id NOT IN (SELECT user_id FROM event_assignments WHERE event_id = $2)
        ORDER BY u.full_name ASC
        "#,
    )
    .bind(org_id)
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;

    let mut users = Vec::new();
    for row in rows {
        users.push(serde_json::json!({
            "id": row.try_get::<Uuid, _>("id")?,
            "email": row.try_get::<String, _>("email")?,
            "full_name": row.try_get::<String, _>("full_name")?,
            "role": row.try_get::<String, _>("role")?,
            "is_active": row.try_get::<bool, _>("is_active")?,
        }));
    }
    Ok(Json(serde_json::json!({ "success": true, "data": users })))
}
