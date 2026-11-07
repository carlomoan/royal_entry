use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;
use crate::{
    error::AppResult,
    models::user::Claims,
    utils::rbac::PLATFORM_ROLES,
    AppState,
};

/// A notification row as returned to clients.
#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct NotificationRow {
    pub id: Uuid,
    pub organization_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    /// Mirrors the DB column `type` (aliased in SQL) and serializes as `type`
    /// so existing clients keep working.
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    pub body: Option<String>,
    pub link: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub is_read: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub struct NotificationService {
    _state: Arc<AppState>,
}

impl NotificationService {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { _state: state }
    }

    // ── Read side (scoped to the caller) ─────────────────────────────────────

    /// Notifications visible to a user: personal ones plus everything for their
    /// organization.
    async fn scope_query(
        pool: &PgPool,
        claims: &Claims,
        limit: i64,
    ) -> AppResult<Vec<NotificationRow>> {
        let user_id = Uuid::parse_str(&claims.sub).map_err(|_| crate::error::AppError::InvalidToken)?;
        let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| crate::error::AppError::InvalidToken)?;

        let rows = sqlx::query_as::<_, NotificationRow>(
            "SELECT id, organization_id, user_id, type AS kind, title, body, link, metadata, is_read, created_at
             FROM notifications
             WHERE user_id = $1 OR organization_id = $2
             ORDER BY created_at DESC, id DESC
             LIMIT $3",
        )
        .bind(user_id)
        .bind(org_id)
        .bind(limit.max(1))
        .fetch_all(pool)
        .await?;

        Ok(rows)
    }

    pub async fn list_for(&self, claims: &Claims, limit: i64) -> AppResult<Vec<NotificationRow>> {
        Self::scope_query(self._state.db.pool(), claims, limit.clamp(1, 50)).await
    }

    pub async fn unread_count(&self, claims: &Claims) -> AppResult<i64> {
        let user_id = Uuid::parse_str(&claims.sub).map_err(|_| crate::error::AppError::InvalidToken)?;
        let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| crate::error::AppError::InvalidToken)?;

        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM notifications
             WHERE is_read = FALSE AND (user_id = $1 OR organization_id = $2)",
        )
        .bind(user_id)
        .bind(org_id)
        .fetch_one(self._state.db.pool())
        .await?;

        Ok(count)
    }

    pub async fn mark_read(&self, claims: &Claims, id: Uuid) -> AppResult<()> {
        let user_id = Uuid::parse_str(&claims.sub).map_err(|_| crate::error::AppError::InvalidToken)?;
        let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| crate::error::AppError::InvalidToken)?;

        sqlx::query(
            "UPDATE notifications SET is_read = TRUE
             WHERE id = $1 AND (user_id = $2 OR organization_id = $3)",
        )
        .bind(id)
        .bind(user_id)
        .bind(org_id)
        .execute(self._state.db.pool())
        .await?;

        Ok(())
    }

    pub async fn mark_all_read(&self, claims: &Claims) -> AppResult<()> {
        let user_id = Uuid::parse_str(&claims.sub).map_err(|_| crate::error::AppError::InvalidToken)?;
        let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| crate::error::AppError::InvalidToken)?;

        sqlx::query(
            "UPDATE notifications SET is_read = TRUE
             WHERE is_read = FALSE AND (user_id = $1 OR organization_id = $2)",
        )
        .bind(user_id)
        .bind(org_id)
        .execute(self._state.db.pool())
        .await?;

        Ok(())
    }

    // ── Write side (emitted by business flows) ───────────────────────────────

    /// Organization-wide notification — visible to every user of the org.
    pub async fn create_org(
        pool: &PgPool,
        org_id: Uuid,
        kind: &str,
        title: &str,
        body: Option<&str>,
        link: Option<&str>,
        metadata: Option<serde_json::Value>,
    ) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO notifications (id, organization_id, user_id, type, title, body, link, metadata, is_read, created_at)
             VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, FALSE, NOW())",
        )
        .bind(Uuid::new_v4())
        .bind(org_id)
        .bind(kind)
        .bind(title)
        .bind(body)
        .bind(link)
        .bind(metadata)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Personal notification for a single user.
    pub async fn create_user(
        pool: &PgPool,
        user_id: Uuid,
        kind: &str,
        title: &str,
        body: Option<&str>,
        link: Option<&str>,
        metadata: Option<serde_json::Value>,
    ) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO notifications (id, organization_id, user_id, type, title, body, link, metadata, is_read, created_at)
             VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, FALSE, NOW())",
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(kind)
        .bind(title)
        .bind(body)
        .bind(link)
        .bind(metadata)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Notify every active platform administrator (personal rows).
    pub async fn create_platform(
        pool: &PgPool,
        kind: &str,
        title: &str,
        body: Option<&str>,
        link: Option<&str>,
        metadata: Option<serde_json::Value>,
    ) -> AppResult<()> {
        let admins: Vec<Uuid> = sqlx::query_scalar(
            "SELECT id FROM users WHERE role = ANY($1) AND is_active = TRUE",
        )
        .bind(PLATFORM_ROLES)
        .fetch_all(pool)
        .await?;

        for admin_id in admins {
            Self::create_user(pool, admin_id, kind, title, body, link, metadata.clone()).await?;
        }
        Ok(())
    }
}
