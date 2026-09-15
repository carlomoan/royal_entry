// src/handlers/event.rs
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension, Json,
};
use sqlx::Row;
use std::sync::Arc;
use serde_json::json;
use validator::Validate;
use crate::models::{PaginationMeta, PaginationQuery};
use crate::models::event::{UpdateEventRequest, RejectEventRequest};
use crate::{AppState, AppError, AppResult};
use crate::models::{Claims, CreateEventRequest, ActivateEventRequest, EventResponse};
use crate::repository::EventRepository;
use crate::services::{PdfService, MessagingService};
use handlebars::Handlebars;
use uuid::Uuid;

pub async fn create_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateEventRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    payload.validate().map_err(|e| AppError::ValidationError(e.to_string()))?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?;
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;

    // Enforce package event limit
    if !crate::utils::rbac::is_platform_role(&claims.role) {
        crate::services::UsageService::new(state.clone())
            .enforce_event_limit(org_id)
            .await?;
    }

    let event = EventRepository::create(state.db.pool(), org_id, user_id, &payload).await?;
    Ok((StatusCode::CREATED, Json(json!({ "success": true, "data": EventResponse::from(event) }))))
}

pub async fn list_events(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Query(pagination): Query<PaginationQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let limit = pagination.limit();
    let offset = pagination.offset();
    let page = pagination.page.unwrap_or(1);
    let per_page = pagination.per_page.unwrap_or(20);

    let (events, total) = EventRepository::list_by_organization(state.db.pool(), org_id, limit, offset).await?;
    let event_responses: Vec<EventResponse> = events.into_iter().map(EventResponse::from).collect();
    Ok(Json(json!({ "success": true, "data": event_responses, "pagination": PaginationMeta::new(page, per_page, total) })))
}

pub async fn get_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = EventRepository::get_by_id(state.db.pool(), event_id).await?.ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id { return Err(AppError::Forbidden); }
    Ok(Json(json!({ "success": true, "data": EventResponse::from(event) })))
}

pub async fn update_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<UpdateEventRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = EventRepository::get_by_id(state.db.pool(), event_id).await?.ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id { return Err(AppError::Forbidden); }
    if event.status == "active" || event.status == "completed" {
        return Err(AppError::BadRequest("Cannot update an active or completed event".to_string()));
    }
    let updated = EventRepository::update(state.db.pool(), event_id, &payload).await?;
    Ok(Json(json!({ "success": true, "data": EventResponse::from(updated) })))
}

pub async fn activate_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<ActivateEventRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = EventRepository::get_by_id(state.db.pool(), event_id).await?.ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id { return Err(AppError::Forbidden); }
    if event.approval_status != "approved" { return Err(AppError::BadRequest("Event must be approved before activation".to_string())); }
    if event.status == "active" { return Err(AppError::Conflict("Event is already active".to_string())); }

    let activated = EventRepository::activate(state.db.pool(), event_id, payload.entry_start_time, payload.entry_end_time).await?;
    Ok(Json(json!({ "success": true, "data": EventResponse::from(activated), "message": "Event activated successfully" })))
}

pub async fn delete_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = EventRepository::get_by_id(state.db.pool(), event_id).await?.ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id { return Err(AppError::Forbidden); }
    if event.status == "active" { return Err(AppError::BadRequest("Cannot delete an active event. Complete it first.".to_string())); }

    EventRepository::delete(state.db.pool(), event_id).await?;
    Ok((StatusCode::OK, Json(json!({ "success": true, "message": "Event deleted successfully" }))))
}

