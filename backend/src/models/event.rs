// src/models/event.rs
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Event {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub created_by_user_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub event_date: NaiveDate,
    pub event_time: Option<String>,
    pub venue_name: Option<String>,
    pub venue_address: Option<String>,
    pub venue_latitude: Option<f64>,
    pub venue_longitude: Option<f64>,
    pub dress_code: Option<String>,
    pub event_logo_url: Option<String>,
    pub main_characters: Option<String>,
    pub card_template_id: Option<Uuid>,
    pub card_theme: Option<String>,
    pub entry_start_time: Option<String>,
    pub entry_end_time: Option<String>,
    pub rsvp_deadline: Option<NaiveDate>,
    pub guest_count_expected: Option<i32>,
    pub status: String,
    pub approval_status: String,
    pub approved_by_user_id: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub send_save_the_date: bool,
    pub save_the_date_sent_at: Option<DateTime<Utc>>,
    pub invitation_sent_at: Option<DateTime<Utc>>,
    pub thank_you_message_template: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct EventResponse {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub event_date: NaiveDate,
    pub event_time: Option<String>,
    pub venue_name: Option<String>,
    pub venue_address: Option<String>,
    pub dress_code: Option<String>,
    pub main_characters: Option<String>,
    pub status: String,
    pub guest_count_expected: Option<i32>,
    pub rsvp_deadline: Option<NaiveDate>,
    pub card_theme: Option<String>,
    pub send_save_the_date: bool,
    pub save_the_date_sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Event> for EventResponse {
    fn from(event: Event) -> Self {
        Self {
            id: event.id,
            title: event.title,
            description: event.description,
            event_date: event.event_date,
            event_time: event.event_time,
            venue_name: event.venue_name,
            venue_address: event.venue_address,
            dress_code: event.dress_code,
            main_characters: event.main_characters,
            status: event.status,
            guest_count_expected: event.guest_count_expected,
            rsvp_deadline: event.rsvp_deadline,
            card_theme: event.card_theme,
            send_save_the_date: event.send_save_the_date,
            save_the_date_sent_at: event.save_the_date_sent_at,
            created_at: event.created_at,
            updated_at: event.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateEventRequest {
    #[validate(length(min = 3, max = 255))]
    pub title: String,
    pub description: Option<String>,
    pub event_date: String,
    pub event_time: Option<String>,
    pub venue_name: Option<String>,
    pub venue_address: Option<String>,
    pub dress_code: Option<String>,
    pub card_theme: Option<String>,
    pub main_characters: Option<String>,
    pub guest_count_expected: Option<i32>,
    pub rsvp_deadline: Option<String>,
    pub send_save_the_date: Option<bool>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateEventRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub event_date: Option<String>,
    pub event_time: Option<String>,
    pub venue_name: Option<String>,
    pub venue_address: Option<String>,
    pub dress_code: Option<String>,
    pub card_theme: Option<String>,
    pub main_characters: Option<String>,
    pub guest_count_expected: Option<i32>,
    pub rsvp_deadline: Option<String>,
    pub send_save_the_date: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ActivateEventRequest {
    pub entry_start_time: String,
    pub entry_end_time: String,
    pub send_save_the_date: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RejectEventRequest {
    pub reason: Option<String>,
}
