// ==============================================================================
// FILE: crates/cloud/src/handlers/templates.rs
// ==============================================================================
// Email template CRUD (platform admin) backed by the `email_templates` table.
// System templates can be edited but not deleted (duplicate them instead).
// ==============================================================================
use std::sync::Arc;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use handlebars::Handlebars;
use regex::Regex;
use serde_json::{json, Value};
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    models::template::{CreateTemplateRequest, EmailTemplate, UpdateTemplateRequest},
    models::user::Claims,
    utils::rbac::require_platform_admin,
    AppState,
};

fn extract_variables(subject: &str, html: &str, text: Option<&str>) -> Vec<String> {
    let re = Regex::new(r"\{\{(\w+)\}\}").expect("valid regex");
    let mut set = std::collections::BTreeSet::new();
    for cap in re.captures_iter(subject) {
        set.insert(cap[1].to_string());
    }
    for cap in re.captures_iter(html) {
        set.insert(cap[1].to_string());
    }
    if let Some(text) = text {
        for cap in re.captures_iter(text) {
            set.insert(cap[1].to_string());
        }
    }
    set.into_iter().collect()
}

pub async fn list_templates(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let rows = sqlx::query_as::<_, EmailTemplate>(
        "SELECT * FROM email_templates ORDER BY is_system DESC, name ASC",
    )
    .fetch_all(&*state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": rows })))
}

pub async fn create_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateTemplateRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    require_platform_admin(&claims)?;
    if payload.name.trim().is_empty()
        || payload.subject.trim().is_empty()
        || payload.html_body.trim().is_empty()
    {
        return Err(AppError::BadRequest(
            "Name, subject and HTML body are required".to_string(),
        ));
    }
    let id = Uuid::new_v4();
    let variables = extract_variables(&payload.subject, &payload.html_body, payload.text_body.as_deref());
    sqlx::query(
        "INSERT INTO email_templates (id, name, subject, html_body, text_body, variables, category, is_active, is_system, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,FALSE,NOW(),NOW())",
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&payload.subject)
    .bind(&payload.html_body)
    .bind(&payload.text_body)
    .bind(&variables)
    .bind(&payload.category)
    .execute(&*state.db.pool())
    .await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({ "success": true, "data": { "id": id } })),
    ))
}

pub async fn get_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let row = sqlx::query_as::<_, EmailTemplate>(
        "SELECT * FROM email_templates WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&*state.db.pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Template not found".to_string()))?;
    Ok(Json(json!({ "success": true, "data": row })))
}

pub async fn update_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTemplateRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let existing = sqlx::query_as::<_, EmailTemplate>(
        "SELECT * FROM email_templates WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&*state.db.pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Template not found".to_string()))?;

    let subject = payload.subject.unwrap_or(existing.subject);
    let html = payload.html_body.unwrap_or(existing.html_body);
    let text = payload.text_body.or(existing.text_body);
    let variables = extract_variables(&subject, &html, text.as_deref());

    sqlx::query(
        "UPDATE email_templates SET
            name = COALESCE($2, name),
            subject = COALESCE($3, subject),
            html_body = COALESCE($4, html_body),
            text_body = COALESCE($5, text_body),
            variables = $6,
            category = COALESCE($7, category),
            is_active = COALESCE($8, is_active),
            updated_at = NOW()
         WHERE id = $1",
    )
    .bind(id)
    .bind(&payload.name)
    .bind(&subject)
    .bind(&html)
    .bind(&text)
    .bind(&variables)
    .bind(&payload.category)
    .bind(&payload.is_active)
    .execute(&*state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "message": "Template updated" })))
}

pub async fn delete_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let existing = sqlx::query_as::<_, EmailTemplate>(
        "SELECT * FROM email_templates WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&*state.db.pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Template not found".to_string()))?;
    if existing.is_system {
        return Err(AppError::BadRequest(
            "System templates cannot be deleted — duplicate them instead".to_string(),
        ));
    }
    sqlx::query("DELETE FROM email_templates WHERE id = $1")
        .bind(id)
        .execute(&*state.db.pool())
        .await?;
    Ok(Json(json!({ "success": true, "message": "Template deleted" })))
}

pub async fn preview_template(
    State(_state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<Value>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let subject = payload.get("subject").and_then(Value::as_str).unwrap_or("");
    let html = payload.get("html_body").and_then(Value::as_str).unwrap_or("");
    let text = payload.get("text_body").and_then(Value::as_str);

    let sample = json!({
        "user_name": "Guest", "guest_name": "Guest", "event_title": "Sample Event",
        "event_date": "Saturday, 15 December 2026", "event_time": "14:00",
        "venue": "Kisangara", "venue_address": "Kilimanjaro",
        "check_in_link": "https://royalentry.foctek.co.tz/g/sample",
        "organization_name": "RoyalEntry", "amount": "TZS 100,000",
        "amount_paid": "TZS 50,000", "amount_remaining": "TZS 50,000",
        "pledged_amount": "TZS 100,000", "payment_deadline": "2026-12-01",
        "payment_method": "M-Pesa", "reference": "SAMPLE123",
        "pay_link": "https://royalentry.foctek.co.tz/billing",
        "otp_code": "123456", "expires_at": "22:00", "invoice_number": "INV-SAMPLE",
        "subject_heading": "Hello", "message": "This is a sample message.",
        "error_reason": "Insufficient funds",
    });

    let mut hbs = Handlebars::new();
    hbs.set_strict_mode(false);
    let render = |tpl: &str| -> String {
        hbs.render_template(tpl, &sample).unwrap_or_else(|_| tpl.to_string())
    };

    Ok(Json(json!({
        "success": true,
        "data": {
            "subject": render(subject),
            "html": render(html),
            "text": text.map(render),
        }
    })))
}

pub async fn duplicate_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let existing = sqlx::query_as::<_, EmailTemplate>(
        "SELECT * FROM email_templates WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&*state.db.pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Template not found".to_string()))?;

    let new_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO email_templates (id, name, subject, html_body, text_body, variables, category, is_active, is_system, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,FALSE,NOW(),NOW())",
    )
    .bind(new_id)
    .bind(format!("{} (Copy)", existing.name))
    .bind(&existing.subject)
    .bind(&existing.html_body)
    .bind(&existing.text_body)
    .bind(&existing.variables)
    .bind(&existing.category)
    .execute(&*state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": { "id": new_id } })))
}
