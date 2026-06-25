use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    repository::user_repository::UserRepository,
    services::AuthService,
    utils::rbac::{
        assert_same_organization, claims_org_id, ensure_role_assignable, require_account_admin,
        require_platform_admin, require_user_manager,
    },
    AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
struct SettingRow {
    setting_key: String,
    setting_value: Value,
    updated_by_user_id: Option<Uuid>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct OrganizationRow {
    id: Uuid,
    display_name: String,
    account_slug: Option<String>,
    billing_email: Option<String>,
    contact_phone: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct UserRoleOption {
    pub key: &'static str,
    pub label: &'static str,
    pub scope: &'static str,
}

#[derive(Debug, Deserialize)]
pub struct UpsertSettingsRequest {
    pub settings: serde_json::Map<String, Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccountUserRequest {
    pub organization_id: Option<Uuid>,
    pub email: String,
    pub password: String,
    pub full_name: String,
    pub phone: Option<String>,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccountUserRequest {
    pub organization_id: Option<Uuid>,
    pub role: Option<String>,
    pub is_active: Option<bool>,
    pub full_name: Option<String>,
    pub phone: Option<String>,
}

fn available_roles() -> Vec<UserRoleOption> {
    vec![
        UserRoleOption {
            key: "system_admin",
            label: "System Admin",
            scope: "platform",
        },
        UserRoleOption {
            key: "superadmin",
            label: "Super Admin",
            scope: "platform",
        },
        UserRoleOption {
            key: "account_admin",
            label: "Account Admin",
            scope: "account",
        },
        UserRoleOption {
            key: "organizer",
            label: "Organizer",
            scope: "account",
        },
        UserRoleOption {
            key: "mc",
            label: "MC / Event Host",
            scope: "account",
        },
        UserRoleOption {
            key: "door_staff",
            label: "Door Staff",
            scope: "account",
        },
        UserRoleOption {
            key: "viewer",
            label: "Viewer",
            scope: "account",
        },
    ]
}

async fn fetch_organization(state: &Arc<AppState>, organization_id: Uuid) -> AppResult<OrganizationRow> {
    sqlx::query_as::<_, OrganizationRow>(
        r#"
        SELECT id, display_name, account_slug, billing_email, contact_phone, created_at, updated_at
        FROM organizations
        WHERE id = $1
        "#,
    )
    .bind(organization_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Organization not found".to_string()))
}

async fn fetch_system_settings(state: &Arc<AppState>) -> AppResult<Vec<SettingRow>> {
    let rows = sqlx::query_as::<_, SettingRow>(
        r#"
        SELECT setting_key, setting_value, updated_by_user_id, updated_at
        FROM system_settings
        ORDER BY setting_key ASC
        "#,
    )
    .fetch_all(state.db.pool())
    .await?;

    Ok(rows)
}

async fn fetch_account_settings(
    state: &Arc<AppState>,
    organization_id: Uuid,
) -> AppResult<Vec<SettingRow>> {
    let rows = sqlx::query_as::<_, SettingRow>(
        r#"
        SELECT setting_key, setting_value, updated_by_user_id, updated_at
        FROM organization_settings
        WHERE organization_id = $1
        ORDER BY setting_key ASC
        "#,
    )
    .bind(organization_id)
    .fetch_all(state.db.pool())
    .await?;

    Ok(rows)
}

async fn fetch_team(
    state: &Arc<AppState>,
    organization_id: Uuid,
) -> AppResult<Vec<crate::models::user::UserResponse>> {
    let users = sqlx::query_as::<_, crate::models::user::User>(
        r#"
        SELECT *
        FROM users
        WHERE organization_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(organization_id)
    .fetch_all(state.db.pool())
    .await?;

    Ok(users.into_iter().map(Into::into).collect())
}

fn rows_to_map(rows: Vec<SettingRow>) -> serde_json::Map<String, Value> {
    rows.into_iter()
        .map(|row| (row.setting_key, row.setting_value))
        .collect()
}

pub async fn get_role_catalog(
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    require_user_manager(&claims)?;

    Ok(Json(json!({
        "success": true,
        "data": available_roles(),
    })))
}

pub async fn get_system_settings(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let rows = fetch_system_settings(&state).await?;
    Ok(Json(json!({
        "success": true,
        "data": rows_to_map(rows),
    })))
}

pub async fn update_system_settings(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpsertSettingsRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?;

    let mut tx = state.db.pool().begin().await?;
    for (setting_key, setting_value) in payload.settings {
        sqlx::query(
            r#"
            INSERT INTO system_settings (setting_key, setting_value, updated_by_user_id, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (setting_key)
            DO UPDATE SET
                setting_value = EXCLUDED.setting_value,
                updated_by_user_id = EXCLUDED.updated_by_user_id,
                updated_at = EXCLUDED.updated_at
            "#,
        )
        .bind(setting_key)
        .bind(setting_value)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    let rows = fetch_system_settings(&state).await?;
    Ok(Json(json!({
        "success": true,
        "message": "System settings updated",
        "data": rows_to_map(rows),
    })))
}

pub async fn get_account_settings(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let organization_id = claims_org_id(&claims)?;
    let organization = fetch_organization(&state, organization_id).await?;
    let settings = fetch_account_settings(&state, organization_id).await?;
    let users = fetch_team(&state, organization_id).await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "organization": organization,
            "settings": rows_to_map(settings),
            "users": users,
            "role_catalog": available_roles(),
        }
    })))
}

pub async fn update_account_settings(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpsertSettingsRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_account_admin(&claims)?;
    let organization_id = claims_org_id(&claims)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?;

    let mut tx = state.db.pool().begin().await?;
    for (setting_key, setting_value) in payload.settings {
        sqlx::query(
            r#"
            INSERT INTO organization_settings (
                organization_id,
                setting_key,
                setting_value,
                updated_by_user_id,
                updated_at
            )
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (organization_id, setting_key)
            DO UPDATE SET
                setting_value = EXCLUDED.setting_value,
                updated_by_user_id = EXCLUDED.updated_by_user_id,
                updated_at = EXCLUDED.updated_at
            "#,
        )
        .bind(organization_id)
        .bind(setting_key)
        .bind(setting_value)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    let organization = fetch_organization(&state, organization_id).await?;
    let settings = fetch_account_settings(&state, organization_id).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Account settings updated",
        "data": {
            "organization": organization,
            "settings": rows_to_map(settings),
        }
    })))
}

