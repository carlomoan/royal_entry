use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub fn build_scan_url(frontend_url: &str, event_id: Uuid, scan_code: &str) -> String {
    format!(
        "{}/events/{}/scanner?code={}",
        frontend_url.trim_end_matches('/'),
        event_id,
        scan_code,
    )
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Invitation {
    pub id: Uuid,
    pub guest_id: Uuid,
    pub short_link: String,
    pub status: String,
    pub scan_count: i32,
    pub invitation_sent_at: Option<DateTime<Utc>>,
    pub last_scanned_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InvitationResponse {
    pub id: Uuid,
    pub guest_id: Uuid,
    pub short_link: String,
    pub scan_url: String,
    pub status: String,
    pub scan_count: i32,
    pub invitation_sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl InvitationResponse {
    pub fn from_invitation(invitation: Invitation, frontend_url: &str, event_id: Uuid) -> Self {
        let scan_url = build_scan_url(frontend_url, event_id, &invitation.short_link);

        Self {
            id: invitation.id,
            guest_id: invitation.guest_id,
            short_link: invitation.short_link,
            scan_url,
            status: invitation.status,
            scan_count: invitation.scan_count,
            invitation_sent_at: invitation.invitation_sent_at,
            created_at: invitation.created_at,
        }
    }
}

#[derive(Debug, Deserialize, Default)]
pub struct GenerateInvitationsRequest {
    pub overwrite: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct GenerateInvitationsResult {
    pub generated: i64,
    pub skipped: i64,
    pub failed: i64,
    pub invitations: Vec<InvitationResponse>,
}
