
// ==============================================================================
// FILE: src/repository/user_repository.rs
// ==============================================================================
// Database operations for users

use sqlx::PgPool;
use uuid::Uuid;
use chrono::Utc;
use crate::models::user::User;
use crate::error::AppResult;

pub struct UserRepository;

impl UserRepository {
    /// Get user by email
    pub async fn get_by_email(pool: &PgPool, email: &str) -> AppResult<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE email = $1 AND is_active = true"
        )
        .bind(email.to_lowercase())
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    /// Get user by login identifier (email or username/local-part)
    pub async fn get_by_login(pool: &PgPool, login: &str) -> AppResult<Option<User>> {
        let login = login.trim().to_lowercase();

        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT *
            FROM users
            WHERE is_active = true
              AND (
                LOWER(email) = $1
                OR split_part(LOWER(email), '@', 1) = $1
              )
            LIMIT 1
            "#
        )
        .bind(login)
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    /// Get user by ID
    pub async fn get_by_id(pool: &PgPool, user_id: Uuid) -> AppResult<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE id = $1 AND is_active = true"
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    /// Create new user
    pub async fn create(
        pool: &PgPool,
        org_id: Uuid,
        email: &str,
        password_hash: &str,
        full_name: &str,
        phone: &str,
        role: &str,
    ) -> AppResult<User> {
        let user_id = Uuid::new_v4();
        let now = Utc::now();

        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users
            (id, organization_id, email, password_hash, full_name, phone, role, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)
            RETURNING *
            "#
        )
        .bind(&user_id)
        .bind(&org_id)
        .bind(email.to_lowercase())
        .bind(password_hash)
        .bind(full_name)
        .bind(phone)
        .bind(role)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await?;

        tracing::info!(
            user_id = %user_id,
            email = email,
            "User created successfully"
        );

        Ok(user)
    }

    /// Check if email already exists
    pub async fn email_exists(pool: &PgPool, email: &str) -> AppResult<bool> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE email = $1"
        )
        .bind(email.to_lowercase())
        .fetch_one(pool)
        .await?;

        Ok(count > 0)
    }

    /// Update last login timestamp
    pub async fn update_last_login(pool: &PgPool, user_id: Uuid) -> AppResult<()> {
        sqlx::query(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1"
        )
        .bind(user_id)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Change password
    pub async fn change_password(
        pool: &PgPool,
        user_id: Uuid,
        new_password_hash: &str,
    ) -> AppResult<()> {
        let now = Utc::now();

        sqlx::query(
            "UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3"
        )
        .bind(new_password_hash)
        .bind(now)
        .bind(user_id)
        .execute(pool)
        .await?;

        tracing::info!(user_id = %user_id, "Password changed");

        Ok(())
    }
}