pub async fn get_event_summary(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = EventRepository::get_by_id(state.db.pool(), event_id).await?.ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id { return Err(AppError::Forbidden); }

    let row = sqlx::query(
        r#"
        SELECT
            COUNT(DISTINCT g.id) as total_guests,
            COUNT(DISTINCT es.guest_id) as guests_arrived,
            COUNT(DISTINCT CASE WHEN r.response = 'confirmed' THEN g.id END) as rsvp_confirmed,
            COUNT(DISTINCT CASE WHEN r.response = 'declined' THEN g.id END) as rsvp_declined,
            COUNT(DISTINCT CASE WHEN i.status = 'sent' THEN g.id END) as invitations_sent,
            COALESCE(SUM(CASE WHEN pt.payment_status = 'paid' THEN pt.amount_paid ELSE 0 END), 0) as michango_collected
        FROM events e
        LEFT JOIN guests g ON e.id = g.event_id
        LEFT JOIN invitations i ON g.id = i.guest_id
        LEFT JOIN rsvp_responses r ON g.id = r.guest_id AND e.id = r.event_id
        LEFT JOIN pledge_tracker pt ON e.id = pt.event_id AND g.id = pt.guest_id
        LEFT JOIN entry_scans es ON e.id = es.event_id AND g.id = es.guest_id
        WHERE e.id = $1
        "#,
    ).bind(event_id).fetch_one(state.db.pool()).await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "event": EventResponse::from(event),
            "summary": {
                "total_guests": row.try_get::<i64, _>("total_guests").unwrap_or(0),
                "guests_arrived": row.try_get::<i64, _>("guests_arrived").unwrap_or(0),
                "rsvp_confirmed": row.try_get::<i64, _>("rsvp_confirmed").unwrap_or(0),
                "rsvp_declined": row.try_get::<i64, _>("rsvp_declined").unwrap_or(0),
                "invitations_sent": row.try_get::<i64, _>("invitations_sent").unwrap_or(0),
                "michango_collected_tsh": row.try_get::<i64, _>("michango_collected").unwrap_or(0)
            }
        }
    })))
}

pub async fn approve_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = EventRepository::get_by_id(state.db.pool(), event_id).await?.ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id { return Err(AppError::Forbidden); }
    if event.approval_status == "approved" { return Err(AppError::Conflict("Event is already approved".to_string())); }

    let approver_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?;
    let approved = sqlx::query_as::<_, crate::models::event::Event>(
        r#"UPDATE events SET approval_status = 'approved', status = 'approved', approved_by_user_id = $2, approved_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *"#,
    ).bind(event_id).bind(approver_id).fetch_one(state.db.pool()).await?;

    Ok(Json(json!({ "success": true, "data": EventResponse::from(approved), "message": "Event approved successfully" })))

    let n = crate::services::NotificationService::new(state.clone());
    n.push(
        Some(org_id), None,
        if approved { "event.approved" } else { "event.rejected" },
        &format!("Event {}: {}", if approved { "approved" } else { "rejected" }, event.title),
        None,
        Some(&format!("/events/{}", event_id)),
    ).await;
}

pub async fn reject_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    payload: Option<Json<RejectEventRequest>>, // ✅ FIXED
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id { return Err(AppError::Forbidden); }
    if event.approval_status == "rejected" { return Err(AppError::Conflict("Event is already rejected".to_string())); }

    let approver_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)?;
    let rejection_reason = payload.as_ref().and_then(|p| p.reason.clone()).unwrap_or_else(|| "No reason provided".to_string());

    let rejected = sqlx::query_as::<_, crate::models::event::Event>(
        r#"UPDATE events SET approval_status = 'rejected', status = 'cancelled', approved_by_user_id = $2, approved_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *"#,
    ).bind(event_id).bind(approver_id).fetch_one(state.db.pool()).await?;

    Ok(Json(json!({ "success": true, "data": EventResponse::from(rejected), "message": format!("Event rejected: {}", rejection_reason) })))
}

