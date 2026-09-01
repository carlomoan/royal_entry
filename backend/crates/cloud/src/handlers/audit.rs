use std::sync::Arc;

use axum::{
    extract::{Query, State},
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    error::AppResult,
    models::user::Claims,
    utils::rbac::{claims_org_id, require_account_admin, require_platform_admin},
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub organization_id: Option<Uuid>,
    pub action: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditLogResponse {
    pub id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub user_id: Option<Uuid>,
    pub organization_id: Option<Uuid>,
    pub user_email: Option<String>,
    pub role: Option<String>,
    pub method: String,
    pub path: String,
    pub action: String,
    pub status_code: i32,
    pub target_resource_type: Option<String>,
    pub target_resource_id: Option<String>,
}

fn csv_escape(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

pub async fn list_audit_logs(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<AuditQuery>,
) -> AppResult<Json<serde_json::Value>> {
    require_account_admin(&claims)?;

    let limit = query.per_page.unwrap_or(25).clamp(1, 200);
    let page = query.page.unwrap_or(1).max(1);
    let offset = (page - 1) * limit;
    let org_id = if require_platform_admin(&claims).is_ok() {
        query.organization_id
    } else {
        Some(claims_org_id(&claims)?)
    };

    let logs = sqlx::query_as::<_, AuditLogResponse>(
        r#"
        SELECT
            id,
            occurred_at,
            user_id,
            organization_id,
            user_email,
            role,
            method,
            path,
            action,
            status_code,
            target_resource_type,
            target_resource_id
        FROM audit_logs
        WHERE ($1::uuid IS NULL OR organization_id = $1)
          AND ($2::text IS NULL OR action ILIKE '%' || $2 || '%')
        ORDER BY occurred_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(org_id)
    .bind(query.action.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(state.db.pool())
    .await?;

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM audit_logs
        WHERE ($1::uuid IS NULL OR organization_id = $1)
          AND ($2::text IS NULL OR action ILIKE '%' || $2 || '%')
        "#,
    )
    .bind(org_id)
    .bind(query.action.as_deref())
    .fetch_one(state.db.pool())
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": logs,
        "pagination": {
            "page": page,
            "per_page": limit,
            "total": total,
            "total_pages": if total == 0 { 0 } else { ((total as f64) / (limit as f64)).ceil() as i64 }
        }
    })))
}

pub async fn export_audit_logs(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<AuditQuery>,
) -> AppResult<Json<serde_json::Value>> {
    require_account_admin(&claims)?;

    let org_id = if require_platform_admin(&claims).is_ok() {
        query.organization_id
    } else {
        Some(claims_org_id(&claims)?)
    };

    let logs = sqlx::query_as::<_, AuditLogResponse>(
        r#"
        SELECT
            id,
            occurred_at,
            user_id,
            organization_id,
            user_email,
            role,
            method,
            path,
            action,
            status_code,
            target_resource_type,
            target_resource_id
        FROM audit_logs
        WHERE ($1::uuid IS NULL OR organization_id = $1)
          AND ($2::text IS NULL OR action ILIKE '%' || $2 || '%')
        ORDER BY occurred_at DESC
        LIMIT 5000
        "#,
    )
    .bind(org_id)
    .bind(query.action.as_deref())
    .fetch_all(state.db.pool())
    .await?;

    let mut lines = vec![
        "occurred_at,user_email,role,method,path,action,status_code,target_resource_type,target_resource_id".to_string(),
    ];
    for log in logs {
        lines.push(vec![
            csv_escape(&log.occurred_at.to_rfc3339()),
            csv_escape(log.user_email.as_deref().unwrap_or("")),
            csv_escape(log.role.as_deref().unwrap_or("")),
            csv_escape(&log.method),
            csv_escape(&log.path),
            csv_escape(&log.action),
            log.status_code.to_string(),
            csv_escape(log.target_resource_type.as_deref().unwrap_or("")),
            csv_escape(log.target_resource_id.as_deref().unwrap_or("")),
        ]
        .join(","));
    }

    Ok(Json(json!({
        "success": true,
        "data": {
            "filename": format!("audit-report-{}.csv", Utc::now().format("%Y%m%d-%H%M%S")),
            "content": lines.join("\n"),
        }
    })))
}

#[derive(Debug, serde::Deserialize)]
pub struct AuditResetQuery {
    /// Number of days to keep. Anything older than this is deleted.
    /// e.g. 30, 90, 180, 365. Pass 0 or omit to delete all logs.
    pub days: Option<i64>,
    /// Optional: scope to a specific organization (platform admin only).
    pub organization_id: Option<Uuid>,
}

/// Purge old audit log entries. Platform admins may target a specific
/// organization; account admins are implicitly scoped to their own org.
pub async fn reset_audit_logs(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<AuditResetQuery>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let days = q.days.unwrap_or(0);
    let cutoff = if days <= 0 {
        // 0 days = delete everything
        chrono::Utc::now() + chrono::Duration::days(1)
    } else {
        chrono::Utc::now() - chrono::Duration::days(days)
    };

    let deleted = if let Some(org_id) = q.organization_id {
        sqlx::query("DELETE FROM audit_logs WHERE organization_id = $1 AND occurred_at < $2")
            .bind(org_id)
            .bind(cutoff)
            .execute(state.db.pool())
            .await?
            .rows_affected()
    } else {
        sqlx::query("DELETE FROM audit_logs WHERE occurred_at < $1")
            .bind(cutoff)
            .execute(state.db.pool())
            .await?
            .rows_affected()
    };

    tracing::info!(
        actor = %claims.sub,
        days = days,
        deleted = deleted,
        "Audit logs reset"
    );

    Ok(Json(json!({
        "success": true,
        "data": {
            "deleted": deleted,
            "retention_days": days,
            "cutoff": cutoff.to_rfc3339(),
        },
        "message": format!("{} audit log entries purged", deleted)
    })))
}
