use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Pledge {
    pub id: Uuid,
    pub event_id: Uuid,
    pub guest_id: Uuid,
    pub pledged_amount: i64,
    pub amount_paid: i64,
    pub payment_status: String, // pending | partial | paid | overdue
    pub payment_deadline: Option<DateTime<Utc>>,
    pub reminder_count: i32,
    pub last_reminder_sent_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PledgeWithGuest {
    pub id: Uuid,
    pub guest_id: Uuid,
    #[sqlx(default)]
    pub guest_name: String,
    #[sqlx(default)]
    pub guest_phone: String,
    pub pledged_amount: i64,
    pub amount_paid: i64,
    pub payment_status: String,
    pub payment_deadline: Option<DateTime<Utc>>,
    pub reminder_count: i32,
    pub last_reminder_sent_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl PledgeWithGuest {
    pub fn remaining_amount(&self) -> i64 {
        (self.pledged_amount - self.amount_paid).max(0)
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreatePledgeRequest {
    pub guest_id: Uuid,
    #[validate(range(min = 1))]
    pub pledged_amount: i64,
    pub payment_deadline: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RecordPaymentRequest {
    #[validate(range(min = 1))]
    pub amount_paid: i64,
    pub payment_method: String, // cash | mpesa | bank | other
    pub payment_reference: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MichangoSummary {
    pub total_pledgers: i64,
    pub total_pledged_tsh: i64,
    pub total_collected_tsh: i64,
    pub total_outstanding_tsh: i64,
    pub collection_rate_percent: i64,
    pub pending_count: i64,
    pub partial_count: i64,
    pub paid_count: i64,
    pub overdue_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct SendRemindersRequest {
    pub target_statuses: Vec<String>, // ["pending", "partial", "overdue"]
}

#[derive(Debug, Serialize)]
pub struct SendRemindersResponse {
    pub sent: i64,
    pub failed: i64,
}
