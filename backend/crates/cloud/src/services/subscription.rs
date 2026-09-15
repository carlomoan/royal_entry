//! Organization subscription enforcement — every account-scoped action
//! verifies the org has an active subscription before proceeding.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct OrgSubscriptionStatus {
    pub organization_id: Uuid,
    pub enabled: bool,
    pub status: String,
    pub plan_code: Option<String>,
    pub plan_name: Option<String>,
    pub current_period_end: Option<DateTime<Utc>>,
    pub trial_ends_at: Option<DateTime<Utc>>,
    pub reason: Option<String>,
}

const PLATFORM_ORG_ID: &str = "00000000-0000-0000-0000-000000000000";

/// Check whether the org is allowed to perform account-scoped actions.
/// `organization_id = "00000000-..."` is the platform seed org and is exempt
/// (used for superadmin / platform / system admin).
pub async fn check_account_enabled(pool: &PgPool, organization_id: Uuid) -> OrgSubscriptionStatus {
    // Platform org is always enabled
    if organization_id.to_string() == PLATFORM_ORG_ID {
        return OrgSubscriptionStatus {
            organization_id,
            enabled: true,
            status: "platform".to_string(),
            plan_code: None,
            plan_name: None,
            current_period_end: None,
            trial_ends_at: None,
            reason: Some("Platform account".to_string()),
        };
    }

    // Check org-level account_enabled flag
    let org_enabled: Option<bool> = sqlx::query_scalar("SELECT account_enabled FROM organizations WHERE id = $1")
        .bind(organization_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

    if org_enabled == Some(false) {
        return OrgSubscriptionStatus {
            organization_id,
            enabled: false,
            status: "disabled".to_string(),
            plan_code: None,
            plan_name: None,
            current_period_end: None,
            trial_ends_at: None,
            reason: Some("Account disabled by platform admin".to_string()),
        };
    }

    // Check latest subscription row
    let row = sqlx::query(
        r#"
        SELECT os.status, os.current_period_end, os.trial_ends_at, sp.code, sp.name
        FROM organization_subscriptions os
        LEFT JOIN service_plans sp ON sp.id = os.plan_id
        WHERE os.organization_id = $1
        ORDER BY os.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(organization_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    if let Some(row) = row {
        let status: String = row.try_get("status").unwrap_or_else(|_| "pending".to_string());
        let current_period_end: Option<DateTime<Utc>> = row.try_get("current_period_end").ok().flatten();
        let trial_ends_at: Option<DateTime<Utc>> = row.try_get("trial_ends_at").ok().flatten();
        let plan_code: Option<String> = row.try_get("code").ok().flatten();
        let plan_name: Option<String> = row.try_get("name").ok().flatten();

        let now = Utc::now();
        let in_trial = trial_ends_at.map(|d| d > now).unwrap_or(false);
        let in_period = current_period_end.map(|d| d > now).unwrap_or(false);
        let enabled = matches!(status.as_str(), "active" | "trialing") && (in_trial || in_period);

        let reason = if !enabled {
            if matches!(status.as_str(), "cancelled" | "expired" | "past_due") {
                Some(format!("Subscription is {}", status))
            } else if !in_period {
                Some("Subscription period ended".to_string())
            } else {
                Some("Subscription inactive".to_string())
            }
        } else {
            None
        };

        OrgSubscriptionStatus {
            organization_id,
            enabled,
            status,
            plan_code,
            plan_name,
            current_period_end,
            trial_ends_at,
            reason,
        }
    } else {
        // No subscription row — account needs a plan assigned
        OrgSubscriptionStatus {
            organization_id,
            enabled: false,
            status: "no_plan".to_string(),
            plan_code: None,
            plan_name: None,
            current_period_end: None,
            trial_ends_at: None,
            reason: Some("No active package/subscription assigned to this account".to_string()),
        }
    }
}

/// Lightweight helper to enforce subscription at the top of account-scoped
/// handlers. Returns `Ok(())` if the org is enabled, otherwise an error.
pub async fn require_active_subscription(pool: &PgPool, organization_id: Uuid) -> Result<(), String> {
    let status = check_account_enabled(pool, organization_id).await;
    if status.enabled { Ok(()) } else { Err(status.reason.unwrap_or_else(|| "Account inactive".to_string())) }
}
