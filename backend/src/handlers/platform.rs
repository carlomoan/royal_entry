use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    utils::rbac::require_platform_admin,
    AppState,
};

#[derive(Debug, Serialize)]
pub struct PlatformSummaryResponse {
    pub total_customers: i64,
    pub active_customers: i64,
    pub suspended_customers: i64,
    pub total_users: i64,
    pub active_events: i64,
    pub total_revenue_tsh: i64,
    pub pending_payments: i64,
    pub active_subscriptions: i64,
    pub past_due_subscriptions: i64,
    pub monthly_recurring_revenue_tsh: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlatformCustomerResponse {
    pub organization_id: Uuid,
    pub display_name: String,
    pub admin_email: String,
    pub account_status: String,
    pub users_count: i64,
    pub events_count: i64,
    pub active_events_count: i64,
    pub total_payments_count: i64,
    pub completed_payments_count: i64,
    pub total_revenue_tsh: i64,
    pub last_payment_at: Option<DateTime<Utc>>,
    pub last_activity_at: Option<DateTime<Utc>>,
    pub current_plan_name: Option<String>,
    pub subscription_status: Option<String>,
    pub subscription_period_end: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlatformCustomerUserResponse {
    pub id: Uuid,
    pub email: String,
    pub full_name: String,
    pub role: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlatformCustomerPaymentResponse {
    pub id: Uuid,
    pub package_name: Option<String>,
    pub amount_tsh: i64,
    pub payment_method: String,
    pub payer_phone: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlatformPlanResponse {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub price_tsh: i64,
    pub billing_interval: String,
    pub max_users: Option<i32>,
    pub max_events: Option<i32>,
    pub is_active: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlatformSubscriptionResponse {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub plan_id: Uuid,
    pub plan_code: String,
    pub plan_name: String,
    pub price_tsh: i64,
    pub billing_interval: String,
    pub status: String,
    pub current_period_start: DateTime<Utc>,
    pub current_period_end: DateTime<Utc>,
    pub trial_ends_at: Option<DateTime<Utc>>,
    pub cancel_at_period_end: bool,
    pub cancelled_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlatformInvoiceResponse {
    pub id: Uuid,
    pub invoice_number: String,
    pub plan_name: Option<String>,
    pub amount_tsh: i64,
    pub status: String,
    pub issued_at: DateTime<Utc>,
    pub due_at: Option<DateTime<Utc>>,
    pub paid_at: Option<DateTime<Utc>>,
    pub period_start: Option<DateTime<Utc>>,
    pub period_end: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PlatformCustomerDetailResponse {
    pub customer: PlatformCustomerResponse,
    pub users: Vec<PlatformCustomerUserResponse>,
    pub recent_payments: Vec<PlatformCustomerPaymentResponse>,
    pub current_subscription: Option<PlatformSubscriptionResponse>,
    pub recent_invoices: Vec<PlatformInvoiceResponse>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCustomerStatusRequest {
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCustomerSubscriptionRequest {
    pub plan_id: Uuid,
    pub status: String,
    pub create_invoice: Option<bool>,
    pub due_in_days: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInvoiceRequest {
    pub plan_id: Option<Uuid>,
    pub due_in_days: Option<i64>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MarkInvoicePaidRequest {
    pub payment_method: Option<String>,
    pub payer_phone: Option<String>,
    pub notes: Option<String>,
}

fn normalize_subscription_status(status: &str) -> AppResult<String> {
    let normalized = status.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "trialing" | "active" | "past_due" | "cancelled" | "expired" => Ok(normalized),
        _ => Err(AppError::BadRequest(
            "Invalid subscription status. Use trialing, active, past_due, cancelled, or expired"
                .to_string(),
        )),
    }
}

fn normalize_payment_method(payment_method: Option<&str>) -> String {
    let normalized = payment_method
        .unwrap_or("manual")
        .trim()
        .to_ascii_lowercase();

    if normalized.is_empty() {
        "manual".to_string()
    } else {
        normalized
    }
}

fn billing_duration(interval: &str) -> Duration {
    match interval.trim().to_ascii_lowercase().as_str() {
        "yearly" => Duration::days(365),
        "weekly" => Duration::days(7),
        _ => Duration::days(30),
    }
}

fn generate_invoice_number() -> String {
    format!(
        "INV-{}-{}",
        Utc::now().format("%Y%m%d%H%M%S"),
        &Uuid::new_v4().simple().to_string()[..8]
    )
}

async fn fetch_subscription(
    state: &Arc<AppState>,
    organization_id: Uuid,
) -> AppResult<Option<PlatformSubscriptionResponse>> {
    let subscription = sqlx::query_as::<_, PlatformSubscriptionResponse>(
        r#"
        SELECT
            os.id,
            os.organization_id,
            os.plan_id,
            sp.code AS plan_code,
            sp.name AS plan_name,
            sp.price_tsh,
            sp.billing_interval,
            os.status,
            os.current_period_start,
            os.current_period_end,
            os.trial_ends_at,
            os.cancel_at_period_end,
            os.cancelled_at
        FROM organization_subscriptions os
        JOIN service_plans sp ON sp.id = os.plan_id
        WHERE os.organization_id = $1
        "#,
    )
    .bind(organization_id)
    .fetch_optional(state.db.pool())
    .await?;

    Ok(subscription)
}

async fn fetch_invoices(
    state: &Arc<AppState>,
    organization_id: Uuid,
) -> AppResult<Vec<PlatformInvoiceResponse>> {
    let invoices = sqlx::query_as::<_, PlatformInvoiceResponse>(
        r#"
        SELECT
            bi.id,
            bi.invoice_number,
            sp.name AS plan_name,
            bi.amount_tsh,
            bi.status,
            bi.issued_at,
            bi.due_at,
            bi.paid_at,
            bi.period_start,
            bi.period_end,
            bi.notes
        FROM billing_invoices bi
        LEFT JOIN service_plans sp ON sp.id = bi.plan_id
        WHERE bi.organization_id = $1
        ORDER BY bi.issued_at DESC
        LIMIT 12
        "#,
    )
    .bind(organization_id)
    .fetch_all(state.db.pool())
    .await?;

    Ok(invoices)
}

pub async fn get_platform_summary(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let row = sqlx::query(
        r#"
        WITH orgs AS (
            SELECT organization_id, BOOL_OR(is_active) AS has_active_users
            FROM users
            GROUP BY organization_id
        ),
        subscription_metrics AS (
            SELECT
                COUNT(*) FILTER (WHERE os.status IN ('active', 'trialing')) AS active_subscriptions,
                COUNT(*) FILTER (WHERE os.status = 'past_due') AS past_due_subscriptions,
                COALESCE(SUM(sp.price_tsh) FILTER (WHERE os.status IN ('active', 'trialing'))::BIGINT, 0) AS monthly_recurring_revenue_tsh
            FROM organization_subscriptions os
            JOIN service_plans sp ON sp.id = os.plan_id
        )
        SELECT
            (SELECT COUNT(*) FROM orgs) AS total_customers,
            (SELECT COUNT(*) FROM orgs WHERE has_active_users = TRUE) AS active_customers,
            (SELECT COUNT(*) FROM orgs WHERE has_active_users = FALSE) AS suspended_customers,
            (SELECT COUNT(*) FROM users) AS total_users,
            (SELECT COUNT(*) FROM events WHERE status = 'active' AND deleted_at IS NULL) AS active_events,
            (SELECT COALESCE(SUM(amount_tsh)::BIGINT, 0) FROM payments WHERE status = 'completed') AS total_revenue_tsh,
            (SELECT COUNT(*) FROM payments WHERE status = 'pending') AS pending_payments,
            (SELECT active_subscriptions FROM subscription_metrics) AS active_subscriptions,
            (SELECT past_due_subscriptions FROM subscription_metrics) AS past_due_subscriptions,
            (SELECT monthly_recurring_revenue_tsh FROM subscription_metrics) AS monthly_recurring_revenue_tsh
        "#,
    )
    .fetch_one(state.db.pool())
    .await?;

    let summary = PlatformSummaryResponse {
        total_customers: row.try_get("total_customers").unwrap_or(0),
        active_customers: row.try_get("active_customers").unwrap_or(0),
        suspended_customers: row.try_get("suspended_customers").unwrap_or(0),
        total_users: row.try_get("total_users").unwrap_or(0),
        active_events: row.try_get("active_events").unwrap_or(0),
        total_revenue_tsh: row.try_get("total_revenue_tsh").unwrap_or(0),
        pending_payments: row.try_get("pending_payments").unwrap_or(0),
        active_subscriptions: row.try_get("active_subscriptions").unwrap_or(0),
        past_due_subscriptions: row.try_get("past_due_subscriptions").unwrap_or(0),
        monthly_recurring_revenue_tsh: row
            .try_get("monthly_recurring_revenue_tsh")
            .unwrap_or(0),
    };

    Ok(Json(json!({ "success": true, "data": summary })))
}

pub async fn list_plans(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let plans = sqlx::query_as::<_, PlatformPlanResponse>(
        r#"
        SELECT id, code, name, description, price_tsh, billing_interval, max_users, max_events, is_active
        FROM service_plans
        ORDER BY price_tsh ASC, name ASC
        "#,
    )
    .fetch_all(state.db.pool())
    .await?;

    Ok(Json(json!({ "success": true, "data": plans })))
}

pub async fn list_customers(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let customers = sqlx::query_as::<_, PlatformCustomerResponse>(
        r#"
        WITH org_users AS (
            SELECT
                organization_id,
                COALESCE(
                    MAX(full_name) FILTER (WHERE role = 'admin'),
                    MAX(full_name)
                ) AS display_name,
                COALESCE(
                    MAX(email) FILTER (WHERE role = 'admin'),
                    MAX(email)
                ) AS admin_email,
                BOOL_OR(is_active) AS has_active_users,
                COUNT(*) AS users_count,
                MAX(last_login) AS last_activity_at
            FROM users
            GROUP BY organization_id
        ),
        org_events AS (
            SELECT
                organization_id,
                COUNT(*) FILTER (WHERE deleted_at IS NULL) AS events_count,
                COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'active') AS active_events_count
            FROM events
            GROUP BY organization_id
        ),
        org_payments AS (
            SELECT
                organization_id,
                COUNT(*) AS total_payments_count,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed_payments_count,
                COALESCE((SUM(amount_tsh) FILTER (WHERE status = 'completed'))::BIGINT, 0) AS total_revenue_tsh,
                MAX(created_at) AS last_payment_at
            FROM payments
            GROUP BY organization_id
        ),
        org_subscription AS (
            SELECT
                os.organization_id,
                sp.name AS current_plan_name,
                os.status AS subscription_status,
                os.current_period_end AS subscription_period_end
            FROM organization_subscriptions os
            JOIN service_plans sp ON sp.id = os.plan_id
        )
        SELECT
            ou.organization_id,
            ou.display_name,
            ou.admin_email,
            CASE WHEN ou.has_active_users THEN 'active' ELSE 'suspended' END AS account_status,
            ou.users_count,
            COALESCE(oe.events_count, 0) AS events_count,
            COALESCE(oe.active_events_count, 0) AS active_events_count,
            COALESCE(op.total_payments_count, 0) AS total_payments_count,
            COALESCE(op.completed_payments_count, 0) AS completed_payments_count,
            COALESCE(op.total_revenue_tsh, 0) AS total_revenue_tsh,
            op.last_payment_at,
            ou.last_activity_at,
            os.current_plan_name,
            os.subscription_status,
            os.subscription_period_end
        FROM org_users ou
        LEFT JOIN org_events oe ON oe.organization_id = ou.organization_id
        LEFT JOIN org_payments op ON op.organization_id = ou.organization_id
        LEFT JOIN org_subscription os ON os.organization_id = ou.organization_id
        ORDER BY ou.last_activity_at DESC NULLS LAST, ou.display_name ASC
        "#,
    )
    .fetch_all(state.db.pool())
    .await?;

    Ok(Json(json!({ "success": true, "data": customers })))
}

pub async fn get_customer_detail(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(organization_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let customer = sqlx::query_as::<_, PlatformCustomerResponse>(
        r#"
        WITH org_users AS (
            SELECT
                organization_id,
                COALESCE(
                    MAX(full_name) FILTER (WHERE role = 'admin'),
                    MAX(full_name)
                ) AS display_name,
                COALESCE(
                    MAX(email) FILTER (WHERE role = 'admin'),
                    MAX(email)
                ) AS admin_email,
                BOOL_OR(is_active) AS has_active_users,
                COUNT(*) AS users_count,
                MAX(last_login) AS last_activity_at
            FROM users
            WHERE organization_id = $1
            GROUP BY organization_id
        ),
        org_events AS (
            SELECT
                organization_id,
                COUNT(*) FILTER (WHERE deleted_at IS NULL) AS events_count,
                COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'active') AS active_events_count
            FROM events
            WHERE organization_id = $1
            GROUP BY organization_id
        ),
        org_payments AS (
            SELECT
                organization_id,
                COUNT(*) AS total_payments_count,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed_payments_count,
                COALESCE((SUM(amount_tsh) FILTER (WHERE status = 'completed'))::BIGINT, 0) AS total_revenue_tsh,
                MAX(created_at) AS last_payment_at
            FROM payments
            WHERE organization_id = $1
            GROUP BY organization_id
        ),
        org_subscription AS (
            SELECT
                os.organization_id,
                sp.name AS current_plan_name,
                os.status AS subscription_status,
                os.current_period_end AS subscription_period_end
            FROM organization_subscriptions os
            JOIN service_plans sp ON sp.id = os.plan_id
            WHERE os.organization_id = $1
        )
        SELECT
            ou.organization_id,
            ou.display_name,
            ou.admin_email,
            CASE WHEN ou.has_active_users THEN 'active' ELSE 'suspended' END AS account_status,
            ou.users_count,
            COALESCE(oe.events_count, 0) AS events_count,
            COALESCE(oe.active_events_count, 0) AS active_events_count,
            COALESCE(op.total_payments_count, 0) AS total_payments_count,
            COALESCE(op.completed_payments_count, 0) AS completed_payments_count,
            COALESCE(op.total_revenue_tsh, 0) AS total_revenue_tsh,
            op.last_payment_at,
            ou.last_activity_at,
            os.current_plan_name,
            os.subscription_status,
            os.subscription_period_end
        FROM org_users ou
        LEFT JOIN org_events oe ON oe.organization_id = ou.organization_id
        LEFT JOIN org_payments op ON op.organization_id = ou.organization_id
        LEFT JOIN org_subscription os ON os.organization_id = ou.organization_id
        "#,
    )
    .bind(organization_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Customer account not found".to_string()))?;

    let users = sqlx::query_as::<_, PlatformCustomerUserResponse>(
        r#"
        SELECT id, email, full_name, role, is_active, created_at, last_login
        FROM users
        WHERE organization_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(organization_id)
    .fetch_all(state.db.pool())
    .await?;

    let recent_payments = sqlx::query_as::<_, PlatformCustomerPaymentResponse>(
        r#"
        SELECT id, package_name, amount_tsh, payment_method, payer_phone, status, created_at, completed_at
        FROM payments
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT 10
        "#,
    )
    .bind(organization_id)
    .fetch_all(state.db.pool())
    .await?;

    let current_subscription = fetch_subscription(&state, organization_id).await?;
    let recent_invoices = fetch_invoices(&state, organization_id).await?;

    Ok(Json(json!({
        "success": true,
        "data": PlatformCustomerDetailResponse {
            customer,
            users,
            recent_payments,
            current_subscription,
            recent_invoices,
        }
    })))
}

pub async fn update_customer_status(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(organization_id): Path<Uuid>,
    Json(payload): Json<UpdateCustomerStatusRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let result = sqlx::query(
        r#"
        UPDATE users
        SET is_active = $2,
            updated_at = NOW()
        WHERE organization_id = $1
        "#,
    )
    .bind(organization_id)
    .bind(payload.is_active)
    .execute(state.db.pool())
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Customer account not found".to_string()));
    }

    Ok(Json(json!({
        "success": true,
        "message": if payload.is_active {
            "Customer account activated"
        } else {
            "Customer account suspended"
        }
    })))
}

pub async fn update_customer_subscription(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(organization_id): Path<Uuid>,
    Json(payload): Json<UpdateCustomerSubscriptionRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let status = normalize_subscription_status(&payload.status)?;

    let plan = sqlx::query_as::<_, PlatformPlanResponse>(
        r#"
        SELECT id, code, name, description, price_tsh, billing_interval, max_users, max_events, is_active
        FROM service_plans
        WHERE id = $1 AND is_active = TRUE
        "#,
    )
    .bind(payload.plan_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Service plan not found".to_string()))?;

    let org_exists: Option<Uuid> = sqlx::query_scalar(
        "SELECT organization_id FROM users WHERE organization_id = $1 LIMIT 1",
    )
    .bind(organization_id)
    .fetch_optional(state.db.pool())
    .await?;

    if org_exists.is_none() {
        return Err(AppError::NotFound("Customer account not found".to_string()));
    }

    let now = Utc::now();
    let period_end = now + billing_duration(&plan.billing_interval);
    let trial_ends_at = if status == "trialing" {
        Some(now + Duration::days(14))
    } else {
        None
    };
    let cancelled_at = if status == "cancelled" { Some(now) } else { None };

    let mut tx = state.db.pool().begin().await?;

    sqlx::query(
        r#"
        INSERT INTO organization_subscriptions (
            id,
            organization_id,
            plan_id,
            status,
            current_period_start,
            current_period_end,
            trial_ends_at,
            cancel_at_period_end,
            cancelled_at,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8, $5, $5)
        ON CONFLICT (organization_id)
        DO UPDATE SET
            plan_id = EXCLUDED.plan_id,
            status = EXCLUDED.status,
            current_period_start = EXCLUDED.current_period_start,
            current_period_end = EXCLUDED.current_period_end,
            trial_ends_at = EXCLUDED.trial_ends_at,
            cancel_at_period_end = EXCLUDED.cancel_at_period_end,
            cancelled_at = EXCLUDED.cancelled_at,
            updated_at = EXCLUDED.updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(organization_id)
    .bind(plan.id)
    .bind(&status)
    .bind(now)
    .bind(period_end)
    .bind(trial_ends_at)
    .bind(cancelled_at)
    .execute(&mut *tx)
    .await?;

    if payload.create_invoice.unwrap_or(true) {
        let subscription_id: Uuid = sqlx::query_scalar(
            "SELECT id FROM organization_subscriptions WHERE organization_id = $1",
        )
        .bind(organization_id)
        .fetch_one(&mut *tx)
        .await?;

        let due_at = now + Duration::days(payload.due_in_days.unwrap_or(7));
        sqlx::query(
            r#"
            INSERT INTO billing_invoices (
                id,
                organization_id,
                subscription_id,
                plan_id,
                invoice_number,
                amount_tsh,
                status,
                issued_at,
                due_at,
                period_start,
                period_end,
                notes,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $7, $9, $10, $7, $7)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(organization_id)
        .bind(subscription_id)
        .bind(plan.id)
        .bind(generate_invoice_number())
        .bind(plan.price_tsh)
        .bind(now)
        .bind(due_at)
        .bind(period_end)
        .bind(Some(format!(
            "{} plan billing cycle created by platform admin",
            plan.name
        )))
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    let subscription = fetch_subscription(&state, organization_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Subscription not found after update".to_string()))?;

    Ok(Json(json!({
        "success": true,
        "message": "Customer subscription updated",
        "data": subscription,
    })))
}

pub async fn create_customer_invoice(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(organization_id): Path<Uuid>,
    Json(payload): Json<CreateInvoiceRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let subscription = fetch_subscription(&state, organization_id)
        .await?
        .ok_or_else(|| AppError::BadRequest("Customer does not have an active subscription yet".to_string()))?;

    let plan_id = payload.plan_id.unwrap_or(subscription.plan_id);
    let plan = sqlx::query_as::<_, PlatformPlanResponse>(
        r#"
        SELECT id, code, name, description, price_tsh, billing_interval, max_users, max_events, is_active
        FROM service_plans
        WHERE id = $1
        "#,
    )
    .bind(plan_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Service plan not found".to_string()))?;

    let now = Utc::now();
    let due_at = now + Duration::days(payload.due_in_days.unwrap_or(7));
    let period_end = now + billing_duration(&plan.billing_interval);

    sqlx::query(
        r#"
        INSERT INTO billing_invoices (
            id,
            organization_id,
            subscription_id,
            plan_id,
            invoice_number,
            amount_tsh,
            status,
            issued_at,
            due_at,
            period_start,
            period_end,
            notes,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $7, $9, $10, $7, $7)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(organization_id)
    .bind(subscription.id)
    .bind(plan.id)
    .bind(generate_invoice_number())
    .bind(plan.price_tsh)
    .bind(now)
    .bind(due_at)
    .bind(period_end)
    .bind(payload.notes.unwrap_or_else(|| format!("{} renewal invoice", plan.name)))
    .execute(state.db.pool())
    .await?;

    let invoices = fetch_invoices(&state, organization_id).await?;
    let invoice = invoices
        .into_iter()
        .next()
        .ok_or(AppError::InternalServerError)?;

    Ok(Json(json!({
        "success": true,
        "message": "Invoice created",
        "data": invoice,
    })))
}

pub async fn mark_invoice_paid(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(invoice_id): Path<Uuid>,
    Json(payload): Json<MarkInvoicePaidRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    let row = sqlx::query(
        r#"
        SELECT
            bi.id,
            bi.organization_id,
            bi.subscription_id,
            bi.plan_id,
            bi.invoice_number,
            bi.amount_tsh,
            bi.status,
            sp.name AS plan_name
        FROM billing_invoices bi
        LEFT JOIN service_plans sp ON sp.id = bi.plan_id
        WHERE bi.id = $1
        "#,
    )
    .bind(invoice_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Invoice not found".to_string()))?;

    let invoice_status: String = row.try_get("status")?;
    if invoice_status == "paid" {
        return Err(AppError::Conflict("Invoice is already marked as paid".to_string()));
    }

    let organization_id: Uuid = row.try_get("organization_id")?;
    let subscription_id: Option<Uuid> = row.try_get("subscription_id")?;
    let plan_name: Option<String> = row.try_get("plan_name")?;
    let amount_tsh: i64 = row.try_get("amount_tsh")?;
    let now = Utc::now();
    let payment_method = normalize_payment_method(payload.payment_method.as_deref());

    let mut tx = state.db.pool().begin().await?;

    sqlx::query(
        r#"
        UPDATE billing_invoices
        SET status = 'paid',
            paid_at = $2,
            updated_at = $2
        WHERE id = $1
        "#,
    )
    .bind(invoice_id)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO payments (
            id,
            organization_id,
            event_id,
            payment_type,
            package_name,
            amount_tsh,
            payment_method,
            payer_phone,
            status,
            payment_gateway,
            notes,
            completed_at,
            created_at,
            updated_at,
            subscription_id,
            invoice_id
        )
        VALUES (
            $1,
            $2,
            NULL,
            'subscription',
            $3,
            $4,
            $5,
            $6,
            'completed',
            'manual',
            $7,
            $8,
            $8,
            $8,
            $9,
            $10
        )
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(organization_id)
    .bind(plan_name.unwrap_or_else(|| "RoyalEntry subscription".to_string()))
    .bind(amount_tsh)
    .bind(payment_method)
    .bind(payload.payer_phone)
    .bind(payload.notes.unwrap_or_else(|| "Invoice marked paid by platform admin".to_string()))
    .bind(now)
    .bind(subscription_id)
    .bind(invoice_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(json!({
        "success": true,
        "message": "Invoice marked as paid and payment recorded",
    })))
}
