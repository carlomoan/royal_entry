// ==============================================================================
// FILE: src/models/billing.rs
// ==============================================================================
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OrganizationSubscription {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub plan_id: Uuid,
    pub status: String, // trialing, active, past_due, cancelled, expired
    pub current_period_start: DateTime<Utc>,
    pub current_period_end: DateTime<Utc>,
    pub trial_ends_at: Option<DateTime<Utc>>,
    pub cancel_at_period_end: bool,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BillingInvoice {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub subscription_id: Option<Uuid>,
    pub plan_id: Option<Uuid>,
    pub invoice_number: String,
    pub amount_tsh: i64,
    pub status: String, // open, paid, void, overdue
    pub issued_at: DateTime<Utc>,
    pub due_at: Option<DateTime<Utc>>,
    pub paid_at: Option<DateTime<Utc>>,
    pub voided_at: Option<DateTime<Utc>>,
    pub period_start: Option<DateTime<Utc>>,
    pub period_end: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Payment {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub event_id: Option<Uuid>,
    pub payment_type: String,
    pub package_name: Option<String>,
    pub amount_tsh: i64,
    pub payment_method: String,
    pub payer_phone: Option<String>,
    pub status: String,
    pub payment_gateway: Option<String>,
    pub notes: Option<String>,
    pub completed_at: Option<chrono::DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub subscription_id: Option<Uuid>,
    pub invoice_id: Option<Uuid>,
    pub provider_checkout_request_id: Option<String>,
}
