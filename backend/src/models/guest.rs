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
    pub table_number: Option<String>,
    pub guest_category: Option<String>, // VIP, Regular, Staff, Family, Friend
    pub plus_one_allowed: bool,
    pub contact_method: String, // whatsapp, sms, email, telegram
    pub notes: Option<String>,
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
    pub table_number: Option<String>,
    pub guest_category: Option<String>,
    pub plus_one_allowed: bool,
    pub contact_method: String,
    pub created_at: DateTime<Utc>,
}

impl From<Guest> for GuestResponse {
    fn from(guest: Guest) -> Self {
        Self {
            id: guest.id,
            full_name: guest.full_name,
            phone: guest.phone,
            email: guest.email,
            table_number: guest.table_number,
            guest_category: guest.guest_category,
            plus_one_allowed: guest.plus_one_allowed,
            contact_method: guest.contact_method,
            created_at: guest.created_at,
        }
    }
}

/// Create guest request
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CreateGuestRequest {
    #[validate(length(min = 2, max = 255))]
    pub full_name: String,

    #[validate(length(min = 10, max = 15, message = "Invalid phone number length"))]
    pub phone: String,

    pub email: Option<String>,

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
