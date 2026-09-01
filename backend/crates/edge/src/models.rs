use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// A single offline-queued operation that will be replayed against the cloud.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedOperation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub op_type: String,        // "scan" | "pledge_payment" | "checkin"
    pub payload: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub retries: i32,
    pub last_error: Option<String>,
}

impl QueuedOperation {
    pub fn new(tenant_id: Uuid, op_type: impl Into<String>, payload: serde_json::Value) -> Self {
        Self {
            id: Uuid::new_v4(),
            tenant_id,
            op_type: op_type.into(),
            payload,
            created_at: Utc::now(),
            retries: 0,
            last_error: None,
        }
    }
}

/// A locally-cached entry scan — kept on the device for instant retrieval,
/// flushed to the master cloud DB when connectivity returns.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalScan {
    pub short_link: String,
    pub event_id: Uuid,
    pub guest_id: Uuid,
    pub invitation_id: Uuid,
    pub scanned_at: DateTime<Utc>,
    pub scanned_by_user_id: Uuid,
    pub scan_source: String,
    pub notes: Option<String>,
}
