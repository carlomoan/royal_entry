// ==============================================================================
// FILE: src/models/corporate.rs
// ==============================================================================
// Corporate/concert event mode: fixed packages sold to companies, bookings with
// payment proof, and passes (guests) created when a booking is confirmed.
// ==============================================================================
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EventPackage {
    pub id: Uuid,
    pub event_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub price_tsh: i64,
    pub seats_per_table: i32,
    pub card_template_id: Option<Uuid>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Booking {
    pub id: Uuid,
    pub event_id: Uuid,
    pub company_name: String,
    pub contact_person: String,
    pub contact_phone: String,
    pub contact_email: Option<String>,
    pub payment_reference: Option<String>,
    pub proof_file_id: Option<String>,
    pub amount_paid: i64,
    pub confirmed_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub workflow_status: String,
    pub registration_token: Option<String>,
    pub contact_email_verified_at: Option<DateTime<Utc>>,
    pub contact_verification_token: Option<String>,
    pub contact_email_is_free: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BookingPackage {
    pub booking_id: Uuid,
    pub package_id: Uuid,
    pub quantity: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BookingTable {
    pub id: Uuid,
    pub booking_id: Uuid,
    pub package_id: Option<Uuid>,
    pub table_number: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OpenTable {
    pub id: Uuid,
    pub event_id: Uuid,
    pub table_number: String,
    pub capacity: i32,
    pub label: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BookingPackageView {
    pub package_id: Uuid,
    pub name: String,
    pub quantity: i32,
    pub price_tsh: i64,
    pub seats_per_table: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookingView {
    #[serde(flatten)]
    pub booking: Booking,
    pub total_amount: i64,
    pub balance: i64,
    pub passes_created: i32,
    pub packages: Vec<BookingPackageView>,
    pub tables: Vec<BookingTable>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePackageRequest {
    pub name: String,
    pub description: Option<String>,
    pub price_tsh: i64,
    pub seats_per_table: i32,
    pub card_template_id: Option<Uuid>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePackageRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub price_tsh: Option<i64>,
    pub seats_per_table: Option<i32>,
    pub card_template_id: Option<Uuid>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct PackageQuantity {
    pub package_id: Uuid,
    pub quantity: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateBookingRequest {
    pub company_name: String,
    pub contact_person: String,
    pub contact_phone: String,
    pub contact_email: Option<String>,
    pub packages: Vec<PackageQuantity>,
    pub notes: Option<String>,
    pub payment_reference: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBookingRequest {
    pub company_name: Option<String>,
    pub contact_person: Option<String>,
    pub contact_phone: Option<String>,
    pub contact_email: Option<String>,
    pub notes: Option<String>,
    pub packages: Option<Vec<PackageQuantity>>,
}

#[derive(Debug, Deserialize)]
pub struct ConfirmBookingRequest {
    pub payment_reference: Option<String>,
    pub amount_paid: Option<i64>,
    pub proof_file_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTableRequest {
    pub table_number: String,
    pub package_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOpenTableRequest {
    pub table_number: String,
    pub capacity: i32,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BookingInvoice {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub event_id: Uuid,
    pub booking_id: Uuid,
    pub invoice_number: String,
    pub amount_tsh: i64,
    pub tax_rate_percent: f64,
    pub tax_amount_tsh: i64,
    pub tax_inclusive: bool,
    pub tin: Option<String>,
    pub status: String,
    pub issued_at: DateTime<Utc>,
    pub due_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub public_token: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ParkingVariant {
    pub id: Uuid,
    pub event_id: Uuid,
    pub class_name: String,
    pub instructions: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateParkingVariantRequest {
    pub class_name: String,
    pub instructions: String,
}

#[derive(Debug, Serialize)]
pub struct SeatingSuggestion {
    pub table_number: String,
    pub reason: String,
    pub seated: i32,
    pub capacity: i32,
}
