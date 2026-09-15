// ==============================================================================
// FILE: src/services/billing.rs
// ==============================================================================
// Billing automation service - recurring invoices, retries, dunning, trials
// ==============================================================================
use std::sync::Arc;
use chrono::{DateTime, Duration, Utc};
use sqlx::Row;
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    models::billing::OrganizationSubscription,
    services::messaging::MessagingService,
    AppState,
};

#[derive(Clone)]
pub struct BillingService {
    state: Arc<AppState>,
    mpesa: crate::services::mpesa::MpesaService,
    messaging: MessagingService,
}

impl BillingService {
    pub fn new(state: Arc<AppState>) -> Self {
        let mpesa = crate::services::mpesa::MpesaService::new(state.clone());
        let messaging = MessagingService::new();
        Self { state, mpesa, messaging }
    }

    // ============================================================================
    // MAIN CRON JOBS
    // ============================================================================

    /// Generate recurring invoices for subscriptions due for renewal
    pub async fn generate_recurring_invoices(&self) -> AppResult<u64> {
        let now = Utc::now();
        let mut tx = self.state.db.pool().begin().await?;

        let due_subscriptions = sqlx::query_as::<_, OrganizationSubscription>(
            r#"
            SELECT * FROM organization_subscriptions
            WHERE status IN ('active', 'trialing')
              AND current_period_end <= $1
              AND (trial_ends_at IS NULL OR trial_ends_at <= $1)
            "#,
        )
        .bind(now)
        .fetch_all(&mut *tx)
        .await?;

        let mut generated = 0u64;
        for sub in due_subscriptions {
            if let Err(e) = self.generate_invoice_for_subscription(&mut tx, &sub, now).await {
                tracing::error!(subscription_id = %sub.id, error = %e, "Failed to generate invoice");
                continue;
            }
            generated += 1;
        }

        tx.commit().await?;
        tracing::info!(count = generated, "Generated recurring invoices");
        Ok(generated)
    }

    /// Process due invoices - attempt payment collection
    pub async fn process_due_invoices(&self) -> AppResult<u64> {
        let now = Utc::now();

        let due_invoices = sqlx::query(
            r#"
            SELECT bi.*, o.contact_phone, o.display_name
            FROM billing_invoices bi
            JOIN organizations o ON o.id = bi.organization_id
            WHERE bi.status = 'open'
              AND bi.due_at <= $1
              AND bi.paid_at IS NULL
            "#,
        )
        .bind(now)
        .fetch_all(&*self.state.db.pool())
        .await?;

        let mut processed = 0u64;
        for row in due_invoices {
            let invoice_id: Uuid = row.try_get::<Uuid, _>("id")?;
            let org_id: Uuid = row.try_get::<Uuid, _>("organization_id")?;
            let amount_tsh: i64 = row.try_get::<i64, _>("amount_tsh")?;
            let phone: Option<String> = row.try_get::<Option<String>, _>("contact_phone")?;
            let org_name: String = row.try_get::<String, _>("display_name")?;

            if let Some(phone) = phone {
                if let Err(e) = self.charge_invoice(invoice_id, org_id, amount_tsh, &phone, &org_name).await {
                    tracing::warn!(invoice_id = %invoice_id, error = %e, "Payment failed, will retry");
                    sqlx::query(
                        "UPDATE billing_invoices SET notes = COALESCE(notes, '') || $1 WHERE id = $2",
                    )
                    .bind(format!(
                        "\n[{}] Payment attempt failed: {}",
                        Utc::now().format("%Y-%m-%d %H:%M"),
                        e
                    ))
                    .bind(invoice_id)
                    .execute(&*self.state.db.pool())
                    .await?;
                } else {
                    processed += 1;
                }
            }
        }
        Ok(processed)
    }

