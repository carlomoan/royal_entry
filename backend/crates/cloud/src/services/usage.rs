// ==============================================================================
// FILE: src/services/usage.rs
// ==============================================================================
// Usage tracking & metrics for billing dashboards
// ==============================================================================
use std::sync::Arc;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;
use crate::{
    error::AppResult,
    AppState,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageReport {
    pub organization_id: Uuid,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    pub events_count: i64,
    pub guests_count: i64,
    pub invitations_sent: i64,
    pub scans_count: i64,
    pub payments_count: i64,
    pub michango_pledges: i64,
    pub broadcasts_sent: i64,
    pub storage_mb: i64,
    pub api_calls: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageMetric {
    pub metric_name: String,
    pub value: i64,
    pub limit: Option<i64>,
    pub percentage: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanLimits {
    pub max_events: Option<i64>,
    pub max_guests: Option<i64>,
    pub max_users: Option<i64>,
    pub max_storage_mb: Option<i64>,
    pub max_api_calls_per_month: Option<i64>,
}

pub struct UsageService {
    state: Arc<AppState>,
}

impl UsageService {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    pub async fn get_usage_report(
        &self,
        org_id: Uuid,
        period_start: DateTime<Utc>,
        period_end: DateTime<Utc>,
    ) -> AppResult<UsageReport> {
        let events_count = self.count_events(org_id, period_start, period_end).await?;
        let guests_count = self.count_guests(org_id, period_start, period_end).await?;
        let invitations_sent = self.count_invitations_sent(org_id, period_start, period_end).await?;
        let scans_count = self.count_scans(org_id, period_start, period_end).await?;
        let payments_count = self.count_payments(org_id, period_start, period_end).await?;
        let michango_pledges = self.count_michango_pledges(org_id, period_start, period_end).await?;
        let broadcasts_sent = self.count_broadcasts_sent(org_id, period_start, period_end).await?;
        let storage_mb = self.calculate_storage_mb(org_id).await?;
        let api_calls = self.count_api_calls(org_id, period_start, period_end).await?;

        Ok(UsageReport {
            organization_id: org_id,
            period_start,
            period_end,
            events_count,
            guests_count,
            invitations_sent,
            scans_count,
            payments_count,
            michango_pledges,
            broadcasts_sent,
            storage_mb,
            api_calls,
        })
    }

    pub async fn get_usage_metrics(&self, org_id: Uuid) -> AppResult<Vec<UsageMetric>> {
        let now = Utc::now();
        let period_start = now - Duration::days(30);
        let period_end = now;
        let report = self.get_usage_report(org_id, period_start, period_end).await?;
        let plan_limits = self.get_plan_limits(org_id).await?;
        let users_count = self.count_users(org_id).await?;

        let metrics = vec![
            UsageMetric {
                metric_name: "Events".to_string(),
                value: report.events_count,
                limit: plan_limits.max_events,
                percentage: plan_limits.max_events.map(|l| (report.events_count as f64 / l as f64) * 100.0),
            },
            UsageMetric {
                metric_name: "Guests".to_string(),
                value: report.guests_count,
                limit: plan_limits.max_guests,
                percentage: plan_limits.max_guests.map(|l| (report.guests_count as f64 / l as f64) * 100.0),
            },
            UsageMetric {
                metric_name: "Users".to_string(),
                value: users_count,
                limit: plan_limits.max_users,
                percentage: plan_limits.max_users.map(|l| (users_count as f64 / l as f64) * 100.0),
            },
            UsageMetric {
                metric_name: "Storage (MB)".to_string(),
                value: report.storage_mb,
                limit: plan_limits.max_storage_mb,
                percentage: plan_limits.max_storage_mb.map(|l| (report.storage_mb as f64 / l as f64) * 100.0),
            },
            UsageMetric {
                metric_name: "API Calls (30d)".to_string(),
                value: report.api_calls,
                limit: plan_limits.max_api_calls_per_month,
                percentage: plan_limits.max_api_calls_per_month.map(|l| (report.api_calls as f64 / l as f64) * 100.0),
            },
        ];

        Ok(metrics)
    }

    pub async fn track_usage(&self, org_id: Uuid, metric: &str, delta: i64) -> AppResult<()> {
        sqlx::query(
            r#"
            INSERT INTO usage_metrics (organization_id, metric_name, value, recorded_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (organization_id, metric_name, DATE(recorded_at))
            DO UPDATE SET value = usage_metrics.value + EXCLUDED.value
            "#,
        )
        .bind(org_id)
        .bind(metric)
        .bind(delta)
        .execute(&*self.state.db.pool())
        .await?;

        Ok(())
    }

    pub async fn get_plan_limits(&self, org_id: Uuid) -> AppResult<PlanLimits> {
        let row = sqlx::query(
            r#"
            SELECT sp.max_users, sp.max_events, sp.max_guests, sp.max_storage_mb, sp.max_api_calls_per_month, sp.features
            FROM organization_subscriptions os
            JOIN service_plans sp ON sp.id = os.plan_id
            WHERE os.organization_id = $1 AND os.status IN ('active', 'trialing')
            ORDER BY os.created_at DESC
            LIMIT 1
            "#,
        )
        .bind(org_id)
        .fetch_optional(&*self.state.db.pool())
        .await?;

        if let Some(row) = row {
            Ok(PlanLimits {
                max_users: row.try_get::<Option<i64>, _>("max_users").ok().flatten(),
                max_events: row.try_get::<Option<i64>, _>("max_events").ok().flatten(),
                max_guests: row.try_get::<Option<i64>, _>("max_guests").ok().flatten(),
                max_storage_mb: row.try_get::<Option<i64>, _>("max_storage_mb").ok().flatten(),
                max_api_calls_per_month: row.try_get::<Option<i64>, _>("max_api_calls_per_month").ok().flatten(),
            })
        } else {
            // Default free tier limits
            Ok(PlanLimits {
                max_users: Some(3),
                max_events: Some(1),
                max_guests: Some(55),
                max_storage_mb: Some(100),
                max_api_calls_per_month: Some(10000),
            })
        }
    }

    /// Check if a feature is enabled for an organization based on its package.
    /// Returns true if the feature is enabled or the org is on an unlimited plan.
    pub async fn can_use_feature(&self, org_id: Uuid, feature: &str) -> AppResult<bool> {
        let features: Option<serde_json::Value> = sqlx::query_scalar(
            r#"
            SELECT sp.features
            FROM organization_subscriptions os
            JOIN service_plans sp ON sp.id = os.plan_id
            WHERE os.organization_id = $1 AND os.status IN ('active', 'trialing')
            ORDER BY os.created_at DESC
            LIMIT 1
            "#,
        )
        .bind(org_id)
        .fetch_optional(&*self.state.db.pool())
        .await?;

        match features {
            Some(features) => Ok(features.get(feature).and_then(|v| v.as_bool()).unwrap_or(true)),
            None => Ok(true),
        }
    }

    /// Get the features JSON for an organization's active plan.
    pub async fn get_plan_features(&self, org_id: Uuid) -> AppResult<serde_json::Value> {
        let features: Option<serde_json::Value> = sqlx::query_scalar(
            r#"
            SELECT sp.features
            FROM organization_subscriptions os
            JOIN service_plans sp ON sp.id = os.plan_id
            WHERE os.organization_id = $1 AND os.status IN ('active', 'trialing')
            ORDER BY os.created_at DESC
            LIMIT 1
            "#,
        )
        .bind(org_id)
        .fetch_optional(&*self.state.db.pool())
        .await?;

        Ok(features.unwrap_or_else(|| serde_json::json!({})))
    }

    /// Count the org's current (non-deleted) events.
    pub async fn count_org_events(&self, org_id: Uuid) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM events WHERE organization_id = $1 AND deleted_at IS NULL"
        )
        .bind(org_id)
        .fetch_one(&*self.state.db.pool())
        .await?;
        Ok(count)
    }

    /// Count the org's current total guests across all events.
    pub async fn count_org_guests(&self, org_id: Uuid) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM guests g
            JOIN events e ON e.id = g.event_id
            WHERE e.organization_id = $1 AND e.deleted_at IS NULL
            "#
        )
        .bind(org_id)
        .fetch_one(&*self.state.db.pool())
        .await?;
        Ok(count)
    }

    /// Enforce the max-events limit before creating a new event.
    pub async fn enforce_event_limit(&self, org_id: Uuid) -> AppResult<()> {
        let limits = self.get_plan_limits(org_id).await?;
        if let Some(max_events) = limits.max_events {
            let current = self.count_org_events(org_id).await?;
            if current >= max_events {
                return Err(crate::error::AppError::BadRequest(format!(
                    "Your package allows only {} event(s). You have reached this limit. Upgrade your package to add more events.",
                    max_events
                )));
            }
        }
        Ok(())
    }

    /// Enforce the max-guests limit before adding guests (delta = number being added).
    pub async fn enforce_guest_limit(&self, org_id: Uuid, delta: i64) -> AppResult<()> {
        let limits = self.get_plan_limits(org_id).await?;
        if let Some(max_guests) = limits.max_guests {
            let current = self.count_org_guests(org_id).await?;
            if current + delta > max_guests {
                return Err(crate::error::AppError::BadRequest(format!(
                    "Your package allows only {} guest(s). You have {} now and cannot add {} more. Upgrade your package to add more guests.",
                    max_guests, current, delta
                )));
            }
        }
        Ok(())
    }

    async fn count_events(&self, org_id: Uuid, start: DateTime<Utc>, end: DateTime<Utc>) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM events WHERE organization_id = $1 AND created_at BETWEEN $2 AND $3 AND deleted_at IS NULL"
        )
        .bind(org_id)
        .bind(start)
        .bind(end)
        .fetch_one(&*self.state.db.pool())
        .await?;
        Ok(count)
    }

    async fn count_guests(&self, org_id: Uuid, start: DateTime<Utc>, end: DateTime<Utc>) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM guests g JOIN events e ON e.id = g.event_id WHERE e.organization_id = $1 AND g.created_at BETWEEN $2 AND $3"
        )
        .bind(org_id)
        .bind(start)
        .bind(end)
        .fetch_one(&*self.state.db.pool())
        .await?;
        Ok(count)
    }

    async fn count_invitations_sent(&self, org_id: Uuid, start: DateTime<Utc>, end: DateTime<Utc>) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM invitations i JOIN guests g ON g.id = i.guest_id JOIN events e ON e.id = g.event_id WHERE e.organization_id = $1 AND i.invitation_sent_at BETWEEN $2 AND $3"
        )
        .bind(org_id)
        .bind(start)
        .bind(end)
        .fetch_one(&*self.state.db.pool())
        .await?;
        Ok(count)
    }

    async fn count_scans(&self, org_id: Uuid, start: DateTime<Utc>, end: DateTime<Utc>) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM scan_logs sl JOIN invitations i ON i.id = sl.invitation_id JOIN guests g ON g.id = i.guest_id JOIN events e ON e.id = g.event_id WHERE e.organization_id = $1 AND sl.scanned_at BETWEEN $2 AND $3"
        )
        .bind(org_id)
        .bind(start)
        .bind(end)
        .fetch_one(&*self.state.db.pool())
        .await?;
        Ok(count)
    }

    async fn count_payments(&self, org_id: Uuid, start: DateTime<Utc>, end: DateTime<Utc>) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM payments WHERE organization_id = $1 AND created_at BETWEEN $2 AND $3"
        )
        .bind(org_id)
        .bind(start)
        .bind(end)
        .fetch_one(&*self.state.db.pool())
        .await?;
        Ok(count)
    }

    async fn count_michango_pledges(&self, org_id: Uuid, start: DateTime<Utc>, end: DateTime<Utc>) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM pledges p JOIN guests g ON g.id = p.guest_id JOIN events e ON e.id = g.event_id WHERE e.organization_id = $1 AND p.created_at BETWEEN $2 AND $3"
        )
        .bind(org_id)
        .bind(start)
        .bind(end)
        .fetch_one(&*self.state.db.pool())
        .await?;
        Ok(count)
    }

    async fn count_broadcasts_sent(&self, org_id: Uuid, start: DateTime<Utc>, end: DateTime<Utc>) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM broadcast_campaigns WHERE org_id = $1 AND sent_at BETWEEN $2 AND $3"
        )
        .bind(org_id)
        .bind(start)
        .bind(end)
        .fetch_one(&*self.state.db.pool())
        .await?;
        Ok(count)
    }

    async fn calculate_storage_mb(&self, org_id: Uuid) -> AppResult<i64> {
        let attachments_mb: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(file_size), 0) / 1024 / 1024 FROM attachments a JOIN events e ON e.id = a.event_id WHERE e.organization_id = $1"
        )
        .bind(org_id)
        .fetch_one(&*self.state.db.pool())
        .await
        .unwrap_or(0);

        let db_estimate_mb = 10;
        Ok(attachments_mb + db_estimate_mb)
    }

    async fn count_api_calls(&self, org_id: Uuid, start: DateTime<Utc>, end: DateTime<Utc>) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM api_logs WHERE organization_id = $1 AND created_at BETWEEN $2 AND $3"
        )
        .bind(org_id)
        .bind(start)
        .bind(end)
        .fetch_one(&*self.state.db.pool())
        .await
        .unwrap_or(0);
        Ok(count)
    }

    async fn count_users(&self, org_id: Uuid) -> AppResult<i64> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = TRUE"
        )
        .bind(org_id)
        .fetch_one(&*self.state.db.pool())
        .await?;
        Ok(count)
    }
}
