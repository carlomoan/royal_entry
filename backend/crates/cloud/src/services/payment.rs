// ==============================================================================
// FILE: src/models/payment.rs
// ==============================================================================
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Payment {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub event_id: Option<Uuid>,
    pub payment_type: String,
    pub package_name: Option<String>,
    pub amount_tsh: i64,
    pub payment_method: String,
    pub payment_reference: Option<String>,
    pub transaction_id: Option<String>,
    pub checkout_request_id: Option<String>,
    pub mpesa_receipt_number: Option<String>,
    pub payer_phone: Option<String>,
    pub status: String,
    pub payment_gateway: String,
    pub gateway_response: Option<String>,
    pub completed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct PaymentResponse {
    pub id: Uuid,
    pub payment_type: String,
    pub package_name: Option<String>,
    pub amount_tsh: i64,
    pub payment_method: String,
    pub mpesa_receipt_number: Option<String>,
    pub payer_phone: Option<String>,
    pub status: String,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl From<Payment> for PaymentResponse {
    fn from(p: Payment) -> Self {
        Self {
            id: p.id,
            payment_type: p.payment_type,
            package_name: p.package_name,
            amount_tsh: p.amount_tsh,
            payment_method: p.payment_method,
            mpesa_receipt_number: p.mpesa_receipt_number,
            payer_phone: p.payer_phone,
            status: p.status,
            completed_at: p.completed_at,
            created_at: p.created_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct InitiatePaymentRequest {
    pub event_id: Option<Uuid>,
    pub package_name: String,
    pub amount_tsh: i64,
    #[validate(length(min = 10, max = 15))]
    pub phone: String,
}

#[derive(Debug, Serialize)]
pub struct InitiatePaymentResponse {
    pub payment_id: Uuid,
    pub checkout_request_id: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct QueryPaymentRequest {
    pub payment_id: Uuid,
}
