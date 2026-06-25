use std::sync::Arc;

use axum::{
    extract::{Query, State},
    Extension, Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    utils::rbac::{claims_org_id, require_account_admin, require_platform_admin},
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct ReportsQuery {
    pub organization_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ExportQuery {
    pub report: String,
    pub organization_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct ReportSummaryResponse {
    pub total_events: i64,
    pub total_guests: i64,
    pub total_arrivals: i64,
    pub total_payments_tsh: i64,
    pub total_michango_tsh: i64,
    pub total_broadcasts: i64,
}

fn scoped_org_id(claims: &Claims, requested: Option<Uuid>) -> AppResult<Option<Uuid>> {
    if require_platform_admin(claims).is_ok() {
        Ok(requested)
    } else {
        Ok(Some(claims_org_id(claims)?))
    }
}

fn csv_escape(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

pub async fn report_summary(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ReportsQuery>,
) -> AppResult<Json<serde_json::Value>> {
    require_account_admin(&claims)?;
    let org_id = scoped_org_id(&claims, query.organization_id)?;

    let row = sqlx::query(
        r#"
        SELECT
            (SELECT COUNT(*) FROM events WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR organization_id = $1)) AS total_events,
            (SELECT COUNT(*) FROM guests g JOIN events e ON e.id = g.event_id WHERE e.deleted_at IS NULL AND ($1::uuid IS NULL OR e.organization_id = $1)) AS total_guests,
            (SELECT COUNT(*) FROM entry_scans s JOIN events e ON e.id = s.event_id WHERE e.deleted_at IS NULL AND ($1::uuid IS NULL OR e.organization_id = $1)) AS total_arrivals,
            (SELECT COALESCE(SUM(amount_tsh)::BIGINT, 0) FROM payments WHERE status = 'completed' AND ($1::uuid IS NULL OR organization_id = $1)) AS total_payments_tsh,
            (
                SELECT COALESCE(SUM(pt.amount_paid)::BIGINT, 0)
                FROM pledge_tracker pt
                JOIN events e ON e.id = pt.event_id
                WHERE e.deleted_at IS NULL AND ($1::uuid IS NULL OR e.organization_id = $1)
            ) AS total_michango_tsh,
            (
                SELECT COUNT(*)
                FROM broadcast_campaigns bc
                JOIN events e ON e.id = bc.event_id
                WHERE e.deleted_at IS NULL AND ($1::uuid IS NULL OR e.organization_id = $1)
            ) AS total_broadcasts
        "#,
    )
    .bind(org_id)
    .fetch_one(state.db.pool())
    .await?;

    let summary = ReportSummaryResponse {
        total_events: row.try_get("total_events").unwrap_or(0),
        total_guests: row.try_get("total_guests").unwrap_or(0),
        total_arrivals: row.try_get("total_arrivals").unwrap_or(0),
        total_payments_tsh: row.try_get("total_payments_tsh").unwrap_or(0),
        total_michango_tsh: row.try_get("total_michango_tsh").unwrap_or(0),
        total_broadcasts: row.try_get("total_broadcasts").unwrap_or(0),
    };

    Ok(Json(json!({ "success": true, "data": summary })))
}

pub async fn export_report(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ExportQuery>,
) -> AppResult<Json<serde_json::Value>> {
    require_account_admin(&claims)?;
    let org_id = scoped_org_id(&claims, query.organization_id)?;
    let report = query.report.trim().to_ascii_lowercase();

    let (filename, content) = match report.as_str() {
        "events" => {
            let rows = sqlx::query(
                r#"
                SELECT title, event_date::text AS event_date, event_time, venue_name, status, card_theme
                FROM events
                WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR organization_id = $1)
                ORDER BY event_date DESC, created_at DESC
                "#,
            )
            .bind(org_id)
            .fetch_all(state.db.pool())
            .await?;

            let mut lines = vec!["title,event_date,event_time,venue_name,status,card_theme".to_string()];
            for row in rows {
                lines.push(vec![
                    csv_escape(&row.try_get::<String, _>("title")?),
                    csv_escape(&row.try_get::<String, _>("event_date")?),
                    csv_escape(row.try_get::<Option<String>, _>("event_time")?.as_deref().unwrap_or("")),
                    csv_escape(row.try_get::<Option<String>, _>("venue_name")?.as_deref().unwrap_or("")),
                    csv_escape(&row.try_get::<String, _>("status")?),
                    csv_escape(row.try_get::<Option<String>, _>("card_theme")?.as_deref().unwrap_or("")),
                ].join(","));
            }
            (format!("events-report-{}.csv", Utc::now().format("%Y%m%d-%H%M%S")), lines.join("\n"))
        }
        "guests" => {
            let rows = sqlx::query(
                r#"
                SELECT e.title AS event_title, g.full_name, g.phone, g.email, g.table_number, g.guest_category, COALESCE(r.response, 'pending') AS rsvp_status
                FROM guests g
                JOIN events e ON e.id = g.event_id
                LEFT JOIN rsvp_responses r ON r.guest_id = g.id AND r.event_id = g.event_id
                WHERE e.deleted_at IS NULL AND ($1::uuid IS NULL OR e.organization_id = $1)
                ORDER BY e.event_date DESC, g.full_name ASC
                "#,
            )
            .bind(org_id)
            .fetch_all(state.db.pool())
            .await?;
            let mut lines = vec!["event_title,full_name,phone,email,table_number,guest_category,rsvp_status".to_string()];
            for row in rows {
                lines.push(vec![
                    csv_escape(&row.try_get::<String, _>("event_title")?),
                    csv_escape(&row.try_get::<String, _>("full_name")?),
                    csv_escape(&row.try_get::<String, _>("phone")?),
                    csv_escape(row.try_get::<Option<String>, _>("email")?.as_deref().unwrap_or("")),
                    csv_escape(row.try_get::<Option<String>, _>("table_number")?.as_deref().unwrap_or("")),
                    csv_escape(row.try_get::<Option<String>, _>("guest_category")?.as_deref().unwrap_or("")),
                    csv_escape(&row.try_get::<String, _>("rsvp_status")?),
                ].join(","));
            }
            (format!("guests-report-{}.csv", Utc::now().format("%Y%m%d-%H%M%S")), lines.join("\n"))
        }
        "payments" => {
            let rows = sqlx::query(
                r#"
                SELECT package_name, amount_tsh, payment_method, payer_phone, status, mpesa_receipt_number, created_at::text AS created_at
                FROM payments
                WHERE ($1::uuid IS NULL OR organization_id = $1)
                ORDER BY created_at DESC
                "#,
            )
            .bind(org_id)
            .fetch_all(state.db.pool())
            .await?;
            let mut lines = vec!["package_name,amount_tsh,payment_method,payer_phone,status,mpesa_receipt_number,created_at".to_string()];
            for row in rows {
                lines.push(vec![
                    csv_escape(row.try_get::<Option<String>, _>("package_name")?.as_deref().unwrap_or("")),
                    row.try_get::<i64, _>("amount_tsh")?.to_string(),
                    csv_escape(&row.try_get::<String, _>("payment_method")?),
                    csv_escape(row.try_get::<Option<String>, _>("payer_phone")?.as_deref().unwrap_or("")),
                    csv_escape(&row.try_get::<String, _>("status")?),
                    csv_escape(row.try_get::<Option<String>, _>("mpesa_receipt_number")?.as_deref().unwrap_or("")),
                    csv_escape(&row.try_get::<String, _>("created_at")?),
                ].join(","));
            }
            (format!("payments-report-{}.csv", Utc::now().format("%Y%m%d-%H%M%S")), lines.join("\n"))
        }
        "michango" => {
            let rows = sqlx::query(
                r#"
                SELECT e.title AS event_title, g.full_name, pt.pledged_amount, pt.amount_paid, pt.payment_status, pt.payment_deadline::text AS payment_deadline
                FROM pledge_tracker pt
                JOIN guests g ON g.id = pt.guest_id
                JOIN events e ON e.id = pt.event_id
                WHERE e.deleted_at IS NULL AND ($1::uuid IS NULL OR e.organization_id = $1)
                ORDER BY e.event_date DESC, g.full_name ASC
                "#,
            )
            .bind(org_id)
            .fetch_all(state.db.pool())
            .await?;
            let mut lines = vec!["event_title,guest_name,pledged_amount,amount_paid,payment_status,payment_deadline".to_string()];
            for row in rows {
                lines.push(vec![
                    csv_escape(&row.try_get::<String, _>("event_title")?),
                    csv_escape(&row.try_get::<String, _>("full_name")?),
                    row.try_get::<i64, _>("pledged_amount")?.to_string(),
                    row.try_get::<i64, _>("amount_paid")?.to_string(),
                    csv_escape(&row.try_get::<String, _>("payment_status")?),
                    csv_escape(row.try_get::<Option<String>, _>("payment_deadline")?.as_deref().unwrap_or("")),
                ].join(","));
            }
            (format!("michango-report-{}.csv", Utc::now().format("%Y%m%d-%H%M%S")), lines.join("\n"))
        }
        "broadcasts" => {
            let rows = sqlx::query(
                r#"
                SELECT e.title AS event_title, bc.campaign_name, bc.message_channel, bc.target_audience, bc.status, bc.successfully_sent, bc.failed_count, bc.created_at::text AS created_at
                FROM broadcast_campaigns bc
                JOIN events e ON e.id = bc.event_id
                WHERE e.deleted_at IS NULL AND ($1::uuid IS NULL OR e.organization_id = $1)
                ORDER BY bc.created_at DESC
                "#,
            )
            .bind(org_id)
            .fetch_all(state.db.pool())
            .await?;
            let mut lines = vec!["event_title,campaign_name,message_channel,target_audience,status,successfully_sent,failed_count,created_at".to_string()];
            for row in rows {
                lines.push(vec![
                    csv_escape(&row.try_get::<String, _>("event_title")?),
                    csv_escape(row.try_get::<Option<String>, _>("campaign_name")?.as_deref().unwrap_or("")),
                    csv_escape(&row.try_get::<String, _>("message_channel")?),
                    csv_escape(&row.try_get::<String, _>("target_audience")?),
                    csv_escape(&row.try_get::<String, _>("status")?),
                    row.try_get::<i32, _>("successfully_sent")?.to_string(),
                    row.try_get::<i32, _>("failed_count")?.to_string(),
                    csv_escape(&row.try_get::<String, _>("created_at")?),
                ].join(","));
            }
            (format!("broadcasts-report-{}.csv", Utc::now().format("%Y%m%d-%H%M%S")), lines.join("\n"))
        }
        _ => {
            return Err(AppError::BadRequest(
                "Unsupported report. Use events, guests, payments, michango, or broadcasts".to_string(),
            ))
        }
    };

    Ok(Json(json!({
        "success": true,
        "data": {
            "filename": filename,
            "content": content,
        }
    })))
}