pub async fn create_account_user(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateAccountUserRequest>,
) -> AppResult<(axum::http::StatusCode, Json<serde_json::Value>)> {
    require_user_manager(&claims)?;

    if payload.password.trim().len() < 8 {
        return Err(AppError::ValidationError(
            "Password must be at least 8 characters".to_string(),
        ));
    }

    let default_org = claims_org_id(&claims)?;
    let organization_id = payload.organization_id.unwrap_or(default_org);
    assert_same_organization(&claims, organization_id)?;

    if UserRepository::email_exists(state.db.pool(), &payload.email).await? {
        return Err(AppError::EmailAlreadyExists);
    }

    let role = ensure_role_assignable(&claims, &payload.role)?;
    let password_hash = AuthService::hash_password(&payload.password)?;
    let phone = payload.phone.clone().unwrap_or_default();

    let user = UserRepository::create(
        state.db.pool(),
        organization_id,
        &payload.email,
        &password_hash,
        &payload.full_name,
        &phone,
        &role,
    )
    .await?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": crate::models::user::UserResponse::from(user),
        })),
    ))
}

pub async fn update_account_user(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<UpdateAccountUserRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_user_manager(&claims)?;

    let user = UserRepository::get_by_id(state.db.pool(), user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    let target_org = payload.organization_id.unwrap_or(user.organization_id);
    assert_same_organization(&claims, target_org)?;
    if user.organization_id != target_org {
        return Err(AppError::BadRequest(
            "User does not belong to the selected organization".to_string(),
        ));
    }

    let next_role = if let Some(role) = payload.role.as_deref() {
        ensure_role_assignable(&claims, role)?
    } else {
        user.role.clone()
    };

    sqlx::query(
        r#"
        UPDATE users
        SET role = $2,
            is_active = COALESCE($3, is_active),
            full_name = COALESCE($4, full_name),
            phone = COALESCE($5, phone),
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(user_id)
    .bind(next_role)
    .bind(payload.is_active)
    .bind(payload.full_name)
    .bind(payload.phone)
    .execute(state.db.pool())
    .await?;

    let updated = UserRepository::get_by_id(state.db.pool(), user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Updated user not found".to_string()))?;

    Ok(Json(json!({
        "success": true,
        "message": "User updated",
        "data": crate::models::user::UserResponse::from(updated),
    })))
}
