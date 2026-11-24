// ==============================================================================
// FILE: crates/cloud/src/services/reminders.rs
// ==============================================================================
// Automatic pledge reminders: 14, 7, 3 and 1 days before the deadline, on the
// deadline morning, and one overdue notice the next day. Sent between 09:00
// and 18:00 Tanzania time (EAT, UTC+3), stopped once the guest has paid.
// ==============================================================================
use chrono::{DateTime, Duration, Timelike, Utc};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use crate::{error::AppResult, AppState};

const STAGES: &[(&str, i64)] = &[
    ("d14", 14),
    ("d7", 7),
    ("d3", 3),
    ("d1", 1),
    ("deadline", 0),
    ("overdue", -1),
];

/// Run one reminder pass. Safe to call repeatedly (idempotent per stage).
pub async fn process_automatic_reminders(state: &Arc<AppState>) -> AppResult<u64> {
    let now = Utc::now();
    // Tanzania is UTC+3; only send during 09:00–18:00 local time.
    let local_hour = (now.hour() + 3) % 24;
    if local_hour < 9 || local_hour >= 18 {
        return Ok(0);
    }

    let rows = sqlx::query(
        r#"
        SELECT pt.id AS pledge_id, pt.guest_id, pt.event_id, pt.pledged_amount,
               pt.amount_paid, pt.payment_deadline::TIMESTAMPTZ AS deadline_at,
               pt.reminder_stages, e.organization_id AS org_id,
               g.full_name, g.phone, g.email, g.contact_method
        FROM pledge_tracker pt
        JOIN guests g ON g.id = pt.guest_id
        JOIN events e ON e.id = pt.event_id
        WHERE pt.payment_deadline IS NOT NULL
          AND pt.amount_paid < pt.pledged_amount
        "#,
    )
    .fetch_all(&*state.db.pool())
    .await?;

    let mut sent = 0u64;
    for row in rows {
        let deadline: DateTime<Utc> = match row.try_get("deadline_at") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let stages: Vec<String> = row.try_get("reminder_stages").unwrap_or_default();
        let pledged: i64 = row.try_get("pledged_amount").unwrap_or(0);
        let paid: i64 = row.try_get("amount_paid").unwrap_or(0);
        let outstanding = (pledged - paid).max(0);
        let guest_id: uuid::Uuid = match row.try_get("guest_id") { Ok(v) => v, Err(_) => continue };
        let pledge_id: uuid::Uuid = match row.try_get("pledge_id") { Ok(v) => v, Err(_) => continue };
        let event_id: uuid::Uuid = match row.try_get("event_id") { Ok(v) => v, Err(_) => continue };
        let name: String = row.try_get("full_name").unwrap_or_default();
        let phone: String = row.try_get("phone").unwrap_or_default();
        let email: Option<String> = row.try_get("email").ok();
        let contact: String = row.try_get("contact_method").unwrap_or_else(|_| "sms".to_string());
        let org_id: uuid::Uuid = row.try_get("org_id").unwrap_or_default();

        for (stage, days_before) in STAGES {
            if stages.iter().any(|s| s == stage) {
                continue;
            }
            let due_at = deadline - Duration::days(*days_before);
            // Stage is due once its moment has passed. Deadline/overdue use the
            // morning window; earlier stages fire any time inside 09–18.
            if now < due_at {
                continue;
            }
            // Don't send the overdue notice before the deadline has passed.
            if *stage == "overdue" && now < deadline + Duration::days(1) {
                continue;
            }

            let deadline_text = deadline.format("%d/%m saa %H:%M").to_string();
            let mut text = format!(
                "Ndugu {}, mchango wako umebaki TZS {}. Mwisho: {}.",
                name,
                outstanding,
                deadline_text
            );
            // Fetch payment instructions (e.g. lipa number) from the event.
            let pay: Option<String> = sqlx::query_scalar(
                "SELECT payment_instructions FROM events WHERE id = $1",
            )
            .bind(event_id)
            .fetch_optional(&*state.db.pool())
            .await
            .ok()
            .flatten();
            if let Some(pay) = pay.filter(|p| !p.trim().is_empty()) {
                text.push(' ');
                text.push_str(pay.trim());
            }
            if text.chars().count() > 160 {
                text = text.chars().take(157).collect::<String>() + "...";
            }

            let delivered = if contact == "email" {
                if let Some(to) = email.as_deref().filter(|e| !e.trim().is_empty()) {
                    let subject = format!("Pledge reminder — TZS {} outstanding", outstanding);
                    let html = crate::services::TemplateService::new(state.clone())
                        .render_template(
                            "pledge_reminder",
                            json!({
                                "guest_name": name,
                                "event_title": "your event",
                                "pledged_amount": format!("TZS {}", pledged),
                                "amount_paid": format!("TZS {}", paid),
                                "amount_remaining": format!("TZS {}", outstanding),
                                "payment_deadline": deadline.to_rfc3339(),
                                "pay_link": format!("{}/billing", state.config.app.frontend_url.trim_end_matches('/')),
                            }),
                        )
                        .await
                        .unwrap_or_else(|_| format!("<p>{}</p>", text));
                    state.channels.email(to, &subject, &html).await.is_ok()
                } else {
                    false
                }
            } else if contact == "whatsapp" {
                state.channels.whatsapp_text(&phone, &text).await.is_ok()
            } else {
                state.channels.sms_checked(&[phone.clone()], &text).await.is_ok()
            };

            if delivered {
                sqlx::query(
                    "UPDATE pledge_tracker SET reminder_stages = array_append(reminder_stages, $2), reminder_count = reminder_count + 1, last_reminder_sent_at = NOW(), updated_at = NOW() WHERE id = $1",
                )
                .bind(pledge_id)
                .bind(stage)
                .execute(&*state.db.pool())
                .await?;
                let _ = crate::services::NotificationService::create_org(
                    state.db.pool(),
                    org_id,
                    "pledge.reminder",
                    "Automatic reminder sent",
                    Some(&format!("{}: {}", name, stage)),
                    Some(&format!("/events/{event_id}")),
                    Some(json!({"event_id": event_id, "guest_id": guest_id, "stage": stage})),
                )
                .await;
                sent += 1;
            }
            break; // one stage per pass per guest
        }
    }
    Ok(sent)
}
