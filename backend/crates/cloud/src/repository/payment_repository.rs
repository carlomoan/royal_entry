// ==============================================================================
// FILE: src/repository/payment_repository.rs
// ==============================================================================

use crate::error::AppResult;
use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;
use crate::models::payment::Payment; // Adjust path if your Payment struct is elsewhere

pub struct PaymentRepository;

impl PaymentRepository {
    /// Create a pending payment record before initiating STK Push
    pub async fn create_pending(
        pool: &PgPool,
        org_id: Uuid,
        event_id: Option<Uuid>,
        package_name: &str,
        amount_tsh: i64,
        payer_phone: &str,
        checkout_request_id: &str,
    ) -> AppResult<Payment> {
        let id  = Uuid::new_v4();
        let now = Utc::now();

        let payment = sqlx::query_as::<_, Payment>(
            r#"
            INSERT INTO payments (
                id, organization_id, event_id, payment_type, package_name,
                amount_tsh, payment_method, payer_phone, checkout_request_id,
                status, payment_gateway, created_at, updated_at
            )
            VALUES ($1,$2,$3,'event_package',$4,$5,'mpesa',$6,$7,'pending','daraja',$8,$8)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(org_id)
        .bind(event_id)
        .bind(package_name)
        .bind(amount_tsh)
        .bind(payer_phone)
        .bind(checkout_request_id)
        .bind(now)
        .fetch_one(pool)
        .await?;

        tracing::info!(
            payment_id           = %id,
            checkout_request_id  = checkout_request_id,
            amount_tsh           = amount_tsh,
            "Pending payment created"
        );

        Ok(payment)
    }

    /// Mark payment as completed after successful callback
    pub async fn mark_completed(
        pool: &PgPool,
        checkout_request_id: &str,
        mpesa_receipt: &str,
        amount_confirmed: i64,
    ) -> AppResult<Payment> {
        let now = Utc::now();

        let payment = sqlx::query_as::<_, Payment>(
            r#"
            UPDATE payments
            SET status               = 'completed',
                mpesa_receipt_number = $2,
                amount_tsh           = $3,
                completed_at         = $4,
                updated_at           = $4
            WHERE checkout_request_id = $1
            RETURNING *
            "#,
        )
        .bind(checkout_request_id)
        .bind(mpesa_receipt)
        .bind(amount_confirmed)
        .bind(now)
        .fetch_one(pool)
        .await?;

        tracing::info!(
            payment_id   = %payment.id,
            receipt      = mpesa_receipt,
            amount_tsh   = amount_confirmed,
            "Payment completed"
        );

        Ok(payment)
    }

    /// Mark payment as failed
    pub async fn mark_failed(
        pool: &PgPool,
        checkout_request_id: &str,
        reason: &str,
    ) -> AppResult<()> {
        let now = Utc::now();

        sqlx::query(
            r#"
            UPDATE payments
            SET status           = 'failed',
                gateway_response = $2,
                updated_at       = $3
            WHERE checkout_request_id = $1
            "#,
        )
        .bind(checkout_request_id)
        .bind(reason)
        .bind(now)
        .execute(pool)
        .await?;

        tracing::warn!(
            checkout_request_id = checkout_request_id,
            reason              = reason,
            "Payment marked failed"
        );

        Ok(())
    }

    /// Look up payment by checkout_request_id (used in callback)
    pub async fn get_by_checkout_id(
        pool: &PgPool,
        checkout_request_id: &str,
    ) -> AppResult<Option<Payment>> {
        let p = sqlx::query_as::<_, Payment>(
            "SELECT * FROM payments WHERE checkout_request_id = $1",
        )
        .bind(checkout_request_id)
        .fetch_optional(pool)
        .await?;

        Ok(p)
    }

    /// Get payment by ID
    pub async fn get_by_id(pool: &PgPool, payment_id: Uuid) -> AppResult<Option<Payment>> {
        let p = sqlx::query_as::<_, Payment>(
            "SELECT * FROM payments WHERE id = $1",
        )
        .bind(payment_id)
        .fetch_optional(pool)
        .await?;

        Ok(p)
    }

    /// List payments for an organization
    pub async fn list_by_organization(
        pool: &PgPool,
        org_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> AppResult<(Vec<Payment>, i64)> {
        let payments = sqlx::query_as::<_, Payment>(
            r#"
            SELECT * FROM payments
            WHERE organization_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(org_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM payments WHERE organization_id = $1",
        )
        .bind(org_id)
        .fetch_one(pool)
        .await?;

        Ok((payments, total))
    }
}