pub async fn complete_event(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id { return Err(AppError::Forbidden); }
    if event.status != "active" {
        return Err(AppError::BadRequest("Only active events can be completed".to_string()));
    }

    let completed = sqlx::query_as::<_, crate::models::event::Event>(
        r#"UPDATE events SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING *"#,
    )
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;

    // ── Send thank-you messages to checked-in guests ───────────────────────────
    let thank_you_template = event.thank_you_message_template.as_deref();
    let default_template = "Thank you {{guest_name}} for attending {{event_title}}! We hope you had a great time. - {{organization_name}}";
    let template_str = thank_you_template.unwrap_or(default_template);

    // Fetch org name for default template
    let org_name: String = sqlx::query_scalar(
        "SELECT display_name FROM organizations WHERE id = $1",
    )
    .bind(org_id)
    .fetch_one(state.db.pool())
    .await?;

    // Get all checked-in guests with their phone and contact_method
    #[derive(sqlx::FromRow)]
    struct CheckedInGuest {
        id: Uuid,
        full_name: String,
        phone: String,
        contact_method: String,
    }

    let checked_in_guests = sqlx::query_as::<_, CheckedInGuest>(
        r#"
        SELECT DISTINCT g.id, g.full_name, g.phone, g.contact_method
        FROM guests g
        JOIN entry_scans es ON es.guest_id = g.id AND es.event_id = g.event_id
        WHERE g.event_id = $1
        "#,
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;

    let messaging = MessagingService::new();
    let mut hbs = Handlebars::new();
    hbs.set_strict_mode(false);

    for guest in &checked_in_guests {
        let mut hb = Handlebars::new();
        hb.set_strict_mode(false);
        let vars = serde_json::json!({
            "guest_name": &guest.full_name,
            "event_title": &event.title,
            "organization_name": &org_name,
        });

        let message = match hb.render_template(template_str, &vars) {
            Ok(m) => m,
            Err(e) => {
                tracing::warn!(guest_id = %guest.id, error = %e, "Failed to render thank-you template");
                // Fall back to default with replacements
                default_template
                    .replace("{{guest_name}}", &guest.full_name)
                    .replace("{{event_title}}", &event.title)
                    .replace("{{organization_name}}", &org_name)
            }
        };

        let channel = if guest.contact_method == "sms" || guest.contact_method == "both" {
            "sms"
        } else {
            "whatsapp"
        };

        if let Err(e) = messaging.send(channel, &guest.phone, &message).await {
            tracing::warn!(
                guest_id = %guest.id,
                error = %e,
                "Failed to send thank-you message to guest"
            );
        }
    }

    tracing::info!(
        event_id = %event_id,
        thank_yous_sent = checked_in_guests.len(),
        "Event completed and thank-you messages sent"
    );

    Ok(Json(json!({
        "success": true,
        "data": EventResponse::from(completed),
        "message": format!("Event completed. Thank-you messages sent to {} guests.", checked_in_guests.len())
    })))
}

pub async fn download_event_report(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<(StatusCode, [(String, String); 2], Vec<u8>)> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id { return Err(AppError::Forbidden); }

    let pdf_service = PdfService::new(state.clone());
    let pdf_bytes = pdf_service.generate_event_report(event_id).await?;

    let filename = format!("report-{}.pdf", event.title.replace(' ', "_"));
    let headers = [
        ("Content-Type".to_string(), "application/pdf".to_string()),
        (
            "Content-Disposition".to_string(),
            format!(r#"attachment; filename="{}""#, filename),
        ),
    ];

    Ok((StatusCode::OK, headers, pdf_bytes))
}

pub async fn send_save_the_date(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id { return Err(AppError::Forbidden); }
    if event.status != "draft" && event.status != "approved" {
        return Err(AppError::BadRequest(
            "Save-the-date can only be sent for draft or approved events".to_string(),
        ));
    }
    if event.save_the_date_sent_at.is_some() {
        return Err(AppError::Conflict(
            "Save-the-date has already been sent for this event".to_string(),
        ));
    }

    // Verify guests have fully paid pledges before issuing save-the-date / check-in cards
    let unpaid_or_partial: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM pledge_tracker pt JOIN guests g ON g.id = pt.guest_id WHERE pt.event_id = $1 AND pt.payment_status NOT IN ('paid')"#,
    )
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;

    if unpaid_or_partial > 0 {
        return Err(AppError::BadRequest(
            "Save-the-date can only be sent when all guests have fully paid their pledges. Some guests still have unpaid or partial pledges.".to_string(),
        ));
    }

    // Mark save-the-date as sent
    let updated = sqlx::query_as::<_, crate::models::event::Event>(
        r#"UPDATE events SET save_the_date_sent_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *"#,
    )
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;

    tracing::info!(event_id = %event_id, "Save-the-date sent");

    Ok(Json(json!({
        "success": true,
        "data": EventResponse::from(updated),
        "message": "Save-the-date sent successfully"
    })))
}