    /// Retry failed payments with exponential backoff
    pub async fn retry_failed_payments(&self) -> AppResult<u64> {
        let now = Utc::now();

        let failed_invoices = sqlx::query(
            r#"
            SELECT bi.*, o.contact_phone, o.display_name,
                   COALESCE(
                       (SELECT COUNT(*) FROM payments p WHERE p.invoice_id = bi.id AND p.status = 'failed'),
                       0
                   ) as retry_count
            FROM billing_invoices bi
            JOIN organizations o ON o.id = bi.organization_id
            WHERE bi.status IN ('open', 'overdue')
              AND bi.paid_at IS NULL
              AND o.contact_phone IS NOT NULL
            "#,
        )
        .fetch_all(&*self.state.db.pool())
        .await?;

        let mut retried = 0u64;
        for row in failed_invoices {
            let invoice_id: Uuid = row.try_get::<Uuid, _>("id")?;
            let org_id: Uuid = row.try_get::<Uuid, _>("organization_id")?;
            let amount_tsh: i64 = row.try_get::<i64, _>("amount_tsh")?;
            let phone: String = row.try_get::<String, _>("contact_phone")?;
            let org_name: String = row.try_get::<String, _>("display_name")?;
            let retry_count: i64 = row.try_get::<i64, _>("retry_count")?;

            let max_retries = 5;
            if retry_count >= max_retries {
                continue;
            }

            let backoff_hours = match retry_count {
                0 => 1,
                1 => 4,
                2 => 12,
                3 => 24,
                4 => 48,
                _ => 48,
            };

            let last_attempt = sqlx::query_scalar::<_, Option<DateTime<Utc>>>(
                "SELECT MAX(created_at) FROM payments WHERE invoice_id = $1 AND status = 'failed'",
            )
            .bind(invoice_id)
            .fetch_one(&*self.state.db.pool())
            .await?;

            let should_retry = last_attempt.map_or(true, |last| {
                now.signed_duration_since(last) >= Duration::hours(backoff_hours)
            });

            if !should_retry {
                continue;
            }

            if let Err(e) = self.charge_invoice(invoice_id, org_id, amount_tsh, &phone, &org_name).await {
                tracing::warn!(invoice_id = %invoice_id, retry = retry_count, error = %e, "Retry failed");
            } else {
                retried += 1;
            }
        }
        Ok(retried)
    }

    /// Send dunning notices for overdue invoices
    pub async fn send_dunning_notices(&self) -> AppResult<u64> {
        let now = Utc::now();
        let mut sent = 0u64;

        let overdue = sqlx::query(
            r#"
            SELECT bi.*, o.contact_phone, o.billing_email, o.display_name
            FROM billing_invoices bi
            JOIN organizations o ON o.id = bi.organization_id
            WHERE bi.status IN ('open', 'overdue')
              AND bi.due_at < $1
              AND bi.paid_at IS NULL
              AND bi.voided_at IS NULL
            "#,
        )
        .bind(now)
        .fetch_all(&*self.state.db.pool())
        .await?;

        for row in overdue {
            let invoice_id: Uuid = row.try_get::<Uuid, _>("id")?;
            let _org_id: Uuid = row.try_get::<Uuid, _>("organization_id")?;
            let amount_tsh: i64 = row.try_get::<i64, _>("amount_tsh")?;
            let phone: Option<String> = row.try_get::<Option<String>, _>("contact_phone")?;
            let email: Option<String> = row.try_get::<Option<String>, _>("billing_email")?;
            let org_name: String = row.try_get::<String, _>("display_name")?;
            let due_at: DateTime<Utc> = row.try_get::<DateTime<Utc>, _>("due_at")?;

            let days_overdue = (now - due_at).num_days();

            // Send SMS reminder
            if let Some(phone) = phone {
                let msg = format!(
                    "RoyalEntry: Invoice {} for {} TZS is {} days overdue. Please pay to avoid service interruption. Org: {}",
                    invoice_id, amount_tsh, days_overdue, org_name
                );
                if let Err(e) = self.messaging.send("sms", &phone, &msg).await {
                    tracing::warn!(invoice_id = %invoice_id, error = %e, "Failed to send SMS dunning");
                }
            }

            // Send email reminder (if email service is configured)
            if let Some(email) = email {
                let subject = format!("Overdue Invoice - {} days past due", days_overdue);
                let _body = format!(
                    "Dear {},\n\nYour invoice for {} TZS was due on {} and is now {} days overdue.\n\nPlease log in to your RoyalEntry account to make payment and avoid service interruption.\n\nInvoice ID: {}\nOrganization: {}\n\nRegards,\nRoyalEntry Team",
                    org_name, amount_tsh, due_at.format("%Y-%m-%d"), days_overdue, invoice_id, org_name
                );
                // TODO: Implement email sending via SMTP/SendGrid
                tracing::info!(email = %email, subject = %subject, "Email dunning would be sent");
            }

            // Update invoice status to overdue if not already
            sqlx::query("UPDATE billing_invoices SET status = 'overdue' WHERE id = $1 AND status = 'open'")
                .bind(invoice_id)
                .execute(&*self.state.db.pool())
                .await?;
            sent += 1;
        }
        Ok(sent)
        let n = crate::services::NotificationService::new(self.state.clone());
        n.push(
            Some(org_id), None,
            "invoice.overdue",
            &format!("Invoice overdue by {} days — TZS {}", days_overdue, amount_tsh),
            None,
            Some("/billing"),
        ).await;
    }

