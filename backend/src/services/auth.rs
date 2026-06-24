// ==============================================================================
// FILE: src/services/auth.rs
// ==============================================================================
// Authentication service: JWT, password hashing, token generation

use crate::error::{AppError, AppResult};
use crate::models::user::Claims;
use argon2::{Argon2, PasswordHasher, PasswordVerifier};
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use password_hash::{PasswordHash, SaltString};
use password_hash::rand_core::OsRng;
use std::env;
use uuid::Uuid;

pub struct AuthService;

impl AuthService {
    // ========================================================================
    // JWT Token Operations
    // ========================================================================

    /// Generate JWT access token (short-lived: 24 hours)
    pub fn generate_access_token(
        user_id: Uuid,
        org_id: Uuid,
        email: String,
        role: String,
    ) -> AppResult<String> {
        let secret = env::var("JWT_SECRET").map_err(|_| AppError::InternalServerError)?;

        let expiry_hours = env::var("JWT_EXPIRY_HOURS")
            .ok()
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(24);

        let now = Utc::now();
        let exp = (now + chrono::Duration::hours(expiry_hours)).timestamp();

        let claims = Claims {
            sub: user_id.to_string(),
            org_id: org_id.to_string(),
            email,
            role,
            exp,
            iat: now.timestamp(),
            token_type: "access".to_string(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(secret.as_ref()),
        )
        .map_err(|_| AppError::TokenGenerationFailed)
    }

    /// Generate JWT refresh token (long-lived: 30 days)
    pub fn generate_refresh_token(user_id: Uuid, org_id: Uuid, email: String) -> AppResult<String> {
        let secret = env::var("JWT_SECRET").map_err(|_| AppError::InternalServerError)?;

        let refresh_expiry_days = env::var("JWT_REFRESH_EXPIRY_DAYS")
            .ok()
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(30);

        let now = Utc::now();
        let exp = (now + chrono::Duration::days(refresh_expiry_days)).timestamp();

        let claims = Claims {
            sub: user_id.to_string(),
            org_id: org_id.to_string(),
            email,
            role: "refresh".to_string(), // Refresh tokens have special role
            exp,
            iat: now.timestamp(),
            token_type: "refresh".to_string(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(secret.as_ref()),
        )
        .map_err(|_| AppError::TokenGenerationFailed)
    }

    /// Verify and decode JWT token
    pub fn verify_token(token: &str) -> AppResult<Claims> {
        let secret = env::var("JWT_SECRET").map_err(|_| AppError::InternalServerError)?;

        decode::<Claims>(
            token,
            &DecodingKey::from_secret(secret.as_ref()),
            &Validation::default(),
        )
        .map(|data| data.claims)
        .map_err(|err| {
            tracing::warn!("Token verification failed: {}", err);
            AppError::InvalidToken
        })
    }

    /// Verify token is of specific type (access or refresh)
    pub fn verify_token_type(claims: &Claims, expected_type: &str) -> AppResult<()> {
        if claims.token_type != expected_type {
            return Err(AppError::InvalidTokenType(expected_type.to_string()));
        }
        Ok(())
    }

    // ========================================================================
    // Password Hashing & Verification
    // ========================================================================

    /// Hash a password using Argon2
    pub fn hash_password(password: &str) -> AppResult<String> {
        // Generate random salt
        let salt = SaltString::generate(&mut OsRng);

        // Hash password
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| {
                tracing::error!("Password hashing failed: {}", e);
                AppError::PasswordHashingFailed
            })?;

        Ok(hash.to_string())
    }

    /// Verify password against hash
    pub fn verify_password(password: &str, hash: &str) -> AppResult<bool> {
        let parsed_hash = PasswordHash::new(hash).map_err(|_| AppError::InvalidPasswordHash)?;

        match Argon2::default().verify_password(password.as_bytes(), &parsed_hash) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false), // Password doesn't match, but don't error
        }
    }

    // ========================================================================
    // Token Generation Helper
    // ========================================================================

    /// Generate both access and refresh tokens
    pub fn generate_tokens(
        user_id: Uuid,
        org_id: Uuid,
        email: String,
        role: String,
    ) -> AppResult<(String, String)> {
        let access_token = Self::generate_access_token(user_id, org_id, email.clone(), role)?;

        let refresh_token = Self::generate_refresh_token(user_id, org_id, email)?;

        Ok((access_token, refresh_token))
    }
}
