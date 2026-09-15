// ==============================================================================
// FILE: src/handlers/templates.rs
// ==============================================================================
// Email template management: CRUD + live Handlebars preview + duplicate.
// System templates are editable but cannot be deleted (duplicate instead).
// ==============================================================================
use std::sync::Arc;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use handlebars::Handlebars;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    utils::rbac::require_platform_admin,
    AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EmailTemplateResponse {
    pub id: Uuid,
    pub name: String,
    pub subject: String,
    pub html_body: String,
    pub text_body: Option<String>,
    pub variables: Vec<String>,
    pub category: String,
    pub is_active: bool,
    pub is_system: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertTemplateRequest {
    pub name: String,
    pub subject: String,
    pub html_body: String,
    pub text_body: Option<String>,
    pub category: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct PreviewRequest {
    pub subject: String,
    pub html_body: String,
    pub text_body: Option<String>,
    pub variables: Option<Value>,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn extract_variables(subject: &str, html: &str, text: Option<&str>) -> Vec<String> {
    let mut vars = std::collections::BTreeSet::new();
    let re = regex::Regex::new(r"\{\{\s*(\w+)\s*\}\}").unwrap();
    for cap in re.captures_iter(subject) { vars.insert(cap[1].to_string()); }
    for cap in re.captures_iter(html) { vars.insert(cap[1].to_string()); }
    if let Some(t) = text { for cap in re.captures_iter(t) { vars.insert(cap[1].to_string()); } }
    vars.into_iter().collect()
}

/// Realistic sample data used by the live preview when no variables supplied.
fn sample_variables() -> Value {
    json!({
        "user_name": "Amina Hassan",
        "organization_name": "Serengeti Events",
        "event_title": "Amina & Ahmed Wedding",
        "event_date": "20 September 2026",
        "venue": "Serena Hotel, Dar es Salaam",
        "guest_name": "John Doe",
        "amount": "250,000",
        "invoice_number": "INV-2026-0001",
        "payment_method": "M-Pesa",
        "error_reason": "Insufficient balance"
    })
}

fn render_all(subject: &str, html: &str, text: Option<&str>, vars: &Value)
    -> Result<(String, String, Option<String>), String>
{
    let mut hbs = Handlebars::new();
    hbs.set_strict_mode(false);
    hbs.register_template_string("subject", subject).map_err(|e| format!("Subject: {}", e))?;
    hbs.register_template_string("html", html).map_err(|e| format!("HTML: {}", e))?;
    if let Some(t) = text {
        hbs.register_template_string("text", t).map_err(|e| format!("Text: {}", e))?;
    }
    let subject_out = hbs.render("subject", vars).map_err(|e| format!("Subject: {}", e))?;
    let html_out = hbs.render("html", vars).map_err(|e| format!("HTML: {}", e))?;
    let text_out = match text {
        Some(_) => Some(hbs.render("text", vars).map_err(|e| format!("Text: {}", e))?),
        None => None,
    };
    Ok((subject_out, html_out, text_out))
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// GET /api/v1/platform/templates
pub async fn list_templates(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let templates = sqlx::query_as::<_, EmailTemplateResponse>(
        "SELECT * FROM email_templates ORDER BY is_system DESC, category ASC, name ASC",
    )
    .fetch_all(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": templates })))
}

/// GET /api/v1/platform/templates/{id}
pub async fn get_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let template = sqlx::query_as::<_, EmailTemplateResponse>(
        "SELECT * FROM email_templates WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Template not found".to_string()))?;
    Ok(Json(json!({ "success": true, "data": template })))
}

/// POST /api/v1/platform/templates
pub async fn create_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpsertTemplateRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    require_platform_admin(&claims)?;
    if payload.name.trim().is_empty() || payload.subject.trim().is_empty() {
        return Err(AppError::BadRequest("Name and subject are required".to_string()));
    }
    if payload.html_body.trim().is_empty() {
        return Err(AppError::BadRequest("HTML body is required".to_string()));
    }
    let id = Uuid::new_v4();
    let variables = extract_variables(&payload.subject, &payload.html_body, payload.text_body.as_deref());
    sqlx::query(
        r#"
        INSERT INTO email_templates
            (id, name, subject, html_body, text_body, variables, category, is_active, is_system, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, NOW(), NOW())
        "#,
    )
    .bind(id)
    .bind(payload.name.trim())
    .bind(payload.subject.trim())
    .bind(&payload.html_body)
    .bind(&payload.text_body)
    .bind(&variables)
    .bind(payload.category.unwrap_or_else(|| "custom".to_string()))
    .bind(payload.is_active.unwrap_or(true))
    .execute(state.db.pool())
    .await?;
    Ok((StatusCode::CREATED, Json(json!({ "success": true, "data": { "id": id } }))))
}

/// PUT /api/v1/platform/templates/{id}
pub async fn update_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpsertTemplateRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let variables = extract_variables(&payload.subject, &payload.html_body, payload.text_body.as_deref());
    let result = sqlx::query(
        r#"
        UPDATE email_templates
        SET name = $2, subject = $3, html_body = $4, text_body = $5, variables = $6,
            category = COALESCE($7, category), is_active = COALESCE($8, is_active), updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(payload.name.trim())
    .bind(payload.subject.trim())
    .bind(&payload.html_body)
    .bind(&payload.text_body)
    .bind(&variables)
    .bind(payload.category)
    .bind(payload.is_active)
    .execute(state.db.pool())
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Template not found".to_string()));
    }
    Ok(Json(json!({ "success": true, "message": "Template updated" })))
}

/// DELETE /api/v1/platform/templates/{id} — system templates are protected
pub async fn delete_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;
    let result = sqlx::query("DELETE FROM email_templates WHERE id = $1 AND is_system = FALSE")
        .bind(id)
        .execute(state.db.pool())
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::BadRequest(
            "Template not found or is a protected system template (duplicate it instead)".to_string(),
        ));
    }
    Ok(Json(json!({ "success": true, "message": "Template deleted" })))
}

