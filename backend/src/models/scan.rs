use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct ScanTimelinePoint {
    pub hour: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanStatsResponse {
    pub total_guests: i64,
    pub arrived: i64,
    pub pending: i64,
    pub arrival_rate_percent: i64,
    pub timeline: Vec<ScanTimelinePoint>,
}

#[derive(Debug, Deserialize)]
pub struct CheckInRequest {
    pub short_link: String,
    pub scan_source: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CheckInResponse {
    pub guest_id: Uuid,
    pub guest_name: String,
    pub guest_phone: String,
    pub invitation_id: Uuid,
    pub scanned_at: DateTime<Utc>,
    pub status: String,
}
