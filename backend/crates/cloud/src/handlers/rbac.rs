use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    utils::rbac::{require_platform_admin, ALL_PERMISSIONS},
    AppState,
};

#[derive(Debug, Serialize)]
pub struct RoleResponse {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub scope: String,
    pub is_system: bool,
    pub permissions: Vec<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRoleRequest {
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub scope: String,
    pub permissions: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRoleRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub permissions: Option<Vec<String>>,
}

/// List all roles with their permissions
pub async fn list_roles(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let rows = sqlx::query(
        "SELECT id, code, name, description, scope, is_system FROM roles ORDER BY scope, name"
    )
    .fetch_all(state.db.pool())
    .await?;

    let mut roles: Vec<RoleResponse> = Vec::new();
    for row in rows {
        let id: Uuid = row.try_get("id")?;
        let permissions = sqlx::query_scalar::<_, String>(
            "SELECT permission FROM role_permissions WHERE role_id = $1 ORDER BY permission"
        )
        .bind(id)
        .fetch_all(state.db.pool())
        .await?;

        roles.push(RoleResponse {
            id,
            code: row.try_get("code")?,
            name: row.try_get("name")?,
            description: row.try_get("description")?,
            scope: row.try_get("scope")?,
            is_system: row.try_get("is_system")?,
            permissions,
            created_at: chrono::Utc::now(),
        });
    }

    Ok(Json(json!({ "success": true, "data": roles })))
}

/// Get the catalog of all available permissions
pub async fn list_permissions(
    State(_state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let platform_permissions = ALL_PERMISSIONS
        .iter()
        .map(|s| s.to_string())
        .collect::<Vec<String>>();

    Ok(Json(json!({
        "success": true,
        "data": platform_permissions
    })))
}

/// Create a new custom role
pub async fn create_role(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateRoleRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    require_platform_admin(&claims)?;

    if payload.code.trim().is_empty() || payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("Role code and name are required".to_string()));
    }

    let existing: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM roles WHERE code = $1)")
        .bind(&payload.code)
        .fetch_one(state.db.pool())
        .await?;
    if existing {
        return Err(AppError::Conflict(format!("Role '{}' already exists", payload.code)));
    }

    let role_id = Uuid::new_v4();
    let mut tx = state.db.pool().begin().await?;

    sqlx::query(
        "INSERT INTO roles (id, code, name, description, scope, is_system, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, FALSE, NOW(), NOW())"
    )
    .bind(role_id)
    .bind(&payload.code)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(if payload.scope == "platform" { "platform" } else { "account" })
    .execute(&mut *tx)
    .await?;

    for perm in &payload.permissions {
        sqlx::query("INSERT INTO role_permissions (id, role_id, role, permission) VALUES ($1, $2, $3, $4)")
            .bind(Uuid::new_v4())
            .bind(role_id)
            .bind(&payload.code)
            .bind(perm)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    Ok((StatusCode::CREATED, Json(json!({
        "success": true,
        "message": "Role created",
        "data": { "id": role_id }
    }))))
}

/// Update a role. System roles can have their permissions edited, but not
/// their name/description changed or deleted.
pub async fn update_role(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(role_id): Path<Uuid>,
    Json(payload): Json<UpdateRoleRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let is_system: bool = sqlx::query_scalar("SELECT is_system FROM roles WHERE id = $1")
        .bind(role_id)
        .fetch_optional(state.db.pool())
        .await?
        .ok_or_else(|| AppError::NotFound("Role not found".to_string()))?;

    let role_code: String = sqlx::query_scalar("SELECT code FROM roles WHERE id = $1")
        .bind(role_id)
        .fetch_one(state.db.pool())
        .await?;

    let mut tx = state.db.pool().begin().await?;

    // System roles: only permissions can be edited (name/description locked)
    if !is_system {
        if let Some(name) = payload.name {
            sqlx::query("UPDATE roles SET name = $2, updated_at = NOW() WHERE id = $1")
                .bind(role_id).bind(name).execute(&mut *tx).await?;
        }
        if let Some(description) = payload.description {
            sqlx::query("UPDATE roles SET description = $2, updated_at = NOW() WHERE id = $1")
                .bind(role_id).bind(description).execute(&mut *tx).await?;
        }
    }

    if let Some(permissions) = payload.permissions {
        // Replace all permissions
        sqlx::query("DELETE FROM role_permissions WHERE role_id = $1")
            .bind(role_id).execute(&mut *tx).await?;
        for perm in permissions {
            sqlx::query("INSERT INTO role_permissions (id, role_id, role, permission) VALUES ($1, $2, $3, $4)")
                .bind(Uuid::new_v4()).bind(role_id).bind(&role_code).bind(perm).execute(&mut *tx).await?;
        }
    }

    tx.commit().await?;
    Ok(Json(json!({ "success": true, "message": "Role updated" })))
}

/// Delete a custom role
pub async fn delete_role(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(role_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let is_system: bool = sqlx::query_scalar("SELECT is_system FROM roles WHERE id = $1")
        .bind(role_id)
        .fetch_optional(state.db.pool())
        .await?
        .ok_or_else(|| AppError::NotFound("Role not found".to_string()))?;

    if is_system {
        return Err(AppError::BadRequest("System roles cannot be deleted".to_string()));
    }

    sqlx::query("DELETE FROM roles WHERE id = $1").bind(role_id).execute(state.db.pool()).await?;
    Ok(Json(json!({ "success": true, "message": "Role deleted" })))
}

/// Assign a role to a user (via user_role_assignments)
pub async fn assign_role_to_user(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let role_id = payload.get("role_id").and_then(|v| v.as_str())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| AppError::BadRequest("role_id is required".to_string()))?;

    // Upsert assignment: role assignment (role_id, no permission)
    sqlx::query(
        "INSERT INTO user_role_assignments (id, user_id, role_id, is_granted, created_at) VALUES ($1, $2, $3, TRUE, NOW()) ON CONFLICT (user_id, role_id) WHERE role_id IS NOT NULL AND permission IS NULL DO UPDATE SET is_granted = TRUE"
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(role_id)
    .execute(state.db.pool())
    .await?;

    Ok(Json(json!({ "success": true, "message": "Role assigned to user" })))
}

/// Assign a permission to a user (grant)
pub async fn grant_permission_to_user(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let permission = payload.get("permission").and_then(|v| v.as_str())
        .ok_or_else(|| AppError::BadRequest("permission is required".to_string()))?;

    sqlx::query(
        "INSERT INTO user_role_assignments (id, user_id, permission, is_granted, created_at) VALUES ($1, $2, $3, TRUE, NOW()) ON CONFLICT (user_id, permission) WHERE role_id IS NULL AND permission IS NOT NULL DO UPDATE SET is_granted = TRUE"
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(permission)
    .execute(state.db.pool())
    .await?;

    Ok(Json(json!({ "success": true, "message": "Permission granted" })))
}

/// Revoke a permission from a user
pub async fn revoke_permission_from_user(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let permission = payload.get("permission").and_then(|v| v.as_str())
        .ok_or_else(|| AppError::BadRequest("permission is required".to_string()))?;

    // Insert a revoked record
    sqlx::query(
        "INSERT INTO user_role_assignments (id, user_id, permission, is_granted, created_at) VALUES ($1, $2, $3, FALSE, NOW()) ON CONFLICT (user_id, permission) WHERE role_id IS NULL AND permission IS NOT NULL DO UPDATE SET is_granted = FALSE"
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(permission)
    .execute(state.db.pool())
    .await?;

    Ok(Json(json!({ "success": true, "message": "Permission revoked" })))
}
