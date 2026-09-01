// ==============================================================================
// FILE: src/repository/event_repository.rs
// ==============================================================================
// Database operations for events

use sqlx::PgPool;
use uuid::Uuid;
use chrono::{Utc, NaiveDate};
use crate::models::event::{Event, CreateEventRequest, UpdateEventRequest};
use crate::error::AppResult;

pub struct EventRepository;

impl EventRepository {
    /// Create a new event
    pub async fn create(
        pool: &PgPool,
        org_id: Uuid,
        user_id: Uuid,
        req: &CreateEventRequest,
    ) -> AppResult<Event> {
        let event_id = Uuid::new_v4();
        let now = Utc::now();

        // Parse dates
        let event_date = NaiveDate::parse_from_str(&req.event_date, "%Y-%m-%d")
            .map_err(|_| crate::error::AppError::BadRequest("Invalid event_date format, use YYYY-MM-DD".to_string()))?;

        let rsvp_deadline = req.rsvp_deadline
            .as_ref()
            .map(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d"))
            .transpose()
            .map_err(|_| crate::error::AppError::BadRequest("Invalid rsvp_deadline format".to_string()))?;

        let event = sqlx::query_as::<_, Event>(
            r#"
            INSERT INTO events (
                id, organization_id, created_by_user_id, title, description,
                event_date, event_time, venue_name, venue_address,
                dress_code, card_theme, main_characters, guest_count_expected, rsvp_deadline,
                status, approval_status, send_save_the_date, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *
            "#
        )
        .bind(&event_id)
        .bind(&org_id)
        .bind(&user_id)
        .bind(&req.title)
        .bind(&req.description)
        .bind(&event_date)
        .bind(&req.event_time)
        .bind(&req.venue_name)
        .bind(&req.venue_address)
        .bind(&req.dress_code)
        .bind(&req.card_theme)
        .bind(&req.main_characters)
        .bind(&req.guest_count_expected)
        .bind(&rsvp_deadline)
        .bind("draft") // Initial status
        .bind("pending") // Initial approval status
        .bind(req.send_save_the_date.unwrap_or(true)) // send_save_the_date default
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await?;

        tracing::info!(
            event_id = %event_id,
            org_id = %org_id,
            title = %req.title,
            "Event created"
        );

        Ok(event)
    }

    /// Get event by ID
    pub async fn get_by_id(pool: &PgPool, event_id: Uuid) -> AppResult<Option<Event>> {
        let event = sqlx::query_as::<_, Event>(
            "SELECT * FROM events WHERE id = $1 AND deleted_at IS NULL"
        )
        .bind(event_id)
        .fetch_optional(pool)
        .await?;

        Ok(event)
    }

    /// Get all events for an organization
    pub async fn list_by_organization(
        pool: &PgPool,
        org_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> AppResult<(Vec<Event>, i64)> {
        let events = sqlx::query_as::<_, Event>(
            r#"
            SELECT * FROM events
            WHERE organization_id = $1 AND deleted_at IS NULL
            ORDER BY event_date DESC
            LIMIT $2 OFFSET $3
            "#
        )
        .bind(org_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM events WHERE organization_id = $1 AND deleted_at IS NULL"
        )
        .bind(org_id)
        .fetch_one(pool)
        .await?;

        Ok((events, total))
    }

    /// Update event
    pub async fn update(
        pool: &PgPool,
        event_id: Uuid,
        req: &UpdateEventRequest,
    ) -> AppResult<Event> {
        // Get current event
        let current = Self::get_by_id(pool, event_id)
            .await?
            .ok_or_else(|| crate::error::AppError::EventNotFound)?;

        let now = Utc::now();

        // Parse dates if provided
        let event_date = req.event_date
            .as_ref()
            .map(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d"))
            .transpose()
            .map_err(|_| crate::error::AppError::BadRequest("Invalid event_date format".to_string()))?
            .unwrap_or(current.event_date);

        let rsvp_deadline = req.rsvp_deadline
            .as_ref()
            .map(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d"))
            .transpose()
            .map_err(|_| crate::error::AppError::BadRequest("Invalid rsvp_deadline format".to_string()))?
            .or(current.rsvp_deadline);

        let event = sqlx::query_as::<_, Event>(
            r#"
            UPDATE events
            SET
                title = COALESCE($2, title),
                description = COALESCE($3, description),
                event_date = $4,
                event_time = COALESCE($5, event_time),
                venue_name = COALESCE($6, venue_name),
                venue_address = COALESCE($7, venue_address),
                dress_code = COALESCE($8, dress_code),
                card_theme = COALESCE($9, card_theme),
                main_characters = COALESCE($10, main_characters),
                guest_count_expected = COALESCE($11, guest_count_expected),
                rsvp_deadline = $12,
                send_save_the_date = COALESCE($13, send_save_the_date),
                updated_at = $14
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(event_id)
        .bind(&req.title)
        .bind(&req.description)
        .bind(&event_date)
        .bind(&req.event_time)
        .bind(&req.venue_name)
        .bind(&req.venue_address)
        .bind(&req.dress_code)
        .bind(&req.card_theme)
        .bind(&req.main_characters)
        .bind(&req.guest_count_expected)
        .bind(&rsvp_deadline)
        .bind(&req.send_save_the_date)
        .bind(now)
        .fetch_one(pool)
        .await?;

        tracing::info!(event_id = %event_id, "Event updated");

        Ok(event)
    }

    /// Activate event (change status to active)
    pub async fn activate(
        pool: &PgPool,
        event_id: Uuid,
        entry_start_time: String,
        entry_end_time: String,
    ) -> AppResult<Event> {
        let now = Utc::now();

        let event = sqlx::query_as::<_, Event>(
            r#"
            UPDATE events
            SET
                status = 'active',
                entry_start_time = $2,
                entry_end_time = $3,
                updated_at = $4
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(event_id)
        .bind(&entry_start_time)
        .bind(&entry_end_time)
        .bind(now)
        .fetch_one(pool)
        .await?;

        tracing::info!(event_id = %event_id, "Event activated");

        Ok(event)
    }

    /// Soft delete event
    pub async fn delete(pool: &PgPool, event_id: Uuid) -> AppResult<()> {
        let now = Utc::now();

        sqlx::query(
            "UPDATE events SET deleted_at = $1 WHERE id = $2"
        )
        .bind(now)
        .bind(event_id)
        .execute(pool)
        .await?;

        tracing::info!(event_id = %event_id, "Event deleted (soft)");

        Ok(())
    }

    /// Check if user owns event
    pub async fn is_owner(
        pool: &PgPool,
        event_id: Uuid,
        user_id: Uuid,
    ) -> AppResult<bool> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM events WHERE id = $1 AND created_by_user_id = $2"
        )
        .bind(event_id)
        .bind(user_id)
        .fetch_one(pool)
        .await?;

        Ok(count > 0)
    }
}
