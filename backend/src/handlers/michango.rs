use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{event::Event, user::Claims},
    repository::event_repository::EventRepository,
    services::MessagingService,
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct MichangoFilterQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePledgeRequest {
    pub guest_id: Uuid,
    pub pledged_amount: i64,
    pub payment_deadline: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecordPaymentRequest {
    pub amount_paid: i64,
    pub payment_method: Option<String>,
    pub payment_reference: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SendRemindersRequest {
    pub statuses: Option<Vec<String>>,
    pub custom_message: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PledgeResponse {
    pub id: Uuid,
    pub guest_id: Uuid,
    pub guest_name: String,
    pub guest_phone: String,
    pub pledged_amount: i64,
    pub amount_paid: i64,
    pub remaining_amount: i64,
    pub payment_status: String,
    pub payment_deadline: Option<NaiveDate>,
    pub reminder_count: i32,
    pub last_reminder_sent_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct MichangoSummaryResponse {
    pub total_pledgers: i64,
    pub total_pledged_tsh: i64,
    pub total_collected_tsh: i64,
    pub total_outstanding_tsh: i64,
    pub collection_rate_percent: i64,
    pub pending_count: i64,
    pub partial_count: i64,
    pub paid_count: i64,
    pub overdue_count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReminderDeliveryResponse {
    pub id: Uuid,
    pub pledge_id: Uuid,
    pub guest_id: Uuid,
    pub guest_name: String,
    pub guest_phone: String,
    pub channel: String,
    pub status: String,
    pub provider_message_id: Option<String>,
    pub error_message: Option<String>,
    pub message: String,
    pub delivered_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
struct ReminderRecipient {
    pledge_id: Uuid,
    guest_id: Uuid,
    phone: String,
    contact_method: String,
    full_name: String,
    pledged_amount: i64,
    amount_paid: i64,
    payment_deadline: Option<NaiveDate>,
}

async fn assert_event_ownership(
    state: &Arc<AppState>,
    event_id: Uuid,
    org_id: Uuid,
) -> AppResult<Event> {
    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;

    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }

    Ok(event)
}

fn resolve_status(pledged_amount: i64, amount_paid: i64, payment_deadline: Option<NaiveDate>) -> String {
    let today = Utc::now().date_naive();

    if amount_paid >= pledged_amount {
        return "paid".to_string();
    }

    if let Some(deadline) = payment_deadline {
        if deadline < today {
            return "overdue".to_string();
        }
    }

    if amount_paid > 0 {
        "partial".to_string()
    } else {
        "pending".to_string()
    }
}

async fn sync_overdue_statuses(state: &Arc<AppState>, event_id: Uuid) -> AppResult<()> {
    sqlx::query(
        r#"
        UPDATE pledge_tracker
        SET payment_status = CASE
            WHEN amount_paid >= pledged_amount THEN 'paid'
            WHEN payment_deadline IS NOT NULL AND payment_deadline < CURRENT_DATE THEN 'overdue'
            WHEN amount_paid > 0 THEN 'partial'
            ELSE 'pending'
        END,
        updated_at = NOW()
        WHERE event_id = $1
        "#,
    )
    .bind(event_id)
    .execute(state.db.pool())
    .await?;

    Ok(())
}

async fn guest_belongs_to_event(state: &Arc<AppState>, event_id: Uuid, guest_id: Uuid) -> AppResult<bool> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM guests WHERE id = $1 AND event_id = $2",
    )
    .bind(guest_id)
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;

    Ok(count > 0)
}

async fn fetch_pledges(state: &Arc<AppState>, event_id: Uuid, status: Option<&str>) -> AppResult<Vec<PledgeResponse>> {
    let pledges = if let Some(status) = status {
        sqlx::query_as::<_, PledgeResponse>(
            r#"
            SELECT
                pt.id,
                pt.guest_id,
                g.full_name AS guest_name,
                g.phone AS guest_phone,
                pt.pledged_amount,
                pt.amount_paid,
                GREATEST(pt.pledged_amount - pt.amount_paid, 0) AS remaining_amount,
                pt.payment_status,
                pt.payment_deadline,
                pt.reminder_count,
                pt.last_reminder_sent_at,
                pt.notes,
                pt.created_at
            FROM pledge_tracker pt
            JOIN guests g ON g.id = pt.guest_id
            WHERE pt.event_id = $1 AND pt.payment_status = $2
            ORDER BY pt.created_at DESC
            "#,
        )
        .bind(event_id)
        .bind(status)
        .fetch_all(state.db.pool())
        .await?
    } else {
        sqlx::query_as::<_, PledgeResponse>(
            r#"
            SELECT
                pt.id,
                pt.guest_id,
                g.full_name AS guest_name,
                g.phone AS guest_phone,
                pt.pledged_amount,
                pt.amount_paid,
                GREATEST(pt.pledged_amount - pt.amount_paid, 0) AS remaining_amount,
                pt.payment_status,
                pt.payment_deadline,
                pt.reminder_count,
                pt.last_reminder_sent_at,
                pt.notes,
                pt.created_at
            FROM pledge_tracker pt
            JOIN guests g ON g.id = pt.guest_id
            WHERE pt.event_id = $1
            ORDER BY pt.created_at DESC
            "#,
        )
        .bind(event_id)
        .fetch_all(state.db.pool())
        .await?
    };

    Ok(pledges)
}

pub async fn list_pledges(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Query(filter): Query<MichangoFilterQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    sync_overdue_statuses(&state, event_id).await?;

    let pledges = fetch_pledges(&state, event_id, filter.status.as_deref()).await?;

    Ok(Json(json!({
        "success": true,
        "data": pledges,
    })))
}

pub async fn get_summary(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    sync_overdue_statuses(&state, event_id).await?;

    let row = sqlx::query(
        r#"
        SELECT
            COUNT(*) AS total_pledgers,
            COALESCE(SUM(pledged_amount), 0) AS total_pledged_tsh,
            COALESCE(SUM(amount_paid), 0) AS total_collected_tsh,
            COALESCE(SUM(GREATEST(pledged_amount - amount_paid, 0)), 0) AS total_outstanding_tsh,
            COUNT(*) FILTER (WHERE payment_status = 'pending') AS pending_count,
            COUNT(*) FILTER (WHERE payment_status = 'partial') AS partial_count,
            COUNT(*) FILTER (WHERE payment_status = 'paid') AS paid_count,
            COUNT(*) FILTER (WHERE payment_status = 'overdue') AS overdue_count
        FROM pledge_tracker
        WHERE event_id = $1
        "#,
    )
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;

    let total_pledged_tsh: i64 = row.try_get("total_pledged_tsh").unwrap_or(0);
    let total_collected_tsh: i64 = row.try_get("total_collected_tsh").unwrap_or(0);
    let response = MichangoSummaryResponse {
        total_pledgers: row.try_get("total_pledgers").unwrap_or(0),
        total_pledged_tsh,
        total_collected_tsh,
        total_outstanding_tsh: row.try_get("total_outstanding_tsh").unwrap_or(0),
        collection_rate_percent: if total_pledged_tsh > 0 { (total_collected_tsh * 100) / total_pledged_tsh } else { 0 },
        pending_count: row.try_get("pending_count").unwrap_or(0),
        partial_count: row.try_get("partial_count").unwrap_or(0),
        paid_count: row.try_get("paid_count").unwrap_or(0),
        overdue_count: row.try_get("overdue_count").unwrap_or(0),
    };

    Ok(Json(json!({
        "success": true,
        "data": response,
    })))
}

pub async fn create_pledge(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<CreatePledgeRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    if payload.pledged_amount <= 0 {
        return Err(AppError::ValidationError("Pledged amount must be greater than 0".to_string()));
    }

    if !guest_belongs_to_event(&state, event_id, payload.guest_id).await? {
        return Err(AppError::GuestNotFound);
    }

    let existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pledge_tracker WHERE event_id = $1 AND guest_id = $2",
    )
    .bind(event_id)
    .bind(payload.guest_id)
    .fetch_one(state.db.pool())
    .await?;

    if existing > 0 {
        return Err(AppError::Conflict("Pledge already exists for this guest".to_string()));
    }

    let deadline = payload
        .payment_deadline
        .as_deref()
        .map(|value| NaiveDate::parse_from_str(value, "%Y-%m-%d"))
        .transpose()
        .map_err(|_| AppError::ValidationError("Invalid payment_deadline format".to_string()))?;

    let status = resolve_status(payload.pledged_amount, 0, deadline);
    let now = Utc::now();
    let pledge_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO pledge_tracker (
            id, event_id, guest_id, pledged_amount, amount_paid, payment_status,
            payment_deadline, reminder_count, notes, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, 0, $5, $6, 0, $7, $8, $8)
        "#,
    )
    .bind(pledge_id)
    .bind(event_id)
    .bind(payload.guest_id)
    .bind(payload.pledged_amount)
    .bind(&status)
    .bind(deadline)
    .bind(payload.notes)
    .bind(now)
    .execute(state.db.pool())
    .await?;

    let pledge = fetch_pledges(&state, event_id, None)
        .await?
        .into_iter()
        .find(|item| item.id == pledge_id)
        .ok_or(AppError::InternalServerError)?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": pledge,
        })),
    ))
}

