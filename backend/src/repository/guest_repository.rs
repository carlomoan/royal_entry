// ==============================================================================
// FILE: src/repository/guest_repository.rs
// ==============================================================================
// Database operations for guests

pub struct GuestRepository;

use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;
use crate::error::AppResult;
use crate::models::guest::{CreateGuestRequest, Guest, GuestWithRsvp, UpdateGuestRequest};


impl GuestRepository {
    /// Create a guest
    pub async fn create(
        pool: &PgPool,
        event_id: Uuid,
        req: &CreateGuestRequest,
    ) -> AppResult<Guest> {
        let guest_id = Uuid::new_v4();
        let now = Utc::now();
        let contact_method = req.contact_method.clone().unwrap_or_else(|| "whatsapp".to_string());
        let device_type = req.device_type.clone().unwrap_or_else(|| "smartphone".to_string());

        let guest = sqlx::query_as::<_, Guest>(
            r#"
            INSERT INTO guests (
                id, event_id, full_name, phone, email, whatsapp_phone, device_type,
                table_number, guest_category, plus_one_allowed, contact_method, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
            "#
        )
        .bind(&guest_id)
        .bind(&event_id)
        .bind(&req.full_name)
        .bind(&req.phone)
        .bind(&req.email)
        .bind(&req.whatsapp_phone)
        .bind(&device_type)
        .bind(&req.table_number)
        .bind(&req.guest_category)
        .bind(req.plus_one_allowed.unwrap_or(false))
        .bind(&contact_method)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await?;

        tracing::info!(
            guest_id = %guest_id,
            event_id = %event_id,
            phone = %req.phone,
            "Guest created"
        );

        Ok(guest)
    }

    /// Create multiple guests
    pub async fn create_multiple(
        pool: &PgPool,
        event_id: Uuid,
        guests: Vec<CreateGuestRequest>,
    ) -> AppResult<Vec<Guest>> {
        let mut tx = pool.begin().await?;
        let mut results = Vec::new();
        let now = Utc::now();

        for req in guests {
            let guest_id = Uuid::new_v4();
            let contact_method = req.contact_method.clone().unwrap_or_else(|| "whatsapp".to_string());
            let device_type = req.device_type.clone().unwrap_or_else(|| "smartphone".to_string());

            let guest = sqlx::query_as::<_, Guest>(
                r#"
                INSERT INTO guests (
                    id, event_id, full_name, phone, email, whatsapp_phone, device_type,
                    table_number, guest_category, plus_one_allowed, contact_method, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
                "#
            )
            .bind(&guest_id)
            .bind(&event_id)
            .bind(&req.full_name)
            .bind(&req.phone)
            .bind(&req.email)
            .bind(&req.whatsapp_phone)
            .bind(&device_type)
            .bind(&req.table_number)
            .bind(&req.guest_category)
            .bind(req.plus_one_allowed.unwrap_or(false))
            .bind(&contact_method)
            .bind(now)
            .bind(now)
            .fetch_one(&mut *tx)
            .await?;

            results.push(guest);
        }

        tx.commit().await?;

        tracing::info!(
            event_id = %event_id,
            count = results.len(),
            "Multiple guests created"
        );

        Ok(results)
    }

    /// Get guest by ID
    pub async fn get_by_id(pool: &PgPool, guest_id: Uuid) -> AppResult<Option<Guest>> {
        let guest = sqlx::query_as::<_, Guest>(
            "SELECT * FROM guests WHERE id = $1"
        )
        .bind(guest_id)
        .fetch_optional(pool)
        .await?;

        Ok(guest)
    }

    /// Get all guests for an event
    pub async fn list_by_event(
        pool: &PgPool,
        event_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> AppResult<(Vec<Guest>, i64)> {
        let guests = sqlx::query_as::<_, Guest>(
            r#"
            SELECT * FROM guests
            WHERE event_id = $1
            ORDER BY full_name ASC
            LIMIT $2 OFFSET $3
            "#
        )
        .bind(event_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM guests WHERE event_id = $1"
        )
        .bind(event_id)
        .fetch_one(pool)
        .await?;

        Ok((guests, total))
    }

    /// Get guests with RSVP status for an event
    pub async fn list_with_rsvp(
        pool: &PgPool,
        event_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> AppResult<(Vec<GuestWithRsvp>, i64)> {
        let guests = sqlx::query_as::<_, GuestWithRsvp>(
            r#"
            SELECT
                g.id, g.full_name, g.phone, g.device_type, g.guest_category, g.table_number, g.contact_method,
                r.response as rsvp_response, r.responded_at as rsvp_responded_at
            FROM guests g
            LEFT JOIN rsvp_responses r ON g.id = r.guest_id AND g.event_id = r.event_id
            WHERE g.event_id = $1
            ORDER BY g.full_name ASC
            LIMIT $2 OFFSET $3
            "#
        )
        .bind(event_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM guests WHERE event_id = $1"
        )
        .bind(event_id)
        .fetch_one(pool)
        .await?;

        Ok((guests, total))
    }

    /// Update guest
    pub async fn update(
        pool: &PgPool,
        guest_id: Uuid,
        req: &UpdateGuestRequest,
    ) -> AppResult<Guest> {
        let now = Utc::now();

        let guest = sqlx::query_as::<_, Guest>(
            r#"
            UPDATE guests
            SET
                full_name = COALESCE($2, full_name),
                phone = COALESCE($3, phone),
                email = COALESCE($4, email),
                whatsapp_phone = COALESCE($5, whatsapp_phone),
                device_type = COALESCE($6, device_type),
                table_number = COALESCE($7, table_number),
                guest_category = COALESCE($8, guest_category),
                plus_one_allowed = COALESCE($9, plus_one_allowed),
                contact_method = COALESCE($10, contact_method),
                notes = COALESCE($11, notes),
                updated_at = $12
            WHERE id = $1
            RETURNING *
            "#
        )
        .bind(guest_id)
        .bind(&req.full_name)
        .bind(&req.phone)
        .bind(&req.email)
        .bind(&req.whatsapp_phone)
        .bind(&req.device_type)
        .bind(&req.table_number)
        .bind(&req.guest_category)
        .bind(&req.plus_one_allowed)
        .bind(&req.contact_method)
        .bind(&req.notes)
        .bind(now)
        .fetch_one(pool)
        .await?;

        tracing::info!(guest_id = %guest_id, "Guest updated");

        Ok(guest)
    }

    /// Delete guest
    pub async fn delete(pool: &PgPool, guest_id: Uuid) -> AppResult<()> {
        sqlx::query("DELETE FROM guests WHERE id = $1")
            .bind(guest_id)
            .execute(pool)
            .await?;

        tracing::info!(guest_id = %guest_id, "Guest deleted");

        Ok(())
    }

    /// Count guests for an event
    pub async fn count_by_event(pool: &PgPool, event_id: Uuid) -> AppResult<i64> {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM guests WHERE event_id = $1"
        )
        .bind(event_id)
        .fetch_one(pool)
        .await?;

        Ok(count)
    }

    /// Get guest by phone and event
    pub async fn get_by_phone(
        pool: &PgPool,
        event_id: Uuid,
        phone: &str,
    ) -> AppResult<Option<Guest>> {
        let guest = sqlx::query_as::<_, Guest>(
            "SELECT * FROM guests WHERE event_id = $1 AND phone = $2"
        )
        .bind(event_id)
        .bind(phone)
        .fetch_optional(pool)
        .await?;

        Ok(guest)
    }
}
