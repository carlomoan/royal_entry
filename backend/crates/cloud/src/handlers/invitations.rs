// ==============================================================================
// FILE: crates/cloud/src/handlers/invitations.rs
// ==============================================================================
use crate::{
    cards::renderer::{parse_theme_config, render_card},
    error::{AppError, AppResult},
    models::{
        event::Event,
        guest::Guest,
        invitation::{
            GenerateInvitationsRequest, GenerateInvitationsResult, Invitation, InvitationResponse,
        },
        user::Claims,
    },
    qr::render::render_qr_png,
    repository::event_repository::EventRepository,
    services::MessagingService,
    AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use uuid::Uuid;

/// Suggested pledge range per guest category (mirrors the frontend defaults).
fn pledge_range_for(category: Option<&str>) -> &'static str {
    match category {
        Some("VVIP") => "TZS 200,000 – 500,000",
        Some("Platinum") => "TZS 250,000 – 500,000",
        Some("Gold") => "TZS 150,000 – 300,000",
        Some("VIP") => "TZS 100,000 – 250,000",
        Some("Silver") => "TZS 100,000 – 200,000",
        Some("Premium") => "TZS 75,000 – 150,000",
        Some("Regular") | Some("Normal") => "TZS 50,000 – 100,000",
        _ => "TZS 50,000 – 250,000",
    }
}

/// Ensure a guest has an invitation (check-in link / QR token). Creates one if
/// missing, so every guest always has a link to generate their QR/entry token.
pub async fn ensure_invitation(
    pool: &PgPool,
    guest_id: Uuid,
) -> AppResult<Invitation> {
    if let Some(existing) = sqlx::query_as::<_, Invitation>(
        "SELECT * FROM invitations WHERE guest_id = $1",
    )
    .bind(guest_id)
    .fetch_optional(pool)
    .await?
    {
        return Ok(existing);
    }

    let invitation = sqlx::query_as::<_, Invitation>(
        r#"INSERT INTO invitations (id, guest_id, short_link, status, scan_count, invitation_sent_at, created_at) VALUES ($1, $2, $3, 'sent', 0, $4, $4) RETURNING *"#,
    )
    .bind(Uuid::new_v4())
    .bind(guest_id)
    .bind(format!("inv-{}", Uuid::new_v4().simple()))
    .bind(Utc::now())
    .fetch_one(pool)
    .await?;
    Ok(invitation)
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

async fn list_event_guests(pool: &PgPool, event_id: Uuid) -> AppResult<Vec<Guest>> {
    let guests = sqlx::query_as::<_, Guest>(
        "SELECT * FROM guests WHERE event_id = $1 ORDER BY full_name ASC",
    )
    .bind(event_id)
    .fetch_all(pool)
    .await?;

    Ok(guests)
}

#[derive(Debug, Deserialize)]
pub struct SendInvitationsRequest {
    pub guest_ids: Option<Vec<Uuid>>,
    pub channel: Option<String>,
    pub template_id: Option<Uuid>,
    pub custom_message: Option<String>,
}

pub async fn list_invitations(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let invitations = sqlx::query_as::<_, Invitation>(
        r#"SELECT i.* FROM invitations i JOIN guests g ON g.id = i.guest_id WHERE g.event_id = $1 ORDER BY i.created_at DESC"#,
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;

    let frontend_url = state.config.app.frontend_url.clone();
    let data: Vec<InvitationResponse> = invitations
        .into_iter()
        .map(|invitation| InvitationResponse::from_invitation(invitation, &frontend_url, event_id))
        .collect();

    Ok(Json(json!({ "success": true, "data": data })))
}

pub async fn generate_invitations(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    // Optional body: the UI may POST without a payload (no Content-Type), which
    // would otherwise be rejected with 415 by the Json extractor.
    payload: Option<Json<GenerateInvitationsRequest>>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let payload = payload.map(|p| p.0).unwrap_or(GenerateInvitationsRequest {
        overwrite: None,
        guest_ids: None,
    });

    let all_guests = list_event_guests(state.db.pool(), event_id).await?;

    let guests: Vec<Guest> = match payload.guest_ids {
        Some(ids) if !ids.is_empty() => all_guests
            .into_iter()
            .filter(|guest| ids.contains(&guest.id))
            .collect(),
        _ => all_guests,
    };

    let overwrite = payload.overwrite.unwrap_or(false);

    if guests.is_empty() {
        return Ok((
            StatusCode::OK,
            Json(json!({
                "success": true,
                "data": GenerateInvitationsResult { generated: 0, skipped: 0, failed: 0, invitations: Vec::new() }
            })),
        ));
    }

    let mut tx = state.db.pool().begin().await?;
    let now = Utc::now();
    let mut generated = 0_i64;
    let mut skipped = 0_i64;
    let failed = 0_i64;
    let mut results = Vec::new();

    for guest in guests {
        let existing =
            sqlx::query_as::<_, Invitation>("SELECT * FROM invitations WHERE guest_id = $1")
                .bind(guest.id)
                .fetch_optional(&mut *tx)
                .await?;

        if let Some(existing) = existing {
            if !overwrite {
                skipped += 1;
                results.push(InvitationResponse::from_invitation(
                    existing,
                    &state.config.app.frontend_url,
                    event_id,
                ));
                continue;
            }
        }

        let invitation = sqlx::query_as::<_, Invitation>(
            r#"INSERT INTO invitations (id, guest_id, short_link, status, scan_count, invitation_sent_at, created_at) VALUES ($1, $2, $3, 'sent', 0, $4, $4) RETURNING *"#,
        )
        .bind(Uuid::new_v4())
        .bind(guest.id)
        .bind(format!("inv-{}", Uuid::new_v4().simple()))
        .bind(now)
        .fetch_one(&mut *tx)
        .await?;

        generated += 1;
        results.push(InvitationResponse::from_invitation(
            invitation,
            &state.config.app.frontend_url,
            event_id,
        ));
    }

    tx.commit().await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": GenerateInvitationsResult { generated, skipped, failed, invitations: results }
        })),
    ))
}