pub async fn record_payment(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, pledge_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<RecordPaymentRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    if payload.amount_paid <= 0 {
        return Err(AppError::ValidationError("Payment amount must be greater than 0".to_string()));
    }

    let row = sqlx::query(
        r#"
        SELECT pledged_amount, amount_paid, payment_deadline
        FROM pledge_tracker
        WHERE id = $1 AND event_id = $2
        "#,
    )
    .bind(pledge_id)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Pledge not found".to_string()))?;

    let pledged_amount: i64 = row.try_get("pledged_amount").unwrap_or(0);
    let current_paid: i64 = row.try_get("amount_paid").unwrap_or(0);
    let payment_deadline: Option<NaiveDate> = row.try_get("payment_deadline").ok();
    let new_amount_paid = current_paid + payload.amount_paid;
    let status = resolve_status(pledged_amount, new_amount_paid, payment_deadline);
    let notes = payload.notes.unwrap_or_else(|| {
        let method = payload.payment_method.unwrap_or_else(|| "manual".to_string());
        match payload.payment_reference {
            Some(reference) if !reference.is_empty() => format!("Payment via {} ({})", method, reference),
            _ => format!("Payment via {}", method),
        }
    });

    sqlx::query(
        r#"
        UPDATE pledge_tracker
        SET amount_paid = $3,
            payment_status = $4,
            notes = CASE
                WHEN notes IS NULL OR notes = '' THEN $5
                ELSE notes || E'\n' || $5
            END,
            updated_at = NOW()
        WHERE id = $1 AND event_id = $2
        "#,
    )
    .bind(pledge_id)
    .bind(event_id)
    .bind(new_amount_paid)
    .bind(status)
    .bind(notes)
    .execute(state.db.pool())
    .await?;

    Ok(Json(json!({
        "success": true,
        "message": "Payment recorded successfully",
    })))
}

