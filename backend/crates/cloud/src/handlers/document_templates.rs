// ==============================================================================
// FILE: crates/cloud/src/handlers/document_templates.rs
// ==============================================================================
// Editable document templates (invoice, receipt, report, cards) and public
// invoice views for links sent to guests and company contacts.
// ==============================================================================
use axum::{extract::{Path, Query, State}, Extension, Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
    AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
struct DocumentTemplate {
    id: Uuid,
    org_id: Option<Uuid>,
    kind: String,
    name: String,
    subject: Option<String>,
    body_html: String,
    variables_json: serde_json::Value,
    is_active: bool,
    is_system: bool,
}

#[derive(Debug, Deserialize)]
pub struct TemplateQuery {
    pub kind: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SaveTemplateRequest {
    pub kind: String,
    pub name: String,
    pub subject: Option<String>,
    pub body_html: String,
    pub variables: Option<Vec<String>>,
    pub is_active: Option<bool>,
}

fn org_id_from(claims: &Claims) -> AppResult<Uuid> {
    Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)
}

fn valid_kind(kind: &str) -> bool {
    matches!(kind, "invoice" | "receipt" | "report" | "checkin_card" | "invitation")
}

pub async fn list_document_templates(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<TemplateQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    let rows = sqlx::query_as::<_, DocumentTemplate>(
        r#"SELECT * FROM document_templates
           WHERE (org_id IS NULL OR org_id = $1) AND ($2::TEXT IS NULL OR kind = $2)
           ORDER BY kind, is_system DESC, name"#,
    )
    .bind(org_id)
    .bind(query.kind.as_deref())
    .fetch_all(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": rows })))
}

pub async fn create_document_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<SaveTemplateRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    if !valid_kind(&payload.kind) {
        return Err(AppError::ValidationError("Invalid template kind".to_string()));
    }
    if payload.name.trim().is_empty() || payload.body_html.trim().is_empty() {
        return Err(AppError::ValidationError("Name and body are required".to_string()));
    }
    let id = Uuid::new_v4();
    let vars = json!(payload.variables.unwrap_or_default());
    sqlx::query(
        r#"INSERT INTO document_templates
               (id, org_id, kind, name, subject, body_html, variables_json, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(id).bind(org_id).bind(&payload.kind).bind(payload.name.trim())
    .bind(payload.subject).bind(payload.body_html.trim()).bind(vars)
    .bind(payload.is_active.unwrap_or(true))
    .execute(state.db.pool()).await?;
    Ok(Json(json!({ "success": true, "data": { "id": id } })))
}

pub async fn update_document_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SaveTemplateRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    let existing: Option<(Option<Uuid>, bool)> = sqlx::query_as(
        "SELECT org_id, is_system FROM document_templates WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(state.db.pool())
    .await?;
    let (owner, is_system) = existing.ok_or(AppError::NotFound("Template not found".to_string()))?;
    let platform = crate::utils::rbac::is_platform_role(&claims.role);
    if !platform && (is_system || owner != Some(org_id)) {
        return Err(AppError::Forbidden);
    }
    if !valid_kind(&payload.kind) {
        return Err(AppError::ValidationError("Invalid template kind".to_string()));
    }
    sqlx::query(
        r#"UPDATE document_templates SET kind=$2, name=$3, subject=$4, body_html=$5,
               variables_json=$6, is_active=$7, updated_at=NOW() WHERE id=$1"#,
    )
    .bind(id).bind(&payload.kind).bind(payload.name.trim()).bind(payload.subject)
    .bind(payload.body_html.trim())
    .bind(json!(payload.variables.unwrap_or_default()))
    .bind(payload.is_active.unwrap_or(true))
    .execute(state.db.pool()).await?;
    Ok(Json(json!({ "success": true, "message": "Template updated" })))
}

pub async fn delete_document_template(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    let owner: Option<Option<Uuid>> = sqlx::query_scalar(
        "SELECT org_id FROM document_templates WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(state.db.pool())
    .await?;
    let owner = owner.ok_or(AppError::NotFound("Template not found".to_string()))?;
    if !crate::utils::rbac::is_platform_role(&claims.role) && owner != Some(org_id) {
        return Err(AppError::Forbidden);
    }
    sqlx::query("DELETE FROM document_templates WHERE id = $1")
        .bind(id)
        .execute(state.db.pool()).await?;
    Ok(Json(json!({ "success": true, "message": "Template deleted" })))
}

/// GET /api/v1/public/invoices/{token} — no login required. Used by links sent
/// to company contacts and guests.
pub async fn public_invoice(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let row = sqlx::query(
        r#"SELECT bi.*, b.company_name, b.contact_person, e.title AS event_title,
                  o.display_name AS organization_name
           FROM booking_invoices bi
           JOIN bookings b ON b.id = bi.booking_id
           JOIN events e ON e.id = bi.event_id
           JOIN organizations o ON o.id = bi.organization_id
           WHERE bi.public_token = $1"#,
    )
    .bind(&token)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Invoice not found".to_string()))?;

    let amount: i64 = row.try_get("amount_tsh").unwrap_or(0);
    let tax: i64 = row.try_get("tax_amount_tsh").unwrap_or(0);
    let vars = json!({
        "invoice_number": row.try_get::<String, _>("invoice_number").unwrap_or_default(),
        "organization_name": row.try_get::<String, _>("organization_name").unwrap_or_default(),
        "company_name": row.try_get::<String, _>("company_name").unwrap_or_default(),
        "event_title": row.try_get::<String, _>("event_title").unwrap_or_default(),
        "issued_at": row.try_get::<chrono::DateTime<chrono::Utc>, _>("issued_at").map(|d| d.format("%d %B %Y").to_string()).unwrap_or_default(),
        "amount_tsh": amount,
        "tax_amount_tsh": tax,
        "total_tsh": amount,
        "tin": row.try_get::<Option<String>, _>("tin").ok().flatten().unwrap_or_default(),
    });

    let template: Option<String> = sqlx::query_scalar(
        r#"SELECT body_html FROM document_templates
           WHERE kind = 'invoice' AND is_active = TRUE AND (org_id IS NULL OR org_id = $1)
           ORDER BY org_id IS NULL DESC, created_at DESC LIMIT 1"#,
    )
    .bind(row.try_get::<Uuid, _>("organization_id").unwrap_or_default())
    .fetch_optional(state.db.pool())
    .await?;
    let mut hbs = handlebars::Handlebars::new();
    hbs.set_strict_mode(false);
    let html = template
        .and_then(|t| hbs.render_template(&t, &vars).ok())
        .unwrap_or_else(|| format!("<h1>Invoice {}</h1><p>Total: TZS {}</p>", vars["invoice_number"], amount));

    Ok(Json(json!({
        "success": true,
        "data": {
            "invoice_number": vars["invoice_number"],
            "company_name": vars["company_name"],
            "event_title": vars["event_title"],
            "organization_name": vars["organization_name"],
            "amount_tsh": amount,
            "tax_amount_tsh": tax,
            "tin": vars["tin"],
            "status": row.try_get::<String, _>("status").unwrap_or_default(),
            "html": html,
        }
    })))
}
