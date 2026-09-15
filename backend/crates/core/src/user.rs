// src/models/user.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

/// Valid role constants — single source of truth
pub const VALID_ROLES: &[&str] = &[
    // Platform
    "superadmin", "platform_admin", "system_admin",
    // Account
    "account_admin", "event_manager", "event_accountant",
    "secretary", "scanner_attendant", "viewer",
];

pub fn is_valid_role(role: &str) -> bool {
    VALID_ROLES.contains(&role)
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub organization_id: Option<Uuid>,
    pub email: String,
    pub phone: Option<String>,
    pub full_name: String,
    pub password_hash: String,
    pub role: String, // see VALID_ROLES above
    pub user_scope: String, // "global" | "account"
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub full_name: String,
    pub phone: Option<String>,
    pub role: String,
    pub user_scope: String,
    pub is_active: bool,
    pub organization_id: Option<Uuid>,
    pub organization_name: Option<String>,
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
            user_scope: user.user_scope,
            is_active: user.is_active,
            organization_id: user.organization_id,
            organization_name: None,
            created_at: user.created_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[serde(alias = "email", alias = "username")]
    #[validate(length(min = 1, max = 255))]
    pub login: String,
    #[validate(length(min = 8, max = 128))]
    pub password: String,
}

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

#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub user: UserResponse,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: String,
}

#[derive(Debug, Serialize)]
pub struct TokenRefreshResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub org_id: String,
    pub email: String,
    pub role: String,
    pub exp: i64,
    pub iat: i64,
    pub token_type: String,
    pub impersonated_by: Option<String>,
    pub impersonated_at: Option<i64>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    #[validate(length(min = 8, max = 128))]
    pub new_password: String,
    #[validate(length(min = 8, max = 128))]
    pub confirm_password: String,
}
