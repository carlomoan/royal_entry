// ==============================================================================
// FILE: src/models/user.rs
// ==============================================================================
// User model and authentication DTOs

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use validator::Validate;

/// User database model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub email: String,
    pub phone: Option<String>,
    pub full_name: String,
    pub password_hash: String,
    pub role: String, // admin, mc, organizer, door_staff, viewer
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
}

/// User response (never expose password hash)
#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub full_name: String,
    pub phone: Option<String>,
    pub role: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            phone: user.phone,
            role: user.role,
            is_active: user.is_active,
            created_at: user.created_at,
        }
    }
}

/// Login request
#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[serde(alias = "email", alias = "username")]
    #[validate(length(min = 1, max = 255))]
    pub login: String,

    #[validate(length(min = 8, max = 128))]
    pub password: String,
}

/// Register request
#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(email)]
    pub email: String,

    #[validate(length(min = 8, max = 128))]
    pub password: String,

    #[validate(length(min = 2, max = 255))]
    pub full_name: String,

    #[validate(length(min = 10, max = 15, message = "Invalid phone number length"))]
    pub phone: String,
}

/// Refresh token request
#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

/// Authentication response (contains tokens)
#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub user: UserResponse,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64, // seconds
    pub token_type: String, // "Bearer"
}

/// Token refresh response
#[derive(Debug, Serialize)]
pub struct TokenRefreshResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: String,
}

/// JWT Claims
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,          // User ID
    pub org_id: String,       // Organization ID
    pub email: String,        // Email
    pub role: String,         // User role
    pub exp: i64,             // Expiration time
    pub iat: i64,             // Issued at
    pub token_type: String,   // "access" or "refresh"
}

/// Change password request
#[derive(Debug, Deserialize, Validate)]
pub struct ChangePasswordRequest {
    pub current_password: String,

    #[validate(length(min = 8, max = 128))]
    pub new_password: String,

    #[validate(length(min = 8, max = 128))]
    pub confirm_password: String,
}
