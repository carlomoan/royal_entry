// ==============================================================================
// FILE: src/handlers/auth.rs
// ==============================================================================
use axum::{
    extract::{State, Extension},
    http::StatusCode,
    Json,
};
use std::sync::Arc;
use serde_json::json;
use validator::Validate;
use uuid::Uuid;
use crate::{
    models::user::{
        LoginRequest, RegisterRequest, AuthResponse, TokenRefreshResponse,
        UserResponse, RefreshTokenRequest, ChangePasswordRequest, Claims,
    },
    services::auth::AuthService,
    repository::user_repository::UserRepository,
    error::{AppError, AppResult},
    AppState,
};

/// POST /api/v1/auth/login
pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> AppResult<(StatusCode, Json<AuthResponse>)> {
    payload.validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let user = UserRepository::get_by_login(&state.db.pool(), &payload.login)
        .await?
        .ok_or_else(|| {
            tracing::warn!(login = %payload.login, "Login attempt: user not found");
            AppError::Unauthorized("Invalid username/email or password".to_string())
        })?;

    let password_valid = AuthService::verify_password(&payload.password, &user.password_hash)?;
    if !password_valid {
        tracing::warn!(
            user_id = %user.id,
            login = %payload.login,
            "Login attempt: invalid password"
        );
        return Err(AppError::Unauthorized("Invalid username/email or password".to_string()));
    }

    UserRepository::update_last_login(&state.db.pool(), user.id).await?;

    let (access_token, refresh_token) = AuthService::generate_tokens(
        user.id,
        user.organization_id.unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000000").unwrap()),
        user.email.clone(),
        user.role.clone(),
    )?;

    let expiry_hours = std::env::var("JWT_EXPIRY_HOURS")
        .ok()
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(24);

    tracing::info!(
        user_id = %user.id,
        login = %payload.login,
        email = %user.email,
        "User logged in successfully"
    );

    Ok((
        StatusCode::OK,
        Json(AuthResponse {
            user: UserResponse::from(user),
            access_token,
            refresh_token,
            expires_in: expiry_hours * 3600,
            token_type: "Bearer".to_string(),
        }),
    ))
}

/// POST /api/v1/auth/register
///
/// FIX: Now creates organization + user in single transaction
/// FIX: Uses new role "account_admin" instead of old "organizer"
/// FIX: Removed dead code (password != password)
pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterRequest>,
) -> AppResult<(StatusCode, Json<AuthResponse>)> {
    payload.validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let email_exists = UserRepository::email_exists(&state.db.pool(), &payload.email).await?;
    if email_exists {
        tracing::warn!(email = %payload.email, "Registration attempt: email already exists");
        return Err(AppError::EmailAlreadyExists);
    }

    let password_hash = AuthService::hash_password(&payload.password)?;

    // ── FIX: Create organization + user in transaction ────────────────────────
    let org_id = Uuid::new_v4();
    let account_slug = payload.email
        .split('@')
        .next()
        .unwrap_or("user")
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    let mut tx = state.db.pool().begin().await?;

    // Create organization
    sqlx::query(
        r#"
        INSERT INTO organizations (
            id, display_name, account_slug, billing_email,
            contact_phone, account_status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'pending_review', NOW(), NOW())
        "#,
    )
    .bind(org_id)
    .bind(&payload.full_name)
    .bind(&account_slug)
    .bind(&payload.email)
    .bind(&payload.phone)
    .execute(&mut *tx)
    .await?;

    // ── FIX: Use new role "account_admin" ─────────────────────────────────────
    let user = sqlx::query_as::<_, crate::models::user::User>(
        r#"
        INSERT INTO users (
            id, organization_id, email, phone, full_name,
            password_hash, role, user_scope, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'account_admin', 'account', true, NOW(), NOW())
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(org_id)
    .bind(&payload.email)
    .bind(&payload.phone)
    .bind(&payload.full_name)
    .bind(&password_hash)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let (access_token, refresh_token) = AuthService::generate_tokens(
        user.id,
        user.organization_id.unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000000").unwrap()),
        user.email.clone(),
        user.role.clone(),
    )?;

    let expiry_hours = std::env::var("JWT_EXPIRY_HOURS")
        .ok()
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(24);

    tracing::info!(
        user_id = %user.id,
        org_id = %org_id,
        email = %payload.email,
        "User registered with new organization"
    );

    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            user: UserResponse::from(user),
            access_token,
            refresh_token,
            expires_in: expiry_hours * 3600,
            token_type: "Bearer".to_string(),
        }),
    ))
}

/// POST /api/v1/auth/refresh
pub async fn refresh_token(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<RefreshTokenRequest>,
) -> AppResult<(StatusCode, Json<TokenRefreshResponse>)> {
    let claims = AuthService::verify_token(&payload.refresh_token)?;
    AuthService::verify_token_type(&claims, "refresh")?;

    let (access_token, refresh_token) = AuthService::generate_tokens(
        Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?,
        Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?,
        claims.email,
        claims.role,
    )?;

    let expiry_hours = std::env::var("JWT_EXPIRY_HOURS")
        .ok()
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(24);

    tracing::debug!("Token refreshed for user: {}", claims.sub);

    Ok((
        StatusCode::OK,
        Json(TokenRefreshResponse {
            access_token,
            refresh_token,
            expires_in: expiry_hours * 3600,
            token_type: "Bearer".to_string(),
        }),
    ))
}

/// GET /api/v1/auth/me
pub async fn get_current_user(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<UserResponse>> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::InvalidToken)?;

    let user = UserRepository::get_by_id(&state.db.pool(), user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    let org_name: Option<String> = sqlx::query_scalar("SELECT display_name FROM organizations WHERE id = $1")
        .bind(user.organization_id.unwrap_or_else(|| Uuid::parse_str("00000000-0000-0000-0000-000000000000").unwrap()))
        .fetch_optional(state.db.pool())
        .await
        .ok()
        .flatten();

    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
        user_scope: user.user_scope,
        is_active: user.is_active,
        organization_id: user.organization_id,
        organization_name: org_name,
        created_at: user.created_at,
    }))
}

/// POST /api/v1/auth/change-password
pub async fn change_password(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<ChangePasswordRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    payload.validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    if payload.new_password != payload.confirm_password {
        return Err(AppError::ValidationError(
            "New passwords do not match".to_string(),
        ));
    }

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::InvalidToken)?;

    let user = UserRepository::get_by_id(&state.db.pool(), user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    let password_valid = AuthService::verify_password(
        &payload.current_password,
        &user.password_hash,
    )?;

    if !password_valid {
        return Err(AppError::Unauthorized(
            "Current password is incorrect".to_string(),
        ));
    }

    let new_password_hash = AuthService::hash_password(&payload.new_password)?;
    UserRepository::change_password(&state.db.pool(), user_id, &new_password_hash).await?;

    tracing::info!(user_id = %user_id, "Password changed successfully");

    Ok((
        StatusCode::OK,
        Json(json!({
            "message": "Password changed successfully"
        })),
    ))
}
