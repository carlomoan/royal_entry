// ==============================================================================
// FILE: src/handlers/auth.rs
// ==============================================================================
// Authentication HTTP handlers

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

/// Handle user login
///
/// POST /api/v1/auth/login
///
/// Request:
/// ```json
/// {
///   "login": "admin",
///   "password": "Admin@123"
/// }
/// ```
///
/// Response (200):
/// ```json
/// {
///   "user": {
///     "id": "550e8400-e29b-41d4-a716-446655440000",
///     "email": "user@example.com",
///     "full_name": "John Doe",
///     "role": "mc",
///     ...
///   },
///   "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
///   "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
///   "expires_in": 86400,
///   "token_type": "Bearer"
/// }
/// ```
pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> AppResult<(StatusCode, Json<AuthResponse>)> {
    // Validate input
    payload.validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Find user by email or username
    let user = UserRepository::get_by_login(&state.db.pool(), &payload.login)
        .await?
        .ok_or_else(|| {
            tracing::warn!(login = %payload.login, "Login attempt: user not found");
            AppError::Unauthorized("Invalid username/email or password".to_string())
        })?;

    // Verify password
    let password_valid = AuthService::verify_password(&payload.password, &user.password_hash)?;

    if !password_valid {
        tracing::warn!(
            user_id = %user.id,
            login = %payload.login,
            "Login attempt: invalid password"
        );
        return Err(AppError::Unauthorized("Invalid username/email or password".to_string()));
    }

    // Update last login
    UserRepository::update_last_login(&state.db.pool(), user.id)
        .await?;

    // Generate tokens
    let (access_token, refresh_token) = AuthService::generate_tokens(
        user.id,
        user.organization_id,
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

/// Handle user registration
///
/// POST /api/v1/auth/register
///
/// Request:
/// ```json
/// {
///   "email": "newuser@example.com",
///   "password": "secure_password_123",
///   "full_name": "John Doe",
///   "phone": "+255700000000"
/// }
/// ```
///
/// Response (201):
/// Same as login response with new user data
pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterRequest>,
) -> AppResult<(StatusCode, Json<AuthResponse>)> {
    // Validate input
    payload.validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Check if email already exists
    let email_exists = UserRepository::email_exists(&state.db.pool(), &payload.email).await?;

    if email_exists {
        tracing::warn!(
            email = %payload.email,
            "Registration attempt: email already exists"
        );
        return Err(AppError::EmailAlreadyExists);
    }

    // Validate passwords match
    if payload.password != payload.password {
        return Err(AppError::ValidationError("Passwords do not match".to_string()));
    }

    // Hash password
    let password_hash = AuthService::hash_password(&payload.password)?;

    // Create user (with default organization for now)
    // TODO: In production, handle organization creation separately
    let org_id = Uuid::new_v4();

    let user = UserRepository::create(
        &state.db.pool(),
        org_id,
        &payload.email,
        &password_hash,
        &payload.full_name,
        &payload.phone,
        "organizer", // Default role for new registrations
    )
    .await?;

    // Generate tokens
    let (access_token, refresh_token) = AuthService::generate_tokens(
        user.id,
        user.organization_id,
        user.email.clone(),
        user.role.clone(),
    )?;

    let expiry_hours = std::env::var("JWT_EXPIRY_HOURS")
        .ok()
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(24);

    tracing::info!(
        user_id = %user.id,
        email = %payload.email,
        "User registered successfully"
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

/// Refresh access token using refresh token
///
/// POST /api/v1/auth/refresh
///
/// Request:
/// ```json
/// {
///   "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
/// }
/// ```
///
/// Response (200):
/// ```json
/// {
///   "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
///   "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
///   "expires_in": 86400,
///   "token_type": "Bearer"
/// }
/// ```
pub async fn refresh_token(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<RefreshTokenRequest>,
) -> AppResult<(StatusCode, Json<TokenRefreshResponse>)> {
    // Verify refresh token
    let claims = AuthService::verify_token(&payload.refresh_token)?;

    // Verify it's actually a refresh token
    AuthService::verify_token_type(&claims, "refresh")?;

    // Generate new tokens
    let (access_token, refresh_token) = AuthService::generate_tokens(
        uuid::Uuid::parse_str(&claims.sub)
            .map_err(|_| AppError::InvalidToken)?,
        uuid::Uuid::parse_str(&claims.org_id)
            .map_err(|_| AppError::InvalidToken)?,
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

/// Get current user info (requires authentication)
///
/// GET /api/v1/auth/me
///
/// Headers:
/// ```
/// Authorization: Bearer <access_token>
/// ```
///
/// Response (200):
/// ```json
/// {
///   "id": "550e8400-e29b-41d4-a716-446655440000",
///   "email": "user@example.com",
///   "full_name": "John Doe",
///   "role": "mc",
///   ...
/// }
/// ```
pub async fn get_current_user(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<UserResponse>> {
    let user_id = uuid::Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::InvalidToken)?;

    let user = UserRepository::get_by_id(&state.db.pool(), user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(Json(UserResponse::from(user)))
}

/// Change password (requires authentication)
///
/// POST /api/v1/auth/change-password
///
/// Headers:
/// ```
/// Authorization: Bearer <access_token>
/// ```
///
/// Request:
/// ```json
/// {
///   "current_password": "old_password_123",
///   "new_password": "new_password_456",
///   "confirm_password": "new_password_456"
/// }
/// ```
pub async fn change_password(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<ChangePasswordRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    // Validate input
    payload.validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Verify passwords match
    if payload.new_password != payload.confirm_password {
        return Err(AppError::ValidationError(
            "New passwords do not match".to_string(),
        ));
    }

    let user_id = uuid::Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::InvalidToken)?;

    // Get user
    let user = UserRepository::get_by_id(&state.db.pool(), user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    // Verify current password
    let password_valid = AuthService::verify_password(
        &payload.current_password,
        &user.password_hash,
    )?;

    if !password_valid {
        return Err(AppError::Unauthorized(
            "Current password is incorrect".to_string(),
        ));
    }

    // Hash new password
    let new_password_hash = AuthService::hash_password(&payload.new_password)?;

    // Update password
    UserRepository::change_password(&state.db.pool(), user_id, &new_password_hash)
        .await?;

    tracing::info!(user_id = %user_id, "Password changed successfully");

    Ok((
        StatusCode::OK,
        Json(json!({
            "message": "Password changed successfully"
        })),
    ))
}