/// POST /api/v1/platform/templates/{id}/duplicate — copy (esp. system) to custom
pub async fn duplicate_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    require_platform_admin(&claims)?;
    let src = sqlx::query_as::<_, EmailTemplateResponse>(
        "SELECT * FROM email_templates WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Template not found".to_string()))?;

    let new_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO email_templates
            (id, name, subject, html_body, text_body, variables, category, is_active, is_system, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, FALSE, NOW(), NOW())
        "#,
    )
    .bind(new_id)
    .bind(format!("{} (copy)", src.name))
    .bind(&src.subject)
    .bind(&src.html_body)
    .bind(&src.text_body)
    .bind(&src.variables)
    .bind(&src.category)
    .execute(state.db.pool())
    .await?;
    Ok((StatusCode::CREATED, Json(json!({ "success": true, "data": { "id": new_id } }))))
}

/// POST /api/v1/platform/templates/preview — live editor preview (no save)
pub async fn preview_template(
    Extension(claims): Extension<Claims>,
    Json(payload): Json<PreviewRequest>,
) -> AppResult<Json<serde_json::Value>> {
    require_platform_admin(&claims)?;

    // Merge user-supplied sample overrides over defaults
    let mut vars = sample_variables();
    if let Some(extra) = payload.variables.as_ref().and_then(|v| v.as_object()) {
        if let Some(obj) = vars.as_object_mut() {
            for (k, v) in extra { obj.insert(k.clone(), v.clone()); }
        }
    }

    match render_all(&payload.subject, &payload.html_body, payload.text_body.as_deref(), &vars) {
        Ok((subject, html, text)) => Ok(Json(json!({
            "success": true,
            "data": {
                "subject": subject,
                "html": html,
                "text": text,
                "variables": extract_variables(&payload.subject, &payload.html_body, payload.text_body.as_deref()),
            }
        }))),
        Err(msg) => Err(AppError::ValidationError(format!("Template render error: {}", msg))),
    }
}
