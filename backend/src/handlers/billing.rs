// ==============================================================================
// FILE: src/handlers/billing.rs
// ==============================================================================
// Account-scoped billing views (own subscription + invoices + usage).
use std::sync::Arc;
use axum::{extract::State, Extension, Json};
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;
use crate::{
    error::AppResult,
    models::user::Claims,
    utils::rbac::claims_org_id,
    AppState,
};

/// GET /api/v1/billing/subscription — current org's active subscription + plan
/// (includes plan limits AND feature flags so Billing/Usage pages can reflect
///  the assigned package exactly).
pub async fn get_my_subscription(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = claims_org_id(&claims)?;

    let row = sqlx::query(
        r#"
        SELECT os.id, os.status, os.current_period_start, os.current_period_end,
               os.trial_ends_at, os.cancel_at_period_end,
               sp.code AS plan_code, sp.name AS plan_name, sp.price_tsh,
               sp.billing_interval, sp.max_users, sp.max_events, sp.max_guests,
               sp.features
        FROM organization_subscriptions os
        JOIN service_plans sp ON sp.id = os.plan_id
        WHERE os.organization_id = $1
        ORDER BY os.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(org_id)
    .fetch_optional(state.db.pool())
    .await?;

    // ✅ Map the row field-by-field (a raw PgRow cannot be serialized).
    let data = match row {
        Some(r) => json!({
            "id":                   r.try_get::<Uuid, _>("id").ok(),
            "status":               r.try_get::<String, _>("status").ok(),
            "plan_code":            r.try_get::<String, _>("plan_code").ok(),
            "plan_name":            r.try_get::<String, _>("plan_name").ok(),
            "price_tsh":            r.try_get::<i64, _>("price_tsh").ok(),
            "billing_interval":     r.try_get::<String, _>("billing_interval").ok(),
            "current_period_start": r.try_get::<DateTime<Utc>, _>("current_period_start").ok(),
            "current_period_end":   r.try_get::<DateTime<Utc>, _>("current_period_end").ok(),
            "trial_ends_at":        r.try_get::<Option<DateTime<Utc>>, _>("trial_ends_at").ok().flatten(),
            "cancel_at_period_end": r.try_get::<bool, _>("cancel_at_period_end").ok(),
            "max_users":            r.try_get::<Option<i32>, _>("max_users").ok().flatten(),
            "max_events":           r.try_get::<Option<i32>, _>("max_events").ok().flatten(),
            "max_guests":           r.try_get::<Option<i32>, _>("max_guests").ok().flatten(),
            "features":             r.try_get::<serde_json::Value, _>("features").ok(),
        }),
        None => serde_json::Value::Null,
    };

    Ok(Json(json!({ "success": true, "data": data })))
}

/// GET /api/v1/billing/invoices — current org's invoices (newest first)
pub async fn list_my_invoices(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = claims_org_id(&claims)?;

    let rows = sqlx::query(
        r#"
        SELECT bi.id, bi.invoice_number, bi.amount_tsh, bi.status, bi.issued_at,
               bi.due_at, bi.paid_at, bi.notes, sp.name AS plan_name
        FROM billing_invoices bi
        LEFT JOIN service_plans sp ON sp.id = bi.plan_id
        WHERE bi.organization_id = $1
        ORDER BY bi.issued_at DESC
        LIMIT 25
        "#,
    )
    .bind(org_id)
    .fetch_all(state.db.pool())
    .await?;

    let invoices: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id":             r.try_get::<Uuid, _>("id").ok(),
                "invoice_number": r.try_get::<String, _>("invoice_number").ok(),
                "amount_tsh":     r.try_get::<i64, _>("amount_tsh").ok(),
                "status":         r.try_get::<String, _>("status").ok(),
                "issued_at":      r.try_get::<DateTime<Utc>, _>("issued_at").ok(),
                "due_at":         r.try_get::<Option<DateTime<Utc>>, _>("due_at").ok().flatten(),
                "paid_at":        r.try_get::<Option<DateTime<Utc>>, _>("paid_at").ok().flatten(),
                "plan_name":      r.try_get::<Option<String>, _>("plan_name").ok().flatten(),
            })
        })
        .collect();

    Ok(Json(json!({ "success": true, "data": invoices })))
}

/// GET /api/v1/billing/usage — live usage counts measured against the plan.
pub async fn get_my_usage(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = claims_org_id(&claims)?;

    let row = sqlx::query(
        r#"
        SELECT
            (SELECT COUNT(*) FROM events
              WHERE organization_id = $1 AND deleted_at IS NULL) AS events_used,
            (SELECT COUNT(*) FROM guests g
              JOIN events e ON e.id = g.event_id
              WHERE e.organization_id = $1 AND e.deleted_at IS NULL) AS guests_used,
            (SELECT COUNT(*) FROM users
              WHERE organization_id = $1 AND is_active = TRUE) AS users_used,
            (SELECT COUNT(*) FROM entry_scans es
              JOIN events e ON e.id = es.event_id
              WHERE e.organization_id = $1 AND e.deleted_at IS NULL) AS scans_used,
            (SELECT COUNT(*) FROM payments
              WHERE organization_id = $1 AND status = 'completed') AS payments_used
        "#,
    )
    .bind(org_id)
    .fetch_one(state.db.pool())
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "events":   row.try_get::<i64, _>("events_used").unwrap_or(0),
            "guests":   row.try_get::<i64, _>("guests_used").unwrap_or(0),
            "users":    row.try_get::<i64, _>("users_used").unwrap_or(0),
            "scans":    row.try_get::<i64, _>("scans_used").unwrap_or(0),
            "payments": row.try_get::<i64, _>("payments_used").unwrap_or(0),
        }
    })))
}
