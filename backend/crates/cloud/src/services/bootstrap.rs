// ==============================================================================
// FILE: src/services/bootstrap.rs
// ==============================================================================
use std::env;
use sqlx::PgPool;
use uuid::Uuid;
use crate::{
    error::AppResult,
    repository::user_repository::UserRepository,
    services::auth::AuthService,
};

pub struct BootstrapService;

impl BootstrapService {
    pub async fn bootstrap_auth(pool: &PgPool) -> AppResult<()> {
        Self::ensure_default_admin(pool).await?;
        Ok(())
    }

    async fn ensure_default_admin(pool: &PgPool) -> AppResult<()> {
        let admin_email = env::var("ADMIN_EMAIL")
            .unwrap_or_else(|_| "admin@royalentry.co.tz".to_string())
            .trim()
            .to_lowercase();
        let admin_password = env::var("ADMIN_PASSWORD")
            .unwrap_or_else(|_| "Admin@123".to_string());
        let admin_phone = env::var("ADMIN_PHONE")
            .unwrap_or_else(|_| "+255700000000".to_string());
        let admin_name = env::var("ADMIN_NAME")
            .unwrap_or_else(|_| "Super Admin".to_string());

        if UserRepository::email_exists(pool, &admin_email).await? {
            tracing::info!(email = %admin_email, "Default admin user already exists");
            return Ok(());
        }

        let password_hash = AuthService::hash_password(&admin_password)?;

        // Platform organization ID — global superadmin has no org
        let platform_org_id: Option<Uuid> = None;

        // FIX: Changed role from "admin" to "superadmin" to match the new DB CHECK constraint
        let user = UserRepository::create(
            pool,
            platform_org_id,
            &admin_email,
            &password_hash,
            &admin_name,
            &admin_phone,
            "superadmin",
        )
        .await?;

        let username = admin_email
            .split('@')
            .next()
            .unwrap_or(admin_email.as_str());

        tracing::info!(
            user_id = %user.id,
            email = %user.email,
            username = %username,
            "Bootstrapped default superadmin user"
        );
        Ok(())
    }
}
