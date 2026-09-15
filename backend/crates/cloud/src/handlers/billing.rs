// ==============================================================================
// FILE: crates/cloud/src/handlers/billing.rs
// ==============================================================================
// Account-scoped billing: view own subscription, list invoices, self-service pay.
// ==============================================================================
use std::sync::Arc;
use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    services::mpesa::MpesaService,
    utils::rbac::claims_org_id,
    AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MySubscription {
    pub id: Uuid,
    pub status: String,
    pub plan_name: String,
    pub price_tsh: i64,
    pub billing_interval: String,
    pub current_period_start: DateTime<Utc>,
    pub current_period_end: DateTime<Utc>,
    pub trial_ends_at: Option<DateTime<Utc>>,
    pub cancel_at_period_end: bool,
    pub max_users: Option<i32>,
    pub max_events: Option<i32>,
    pub max_guests: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MyInvoice {
    pub id: Uuid,
    pub invoice_number: String,
    pub plan_name: Option<String>,
    pub amount_tsh: i64,
    pub status: String,
    pub issued_at: DateTime<Utc>,
    pub due_at: Option<DateTime<Utc>>,
    pub paid_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PayInvoiceRequest {
    pub phone: Option<String>,
}

/// GET /api/v1/billing/subscription
pub async fn get_my_subscription(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = claims_org_id(&claims)?;

    let subscription = sqlx::query_as::<_, MySubscription>(
        r#"
        SELECT os.id, os.status,
               sp.name AS plan_name, sp.price_tsh, sp.billing_interval,
               os.current_period_start, os.current_period_end, os.trial_ends_at,
               os.cancel_at_period_end, sp.max_users, sp.max_events, sp.max_guests
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

    Ok(Json(json!({ "success": true, "data": subscription })))
}

/// GET /api/v1/billing/invoices
pub async fn list_my_invoices(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = claims_org_id(&claims)?;

    let invoices = sqlx::query_as::<_, MyInvoice>(
        r#"
        SELECT bi.id, bi.invoice_number, sp.name AS plan_name, bi.amount_tsh, bi.status,
               bi.issued_at, bi.due_at, bi.paid_at, bi.notes
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

    let outstanding_tsh: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount_tsh), 0) FROM billing_invoices
         WHERE organization_id = $1 AND status IN ('open', 'overdue')",
    )
    .bind(org_id)
    .fetch_one(state.db.pool())
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": { "invoices": invoices, "outstanding_tsh": outstanding_tsh }
    })))
}

/// POST /api/v1/billing/invoices/{id}/pay — self-service M-Pesa STK push
pub async fn pay_invoice(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
    Json(payload): Json<PayInvoiceRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = claims_org_id(&claims)?;

    let row = sqlx::query(
        "SELECT id, organization_id, amount_tsh, status, invoice_number
         FROM billing_invoices WHERE id = $1",
    )
    .bind(invoice_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Invoice not found".to_string()))?;

    let inv_org: Uuid = row.try_get("organization_id")?;
    if inv_org != org_id {
        return Err(AppError::Forbidden);
    }

    let status: String = row.try_get("status")?;
    if status == "paid" {
        return Err(AppError::Conflict("Invoice is already paid".to_string()));
    }

    let amount_tsh: i64 = row.try_get("amount_tsh")?;
    let invoice_number: String = row.try_get("invoice_number")?;

    let phone = match payload.phone.filter(|p| !p.trim().is_empty()) {
        Some(p) => p,
        None => sqlx::query_scalar::<_, Option<String>>(
            "SELECT contact_phone FROM organizations WHERE id = $1",
        )
        .bind(org_id)
        .fetch_one(state.db.pool())
        .await?
        .unwrap_or_default(),
    };
    if phone.trim().is_empty() {
        return Err(AppError::BadRequest(
            "No phone on file. Provide an M-Pesa phone number.".to_string(),
        ));
    }

    // Initiate STK push
    let mpesa = MpesaService::new(state.clone());
    let stk = mpesa
        .stk_push(
            &phone,
            amount_tsh as u64,
            &format!("INV-{}", &invoice_number[..invoice_number.len().min(12)]),
            &format!("RoyalEntry invoice {}", invoice_number),
        )
        .await?;

    // Record the pending payment linked to the invoice
    let payment_id = Uuid::new_v4();
    let now = Utc::now();
    sqlx::query(
        r#"
        INSERT INTO payments (
            id, organization_id, event_id, payment_type, package_name,
            amount_tsh, payment_method, payer_phone, status,
            payment_gateway, notes, created_at, updated_at, invoice_id
        ) VALUES ($1, $2, NULL, 'subscription', $3, $4, 'mpesa', $5, 'pending', 'mpesa', $6, $7, $7, $8)
        "#,
    )
    .bind(payment_id)
    .bind(org_id)
    .bind(format!("Invoice {}", invoice_number))
    .bind(amount_tsh)
    .bind(MpesaService::normalize_phone(&phone))
    .bind("Self-service invoice payment")
    .bind(now)
    .bind(invoice_id)
    .execute(state.db.pool())
    .await?;

    sqlx::query("UPDATE payments SET provider_checkout_request_id = $1 WHERE id = $2")
        .bind(&stk.checkout_request_id)
        .bind(payment_id)
        .execute(state.db.pool())
        .await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "payment_id": payment_id,
            "checkout_request_id": stk.checkout_request_id,
            "message": format!(
                "Payment request sent to {}. Enter your M-Pesa PIN to confirm.",
                phone
            ),
        }
    })))
}

/// GET /api/v1/billing/usage — current org resource usage (counts only).
pub async fn get_my_usage(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = claims_org_id(&claims)?;
    let row = sqlx::query(
        r#"
        SELECT
            (SELECT COUNT(*) FROM events WHERE organization_id = $1 AND deleted_at IS NULL) AS events_used,
            (SELECT COUNT(*) FROM guests g JOIN events e ON e.id = g.event_id WHERE e.organization_id = $1 AND e.deleted_at IS NULL) AS guests_used,
            (SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = TRUE) AS users_used
        "#,
    )
    .bind(org_id)
    .fetch_one(state.db.pool())
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "events": row.try_get::<i64, _>("events_used").unwrap_or(0),
            "guests": row.try_get::<i64, _>("guests_used").unwrap_or(0),
            "users":  row.try_get::<i64, _>("users_used").unwrap_or(0),
        }
    })))
}
