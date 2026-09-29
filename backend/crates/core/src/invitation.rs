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

pub fn build_public_invitation_url(frontend_url: &str, scan_code: &str) -> String {
    format!("{}/g/{}", frontend_url.trim_end_matches('/'), scan_code,)
}

/// Generate a human-friendly check-in code that's easy to type and remember
/// Format: WORD1-WORD2-NUMBER (e.g., "ROYAL-GUEST-1234")
pub fn generate_human_friendly_code(uuid: &Uuid) -> String {
    let bytes = uuid.as_bytes();

    // Convert bytes to readable components
    let word1 = bytes_to_word(&bytes[0..4]);
    let word2 = bytes_to_word(&bytes[4..8]);
    let number = ((bytes[8] as u16) << 8 | bytes[9] as u16) % 9000 + 1000; // 4-digit number 1000-9999

    format!("{}-{}-{}", word1, word2, number)
}

/// Convert 4 bytes to a readable word using simple encoding
fn bytes_to_word(bytes: &[u8]) -> String {
    const CONSONANTS: &[char] = &[
        'B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W',
        'X', 'Y', 'Z',
    ];
    const VOWELS: &[char] = &['A', 'E', 'I', 'O', 'U'];

    let mut word = String::new();
    for (i, &byte) in bytes.iter().enumerate() {
        if i % 2 == 0 {
            // Consonant
            let idx = (byte as usize) % CONSONANTS.len();
            word.push(CONSONANTS[idx]);
        } else {
            // Vowel
            let idx = (byte as usize) % VOWELS.len();
            word.push(VOWELS[idx]);
        }
    }

    word
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
    pub public_url: String,
    pub scan_url: String,
    pub scan_payload: String,
    pub status: String,
    pub scan_count: i32,
    pub invitation_sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl InvitationResponse {
    pub fn from_invitation(invitation: Invitation, frontend_url: &str, event_id: Uuid) -> Self {
        let scan_url = build_scan_url(frontend_url, event_id, &invitation.short_link);
        let public_url = build_public_invitation_url(frontend_url, &invitation.short_link);

        Self {
            id: invitation.id,
            guest_id: invitation.guest_id,
            short_link: invitation.short_link.clone(),
            public_url,
            scan_url,
            scan_payload: invitation.short_link,
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
    pub guest_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Serialize)]
pub struct GenerateInvitationsResult {
    pub generated: i64,
    pub skipped: i64,
    pub failed: i64,
    pub invitations: Vec<InvitationResponse>,
}
