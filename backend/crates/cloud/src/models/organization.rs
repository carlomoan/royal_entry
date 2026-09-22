// ==============================================================================
// FILE: src/models/organization.rs
// ==============================================================================
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Organization {
    pub id: Uuid,
    pub display_name: String,
    pub account_slug: Option<String>,
    pub billing_email: Option<String>,
    pub contact_phone: Option<String>,
    pub account_status: String, // pending_review | active | suspended
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateOrganizationRequest {
    #[validate(length(min = 2, max = 255))]
    pub display_name: String,
    pub account_slug: Option<String>,
    pub billing_email: Option<String>,
    pub contact_phone: Option<String>,
    pub admin: CreateAdminUserRequest,
    pub plan_id: Option<Uuid>,
    #[serde(default)]
    pub auto_approve: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateAdminUserRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 8, max = 128))]
    pub password: String,
    #[validate(length(min = 2, max = 255))]
    pub full_name: String,
    pub phone: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateOrganizationResponse {
    pub organization_id: Uuid,
    pub admin_user_id: Uuid,
    pub status: String,
}