pub async fn list_reminder_deliveries(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let deliveries = sqlx::query_as::<_, ReminderDeliveryResponse>(
        r#"
        SELECT
            rd.id,
            rd.pledge_id,
            rd.guest_id,
            g.full_name AS guest_name,
            g.phone AS guest_phone,
            rd.channel,
            rd.status,
            rd.provider_message_id,
            rd.error_message,
            rd.message,
            rd.delivered_at
        FROM reminder_deliveries rd
        JOIN guests g ON g.id = rd.guest_id
        WHERE rd.event_id = $1
        ORDER BY rd.delivered_at DESC, g.full_name ASC
        LIMIT 100
        "#,
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": deliveries,
    })))
}

pub async fn send_reminders(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<SendRemindersRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    sync_overdue_statuses(&state, event_id).await?;

    let custom_message = payload.custom_message.clone();
    let statuses = payload.statuses.unwrap_or_else(|| vec![
        "pending".to_string(),
        "partial".to_string(),
        "overdue".to_string(),
    ]);

    let recipients = sqlx::query_as::<_, ReminderRecipient>(
        r#"
        SELECT
            pt.id AS pledge_id,
            g.id AS guest_id,
            g.phone,
            g.contact_method,
            g.full_name,
            pt.pledged_amount,
            pt.amount_paid,
            pt.payment_deadline
        FROM pledge_tracker pt
        JOIN guests g ON g.id = pt.guest_id
        WHERE pt.event_id = $1 AND pt.payment_status = ANY($2)
        ORDER BY g.full_name ASC
        "#,
    )
    .bind(event_id)
    .bind(&statuses)
    .fetch_all(state.db.pool())
    .await?;

    let messaging = MessagingService::new();
    let mut sent = 0_i64;
    let mut failed = 0_i64;

    for recipient in recipients {
        let outstanding = (recipient.pledged_amount - recipient.amount_paid).max(0);
        let default_message = match recipient.payment_deadline {
            Some(deadline) => format!(
                "Hello {}, this is a RoyalEntry michango reminder. Outstanding amount: TZS {}. Payment deadline: {}.",
                recipient.full_name, outstanding, deadline
            ),
            None => format!(
                "Hello {}, this is a RoyalEntry michango reminder. Outstanding amount: TZS {}.",
                recipient.full_name, outstanding
            ),
        };
        let message = custom_message.clone().unwrap_or(default_message);
        let channel = match recipient.contact_method.as_str() {
            "sms" => "sms",
            "whatsapp" => "whatsapp",
            _ => "whatsapp",
        };

        let attempts = messaging.send(channel, &recipient.phone, &message).await?;
        let success = attempts.iter().any(|attempt| attempt.success);

        for attempt in attempts {
            sqlx::query(
                r#"
                INSERT INTO reminder_deliveries (
                    id, event_id, pledge_id, guest_id, channel, status,
                    provider_message_id, error_message, message, delivered_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(event_id)
            .bind(recipient.pledge_id)
            .bind(recipient.guest_id)
            .bind(&attempt.channel)
            .bind(if attempt.success { "sent" } else { "failed" })
            .bind(attempt.provider_message_id)
            .bind(attempt.error_message)
            .bind(&message)
            .execute(state.db.pool())
            .await?;
        }

        if success {
            sent += 1;
            sqlx::query(
                r#"
                UPDATE pledge_tracker
                SET reminder_count = reminder_count + 1,
                    last_reminder_sent_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                "#,
            )
            .bind(recipient.pledge_id)
            .execute(state.db.pool())
            .await?;
        } else {
            failed += 1;
        }
    }

    let message = custom_message.unwrap_or_else(|| "Michango reminders processed".to_string());

    Ok(Json(json!({
        "success": true,
        "data": {
            "sent": sent,
            "failed": failed,
            "message": message,
        }
    })))
}
