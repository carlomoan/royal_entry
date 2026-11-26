// ==============================================================================
// FILE: src/models/guest.rs
// ==============================================================================
// Guest model and related DTOs

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

/// Guest database model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Guest {
    pub id: Uuid,
    pub event_id: Uuid,
    pub full_name: String,
    pub phone: String,
    pub email: Option<String>,
    pub whatsapp_phone: Option<String>,
    pub device_type: String, // smartphone | feature_phone
    pub table_number: Option<String>,
    pub guest_category: Option<String>, // VVIP, VIP, Normal, Premium, Staff, Family, Friend, Service Provider, Special Guest, Regular
    pub plus_one_allowed: bool,
    pub contact_method: String, // whatsapp, sms, email, telegram
    pub notes: Option<String>,
    pub telegram_chat_id: Option<String>, // set when the guest links their Telegram via /start
    pub email_verified: bool,
    pub email_verification_token: Option<String>,
    pub party_size: i32,
    pub seat_number: Option<String>,
    pub card_issued_at: Option<DateTime<Utc>>,
    pub pass_state: String,
    pub revoked_at: Option<DateTime<Utc>>,
    pub named_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Guest response (public view)
#[derive(Debug, Serialize)]
pub struct GuestResponse {
    pub id: Uuid,
    pub full_name: String,
    pub phone: String,
    pub email: Option<String>,
    pub whatsapp_phone: Option<String>,
    pub device_type: String,
    pub table_number: Option<String>,
    pub guest_category: Option<String>,
    pub plus_one_allowed: bool,
    pub contact_method: String,
    pub telegram_chat_id: Option<String>,
    pub email_verified: bool,
    pub party_size: i32,
    pub seat_number: Option<String>,
    pub card_issued_at: Option<DateTime<Utc>>,
    pub pass_state: String,
    pub created_at: DateTime<Utc>,
}

impl From<Guest> for GuestResponse {
    fn from(guest: Guest) -> Self {
        Self {
            id: guest.id,
            full_name: guest.full_name,
            phone: guest.phone,
            email: guest.email,
            whatsapp_phone: guest.whatsapp_phone,
            device_type: guest.device_type,
            table_number: guest.table_number,
            guest_category: guest.guest_category,
            plus_one_allowed: guest.plus_one_allowed,
            contact_method: guest.contact_method,
            telegram_chat_id: guest.telegram_chat_id,
            email_verified: guest.email_verified,
            party_size: guest.party_size,
            seat_number: guest.seat_number,
            card_issued_at: guest.card_issued_at,
            pass_state: guest.pass_state,
            created_at: guest.created_at,
        }
    }
}

/// Normalise a phone number to international format without `+`.
/// Accepts `785023234`, `0785023234`, `+255785023234`, `255785023234`,
/// and numbers with spaces/dashes. Already-international non-TZ numbers are
/// left alone.
pub fn normalize_phone(input: &str) -> String {
    let cleaned: String = input
        .trim()
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '+')
        .collect();
    let digits: String = cleaned.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.is_empty() {
        return String::new();
    }
    if cleaned.starts_with('+') {
        // Accept +255… and the occasional +07… pasted from a spreadsheet.
        if digits.starts_with('0') && digits.len() >= 9 {
            return format!("255{}", digits.trim_start_matches('0'));
        }
        return digits;
    }
    if digits.starts_with("255") && digits.len() >= 12 {
        return digits;
    }
    // 07xx / 06xx local form with the leading zero intact.
    if digits.starts_with('0') && digits.len() >= 9 {
        return format!("255{}", digits.trim_start_matches('0'));
    }
    // Excel/CSV often strips the leading zero: 0785… becomes 785… (9 digits)
    // and 0650… becomes 650… (8 digits). Both are Tanzanian mobile prefixes.
    if (digits.len() == 8 || digits.len() == 9)
        && (digits.starts_with('7') || digits.starts_with('6'))
    {
        return format!("255{digits}");
    }
    digits
}

/// Create guest request
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CreateGuestRequest {
    #[validate(length(min = 2, max = 255))]
    pub full_name: String,

    #[validate(length(min = 10, max = 15, message = "Invalid phone number length"))]
    pub phone: String,

    pub email: Option<String>,

    pub whatsapp_phone: Option<String>,

    pub device_type: Option<String>, // smartphone | feature_phone (default smartphone)

    pub table_number: Option<String>,

    pub guest_category: Option<String>,

    pub plus_one_allowed: Option<bool>,

    pub contact_method: Option<String>, // Default: whatsapp
}

/// Create multiple guests request (bulk upload)
#[derive(Debug, Deserialize)]
pub struct CreateMultipleGuestsRequest {
    pub guests: Vec<CreateGuestRequest>,
}

/// Update guest request
#[derive(Debug, Deserialize)]
pub struct UpdateGuestRequest {
    pub full_name: Option<String>,

    pub phone: Option<String>,

    pub email: Option<String>,

    pub whatsapp_phone: Option<String>,

    pub device_type: Option<String>,

    pub table_number: Option<String>,

    pub guest_category: Option<String>,

    pub plus_one_allowed: Option<bool>,

    pub contact_method: Option<String>,

    pub notes: Option<String>,
}

/// Guest with RSVP status
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct GuestWithRsvp {
    pub id: Uuid,
    pub full_name: String,
    pub phone: String,
    pub device_type: String,
    pub guest_category: Option<String>,
    pub table_number: Option<String>,
    pub contact_method: String,
    #[sqlx(default)]
    pub rsvp_response: Option<String>,
    #[sqlx(default)]
    pub rsvp_responded_at: Option<DateTime<Utc>>,
}

/// Pagination query parameters
#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

impl Default for PaginationQuery {
    fn default() -> Self {
        Self {
            page: Some(1),
            per_page: Some(20),
        }
    }
}

impl PaginationQuery {
    pub fn offset(&self) -> i64 {
        let page = self.page.unwrap_or(1);
        (page - 1) * self.per_page.unwrap_or(20)
    }

    pub fn limit(&self) -> i64 {
        self.per_page.unwrap_or(20)
    }
}

/// Paginated response
#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub pagination: PaginationMeta,
}

#[derive(Debug, Serialize)]
pub struct PaginationMeta {
    pub page: i64,
    pub per_page: i64,
    pub total: i64,
    pub total_pages: i64,
}

impl PaginationMeta {
    pub fn new(page: i64, per_page: i64, total: i64) -> Self {
        Self {
            page,
            per_page,
            total,
            total_pages: (total + per_page - 1) / per_page,
        }
    }
}