    /// Convert trial subscriptions to paid
    pub async fn convert_trials(&self) -> AppResult<u64> {
        let now = Utc::now();
        let mut tx = self.state.db.pool().begin().await?;

        let trials_ending = sqlx::query_as::<_, OrganizationSubscription>(
            r#"
            SELECT * FROM organization_subscriptions
            WHERE status = 'trialing'
              AND trial_ends_at <= $1
            "#,
        )
        .bind(now)
        .fetch_all(&mut *tx)
        .await?;

        let mut converted = 0u64;
        for sub in trials_ending {
            if let Err(e) = self.generate_invoice_for_subscription(&mut tx, &sub, now).await {
                tracing::error!(subscription_id = %sub.id, error = %e, "Failed to generate trial conversion invoice");
                continue;
            }
            sqlx::query(
                "UPDATE organization_subscriptions SET status = 'active', trial_ends_at = NULL, updated_at = NOW() WHERE id = $1"
            )
            .bind(sub.id)
            .execute(&mut *tx)
            .await?;
            converted += 1;
        }
        tx.commit().await?;
        Ok(converted)
    }

    /// Handle grace periods - suspend overdue accounts
    pub async fn handle_grace_periods(&self) -> AppResult<u64> {
        let now = Utc::now();
        let grace_period_days = 7;
        let overdue_limit = now - Duration::days(grace_period_days);

        let to_suspend = sqlx::query(
            r#"
            SELECT DISTINCT bi.organization_id
            FROM billing_invoices bi
            WHERE bi.status = 'overdue'
              AND bi.due_at <= $1
              AND bi.paid_at IS NULL
              AND bi.voided_at IS NULL
            "#,
        )
        .bind(overdue_limit)
        .fetch_all(&*self.state.db.pool())
        .await?;

        let mut suspended = 0u64;
        for row in to_suspend {
            let org_id: Uuid = row.try_get::<Uuid, _>("organization_id")?;

            sqlx::query("UPDATE users SET is_active = FALSE WHERE organization_id = $1")
                .bind(org_id)
                .execute(&*self.state.db.pool())
                .await?;

            sqlx::query("UPDATE organizations SET account_status = 'suspended', updated_at = NOW() WHERE id = $1")
                .bind(org_id)
                .execute(&*self.state.db.pool())
                .await?;

            sqlx::query("UPDATE organization_subscriptions SET status = 'past_due', updated_at = NOW() WHERE organization_id = $1 AND status = 'active'")
                .bind(org_id)
                .execute(&*self.state.db.pool())
                .await?;

            suspended += 1;
        }
        Ok(suspended)
    }

    // ============================================================================
    // HELPER METHODS
    // ============================================================================

    async fn generate_invoice_for_subscription(
        &self,
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        sub: &OrganizationSubscription,
        now: DateTime<Utc>,
    ) -> AppResult<Uuid> {
        let plan = sqlx::query(
            "SELECT id, name, price_tsh, billing_interval FROM service_plans WHERE id = $1",
        )
        .bind(sub.plan_id)
        .fetch_one(&mut **tx)
        .await?;

        let plan_id: Uuid = plan.try_get::<Uuid, _>("id")?;
        let plan_name: String = plan.try_get::<String, _>("name")?;
        let price_tsh: i64 = plan.try_get::<i64, _>("price_tsh")?;
        let billing_interval: String = plan.try_get::<String, _>("billing_interval")?;

        let (period_start, period_end) = match billing_interval.as_str() {
            "yearly" => (now, now + Duration::days(365)),
            "weekly" => (now, now + Duration::days(7)),
            _ => (now, now + Duration::days(30)),
        };

        let due_at = now + Duration::days(7);
        let invoice_number = format!(
            "INV-{}-{}",
            sub.organization_id.to_string()[..8].to_uppercase(),
            now.format("%Y%m%d%H%M%S")
        );
        let invoice_id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO billing_invoices (
                id, organization_id, subscription_id, plan_id, invoice_number,
                amount_tsh, status, issued_at, due_at, period_start, period_end,
                notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9, $10, $11, $7, $7)
            "#,
        )
        .bind(invoice_id)
        .bind(sub.organization_id)
        .bind(sub.id)
        .bind(plan_id)
        .bind(&invoice_number)
        .bind(price_tsh)
        .bind(now)
        .bind(due_at)
        .bind(period_start)
        .bind(period_end)
        .bind(format!("{} renewal invoice", plan_name))
        .execute(&mut **tx)
        .await?;

        sqlx::query(
            "UPDATE organization_subscriptions SET current_period_start = $1, current_period_end = $2, updated_at = NOW() WHERE id = $3"
        )
        .bind(period_start)
        .bind(period_end)
        .bind(sub.id)
        .execute(&mut **tx)
        .await?;

