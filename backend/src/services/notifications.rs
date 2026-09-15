// ==============================================================================
// FILE: src/services/notifications.rs
// ==============================================================================
// In-app notification engine: push, list, unread count, mark read.
// Visibility: personal → org-wide → global (platform admins).
// ==============================================================================
use std::sync::Arc;
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;
use crate::{
    error::AppResult,
    models::user::Claims,
    utils::rbac::is_platform_role,
    AppState,
};

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Notification {
    pub id: Uuid,
    pub organization_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub r#type: String,
    pub title: String,
    pub body: Option<String>,
    pub link: Option<String>,
    pub metadata: Option<Value>,
    pub is_read: bool,
    pub created_at: DateTime<Utc>,
}

const VISIBILITY_PREDICATE: &str = r#"
    ( user_id = $1
      OR (user_id IS NULL AND organization_id = $2)
      OR (user_id IS NULL AND organization_id IS NULL AND $3) )
"#;

pub struct NotificationService {
    state: Arc<AppState>,
}

impl NotificationService {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// Fire-and-forget push — never fails the caller's flow.
    pub async fn push(
        &self,
        organization_id: Option<Uuid>,
        user_id: Option<Uuid>,
        kind: &str,
        title: &str,
        body: Option<&str>,
        link: Option<&str>,
    ) {
        let result = sqlx::query(
            "INSERT INTO notifications (id, organization_id, user_id, type, title, body, link, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
        )
        .bind(Uuid::new_v4())
        .bind(organization_id)
        .bind(user_id)
        .bind(kind)
        .bind(title)
        .bind(body)
        .bind(link)
        .execute(&*self.state.db.pool())
        .await;

        if let Err(e) = result {
            tracing::warn!(error = %e, "Failed to push notification");
        }
    }

    fn visibility(&self, claims: &Claims) -> (Uuid, Uuid, bool) {
        let user_id = Uuid::parse_str(&claims.sub).unwrap_or_else(|_| Uuid::nil());
        let org_id = Uuid::parse_str(&claims.org_id).unwrap_or_else(|_| Uuid::nil());
        (user_id, org_id, is_platform_role(&claims.role))
    }

    pub async fn list_for(&self, claims: &Claims, limit: i64) -> AppResult<Vec<Notification>> {
        let (user_id, org_id, is_platform) = self.visibility(claims);
        let sql = format!(
            "SELECT * FROM notifications WHERE {} ORDER BY created_at DESC LIMIT $4",
            VISIBILITY_PREDICATE
        );
        let rows = sqlx::query_as::<_, Notification>(&sql)
            .bind(user_id)
            .bind(org_id)
            .bind(is_platform)
            .bind(limit)
            .fetch_all(&*self.state.db.pool())
            .await?;
        Ok(rows)
    }

    pub async fn unread_count(&self, claims: &Claims) -> AppResult<i64> {
        let (user_id, org_id, is_platform) = self.visibility(claims);
        let sql = format!(
            "SELECT COUNT(*) FROM notifications WHERE {} AND is_read = FALSE",
            VISIBILITY_PREDICATE
        );
        let count: i64 = sqlx::query_scalar(&sql)
            .bind(user_id)
            .bind(org_id)
            .bind(is_platform)
            .fetch_one(&*self.state.db.pool())
            .await?;
        Ok(count)
    }

    pub async fn mark_read(&self, claims: &Claims, id: Uuid) -> AppResult<()> {
        let (user_id, org_id, is_platform) = self.visibility(claims);
        let sql = format!(
            "UPDATE notifications SET is_read = TRUE WHERE id = $4 AND {}",
            VISIBILITY_PREDICATE
        );
        sqlx::query(&sql)
            .bind(user_id)
            .bind(org_id)
            .bind(is_platform)
            .bind(id)
            .execute(&*self.state.db.pool())
            .await?;
        Ok(())
    }

    pub async fn mark_all_read(&self, claims: &Claims) -> AppResult<()> {
        let (user_id, org_id, is_platform) = self.visibility(claims);
        let sql = format!(
            "UPDATE notifications SET is_read = TRUE WHERE {} AND is_read = FALSE",
            VISIBILITY_PREDICATE
        );
        sqlx::query(&sql)
            .bind(user_id)
            .bind(org_id)
            .bind(is_platform)
            .execute(&*self.state.db.pool())
            .await?;
        Ok(())
    }
}