/// Send invitations with personalized card rendering
pub async fn send_invitations(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<SendInvitationsRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)?;
    let event = assert_event_ownership(&state, event_id, org_id).await?;

    let all_guests = list_event_guests(state.db.pool(), event_id).await?;

    let guests: Vec<Guest> = match payload.guest_ids {
        Some(ids) if !ids.is_empty() => all_guests
            .into_iter()
            .filter(|guest| ids.contains(&guest.id))
            .collect(),
        _ => all_guests,
    };

    if guests.is_empty() {
        return Err(AppError::BadRequest("No guests to invite".to_string()));
    }

    // Fetch the event's invitation card template (explicit, event-assigned, or
    // the org's most recent active template as a fallback).
    let template_data = if let Some(template_id) = payload.template_id {
        sqlx::query("SELECT theme_config, background_file_id FROM card_templates WHERE id = $1")
            .bind(template_id)
            .fetch_optional(state.db.pool())
            .await?
    } else if let Some(template_id) = event.card_template_id {
        sqlx::query("SELECT theme_config, background_file_id FROM card_templates WHERE id = $1")
            .bind(template_id)
            .fetch_optional(state.db.pool())
            .await?
    } else {
        // Try to get the most recent active template for this org
        sqlx::query("SELECT theme_config, background_file_id FROM card_templates WHERE org_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1")
            .bind(org_id)
            .fetch_optional(state.db.pool())
            .await?
    };

    let frontend_url = state.config.app.frontend_url.clone();
    let messaging = MessagingService::new();
    let mut sent = 0_i64;
    let mut failed = 0_i64;
    let mut errors = Vec::new();

    for guest in &guests {
        // Every guest must have a check-in link — auto-generate if missing.
        let invitation =
            match sqlx::query_as::<_, Invitation>("SELECT * FROM invitations WHERE guest_id = $1")
                .bind(guest.id)
                .fetch_optional(state.db.pool())
                .await?
            {
                Some(inv) => inv,
                None => ensure_invitation(state.db.pool(), guest.id).await?,
            };

        // The guest-facing link goes to their public invitation page (card + QR),
        // not the scanner.
        let check_in_link = crate::models::invitation::build_public_invitation_url(
            &frontend_url,
            &invitation.short_link,
        );

        // Determine channel
        let device_type = guest.device_type.as_str();
        let channel = payload.channel.as_deref().unwrap_or_else(|| {
            if device_type == "feature_phone" {
                "sms"
            } else {
                guest.contact_method.as_str()
            }
        });

        // Generate QR code
        let qr_png = render_qr_png(&check_in_link).unwrap_or_default();

        // Build render data
        let mut render_data = std::collections::HashMap::new();
        render_data.insert("EVENT_TITLE".to_string(), event.title.clone());
        render_data.insert(
            "EVENT_DATE".to_string(),
            event.event_date.format("%A, %d %B %Y").to_string(),
        );
        render_data.insert(
            "EVENT_START_TIME".to_string(),
            event.event_time.clone().unwrap_or_default(),
        );
        render_data.insert(
            "EVENT_VENUE".to_string(),
            event.venue_name.clone().unwrap_or_default(),
        );
        render_data.insert(
            "EVENT_ADDRESS".to_string(),
            event.venue_address.clone().unwrap_or_default(),
        );
        render_data.insert(
            "EVENT_CHARACTERS".to_string(),
            event.main_characters.clone().unwrap_or_default(),
        );
        render_data.insert("GUEST_NAME".to_string(), guest.full_name.clone());
        render_data.insert(
            "GUEST_CATEGORY".to_string(),
            guest.guest_category.clone().unwrap_or_default(),
        );
        render_data.insert(
            "GUEST_TABLE".to_string(),
            guest.table_number.clone().unwrap_or_default(),
        );

        // Render personalized card if template exists
        let card_png = if let Some(ref template_row) = template_data {
            let theme_config_json: serde_json::Value =
                template_row.try_get("theme_config").unwrap_or(json!({}));
            let background_file_id: Option<String> =
                template_row.try_get("background_file_id").ok().flatten();

            if let Ok(theme_config) = parse_theme_config(&theme_config_json) {
                // Load background image if available
                let background_bytes = if let Some(ref file_id) = background_file_id {
                    sqlx::query("SELECT path FROM files WHERE id = $1")
                        .bind(file_id)
                        .fetch_optional(state.db.pool())
                        .await
                        .ok()
                        .flatten()
                        .and_then(|row| row.try_get::<String, _>("path").ok())
                        .and_then(|path| std::fs::read(path).ok())
                } else {
                    None
                };

                render_card(
                    &theme_config,
                    background_bytes.as_deref(),
                    &qr_png,
                    &render_data,
                )
                .ok()
            } else {
                None
            }
        } else {
            None
        };

        // Build message with event details + suggested pledge range.
        let pledge_range = pledge_range_for(guest.guest_category.as_deref());
        let message_body = if channel == "whatsapp" || channel == "email" {
            format!(
                "Dear {name},\n\nYou are cordially invited to {title} on {date} at {venue}.\n\nWe welcome your pledge (contribution) of {range} to support this event.\n\nYour personalized invitation card is attached. Show the QR code at the event entrance for check-in.\n\nCheck-in link: {link}\n\nRoyalEntry",
                name = guest.full_name,
                title = event.title,
                date = event.event_date.format("%B %d, %Y"),
                venue = event.venue_name.as_deref().unwrap_or("the venue"),
                range = pledge_range,
                link = check_in_link,
            )
        } else {
            let human_code =
                crate::models::invitation::generate_human_friendly_code(&invitation.id);
            format!(
                "Dear {name},\n\nYou are invited to {title} on {date} at {venue}.\n\nPledge (contribution): {range}\n\nYour check-in code: {code}\nShow this code at the entrance.\n\nRoyalEntry",
                name = guest.full_name,
                title = event.title,
                date = event.event_date.format("%B %d, %Y"),
                venue = event.venue_name.as_deref().unwrap_or("the venue"),
                range = pledge_range,
                code = human_code,
            )
        };

        let destination = if channel == "email" {
            guest.email.as_deref().ok_or_else(|| {
                AppError::BadRequest(format!("{} has no email address", guest.full_name))
            })?
        } else {
            &guest.phone
        };

        // Email: rich HTML from the invitation template + card attached.
        // SMS/WhatsApp: plain text (no attachment).
        let attempts = if channel == "email" {
            let subject = format!("You're Invited to {}", event.title);
            let html = crate::services::TemplateService::new(state.clone())
                .render_template(
                    "guest_invitation",
                    json!({
                        "guest_name": guest.full_name,
                        "event_title": event.title,
                        "event_date": event.event_date.format("%A, %d %B %Y").to_string(),
                        "event_time": event.event_time.clone().unwrap_or_default(),
                        "venue": event.venue_name.clone().unwrap_or_default(),
                        "venue_address": event.venue_address.clone().unwrap_or_default(),
                        "check_in_link": check_in_link,
                        "organization_name": "RoyalEntry",
                    }),
                )
                .await
                .unwrap_or_else(|_| {
                    format!(
                        "<p>Dear {}, you are invited to {} on {} at {}.</p>",
                        guest.full_name,
                        event.title,
                        event.event_date.format("%A, %d %B %Y"),
                        event.venue_name.clone().unwrap_or_default(),
                    )
                });
            let html = format!(
                "{html}<p style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;color:#334e68;'>We welcome your pledge (contribution) of <strong>{pledge_range}</strong> to support this event.</p>"
            );
            let receipt = state
                .channels
                .email_card(&destination, &subject, &html, card_png.as_deref())
                .await;
            vec![match receipt {
                Ok(r) => crate::services::messaging::DeliveryAttempt {
                    channel: "email".to_string(),
                    success: r.success,
                    provider_message_id: r.provider_id,
                    error_message: r.error,
                },
                Err(e) => crate::services::messaging::DeliveryAttempt {
                    channel: "email".to_string(),
                    success: false,
                    provider_message_id: None,
                    error_message: Some(e.to_string()),
                },
            }]
        } else {
            messaging.send(channel, destination, &message_body).await?
        };

        let ok = attempts.iter().any(|a| a.success);

        if ok {
            sent += 1;
            sqlx::query(
                "UPDATE invitations SET status = 'sent', invitation_sent_at = NOW() WHERE id = $1",
            )
            .bind(invitation.id)
            .execute(state.db.pool())
            .await?;
        } else {
            failed += 1;
            errors.push(format!("{}: delivery failed", guest.full_name));
            // Surface the provider error (e.g. SMTP auth) in the backend log.
            for attempt in &attempts {
                if let Some(e) = &attempt.error_message {
                    tracing::warn!(
                        guest_id = %guest.id,
                        channel = %attempt.channel,
                        error = %e,
                        "Invitation delivery failed"
                    );
                }
            }
        }
    }

    sqlx::query("UPDATE events SET invitation_sent_at = NOW(), updated_at = NOW() WHERE id = $1")
        .bind(event_id)
        .execute(state.db.pool())
        .await?;

    // Notify the event's organization about the send result.
    let notif_body = format!("Sent to {} guest(s), {} failed", sent, failed);
    let _ = crate::services::NotificationService::create_org(
        state.db.pool(),
        event.organization_id,
        "invitation.sent",
        "Invitations sent",
        Some(&notif_body),
        Some(&format!("/events/{event_id}")),
        Some(serde_json::json!({"event_id": event_id, "sent": sent, "failed": failed})),
    )
    .await;

    Ok(Json(json!({
        "success": true,
        "data": { "sent": sent, "failed": failed, "errors": errors }
    })))
}