        Ok(invoice_id)
    }

    async fn charge_invoice(
        &self,
        invoice_id: Uuid,
        org_id: Uuid,
        amount_tsh: i64,
        phone: &str,
        org_name: &str,
    ) -> AppResult<()> {
        let mpesa_result = self
            .mpesa
            .stk_push(
                phone,
                amount_tsh as u64,
                &format!("INV-{}", invoice_id.to_string()[..8].to_uppercase()),
                &format!("Invoice payment for {}", org_name),
            )
            .await?;

        let payment_id = Uuid::new_v4();
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO payments (
                id, organization_id, event_id, payment_type, package_name,
                amount_tsh, payment_method, payer_phone, status,
                payment_gateway, notes, created_at, updated_at,
                invoice_id
            ) VALUES ($1, $2, NULL, 'subscription', $3, $4, 'mpesa', $5, 'pending', 'mpesa', $6, $7, $7, $8)
            "#,
        )
        .bind(payment_id)
        .bind(org_id)
        .bind("Subscription renewal")
        .bind(amount_tsh)
        .bind(phone)
        .bind("M-Pesa STK Push for invoice")
        .bind(now)
        .bind(invoice_id)
        .execute(&*self.state.db.pool())
        .await?;

        sqlx::query(
            "UPDATE payments SET provider_checkout_request_id = $1 WHERE id = $2",
        )
        .bind(&mpesa_result.checkout_request_id)
        .bind(payment_id)
        .execute(&*self.state.db.pool())
        .await?;

        Ok(())
    }

    // ============================================================================
    // PRORATED PLAN CHANGES
    // ============================================================================

    pub fn calculate_proration(
        &self,
        current_price: i64,
        new_price: i64,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
        change_date: DateTime<Utc>,
    ) -> (i64, i64) {
        let total_days = (period_end - period_start).num_days() as f64;
        let days_used = (change_date - period_start).num_days() as f64;
        let days_remaining = (period_end - change_date).num_days() as f64;

        if days_remaining <= 0.0 {
            return (0, 0);
        }

        let used_ratio = days_used / total_days;
        let remaining_ratio = days_remaining / total_days;
        let _used_value = (current_price as f64 * used_ratio).round() as i64;
        let remaining_credit = (current_price as f64 * remaining_ratio).round() as i64;
        let new_charge = (new_price as f64 * remaining_ratio).round() as i64;
        let net_charge = new_charge - remaining_credit;

        (net_charge.max(0), remaining_credit)
    }

    pub async fn change_plan_with_proration(
        &self,
        org_id: Uuid,
        new_plan_id: Uuid,
    ) -> AppResult<()> {
        let mut tx = self.state.db.pool().begin().await?;

        let sub = sqlx::query_as::<_, OrganizationSubscription>(
            "SELECT * FROM organization_subscriptions WHERE organization_id = $1 AND status IN ('active', 'trialing')"
        )
        .bind(org_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound("No active subscription found".to_string()))?;

        let current_plan = sqlx::query("SELECT price_tsh FROM service_plans WHERE id = $1")
            .bind(sub.plan_id)
            .fetch_one(&mut *tx)
            .await?;
        let new_plan = sqlx::query("SELECT price_tsh FROM service_plans WHERE id = $1")
            .bind(new_plan_id)
            .fetch_one(&mut *tx)
            .await?;

        let current_price: i64 = current_plan.try_get::<i64, _>("price_tsh")?;
        let new_price: i64 = new_plan.try_get::<i64, _>("price_tsh")?;
        let now = Utc::now();

        let (net_charge, credit) = self.calculate_proration(
            current_price,
            new_price,
            sub.current_period_start,
            sub.current_period_end,
            now,
        );

        sqlx::query(
            "UPDATE organization_subscriptions SET plan_id = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(new_plan_id)
        .bind(sub.id)
        .execute(&mut *tx)
        .await?;

        if net_charge > 0 {
            let invoice_id = Uuid::new_v4();
            let invoice_number = format!(
                "INV-{}-PRORATE-{}",
                org_id.to_string()[..8].to_uppercase(),
                Utc::now().format("%Y%m%d%H%M%S")
            );
            sqlx::query(
                r#"
                INSERT INTO billing_invoices (
                    id, organization_id, subscription_id, plan_id, invoice_number,
                    amount_tsh, status, issued_at, due_at, period_start, period_end,
                    notes, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9, $10, $11, $7, $7)
                "#,
            )
            .bind(invoice_id)
            .bind(org_id)
            .bind(sub.id)
            .bind(new_plan_id)
            .bind(&invoice_number)
            .bind(net_charge)
            .bind(Utc::now())
            .bind(Utc::now() + Duration::days(7))
            .bind(Utc::now())
            .bind(sub.current_period_end)
            .bind(format!("Prorated plan change credit: {} TZS", credit))
            .execute(&mut *tx)
            .await?;
        }

        if credit > 0 {
            sqlx::query(
                "UPDATE organization_subscriptions SET notes = COALESCE(notes, '') || $1 WHERE id = $2"
            )
            .bind(format!(
                "\n[{}] Proration credit applied: {} TZS",
                Utc::now().format("%Y-%m-%d"),
                credit
            ))
            .bind(sub.id)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }
}
