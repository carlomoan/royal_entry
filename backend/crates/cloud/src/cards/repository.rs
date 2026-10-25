use sqlx::{PgPool, Row};
use serde_json::Value;
use uuid::Uuid;
use crate::error::{AppError, AppResult};
use crate::cards::model::{CardTemplate, CardTemplateResponse, CreateCardTemplateRequest, UpdateCardTemplateRequest};

const TEMPLATE_COLUMNS: &str = "id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, is_global, created_at, updated_at";

/// Templates visible to an org: its own templates (any status) plus the
/// shared SaaS catalog (templates published globally by platform admins).
pub async fn list_templates(pool: &PgPool, org_id: Uuid) -> AppResult<Vec<CardTemplateResponse>> {
    let templates = sqlx::query_as::<_, CardTemplate>(
        &format!(
            "SELECT {TEMPLATE_COLUMNS} FROM card_templates \
             WHERE org_id = $1 OR (is_active = TRUE AND is_global = TRUE) \
             ORDER BY (org_id = $1) DESC, created_at DESC"
        )
    )
    .bind(org_id)
    .fetch_all(pool)
    .await?;

    Ok(templates
        .into_iter()
        .map(|t| CardTemplateResponse::from_template(t, org_id))
        .collect())
}

/// Fetch a template that is usable by the org: owned by it, or shared globally
/// and active. Used for viewing and for rendering guest cards.
pub async fn get_template(pool: &PgPool, id: Uuid, org_id: Uuid) -> AppResult<CardTemplateResponse> {
    let template = sqlx::query_as::<_, CardTemplate>(
        &format!(
            "SELECT {TEMPLATE_COLUMNS} FROM card_templates \
             WHERE id = $1 AND (org_id = $2 OR (is_active = TRUE AND is_global = TRUE))"
        )
    )
    .bind(id)
    .bind(org_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Card template not found".to_string()))?;

    Ok(CardTemplateResponse::from_template(template, org_id))
}

/// Strict ownership lookup — only the creating org can write to a template.
pub async fn get_owned_template(pool: &PgPool, id: Uuid, org_id: Uuid) -> AppResult<CardTemplateResponse> {
    let template = sqlx::query_as::<_, CardTemplate>(
        &format!(
            "SELECT {TEMPLATE_COLUMNS} FROM card_templates WHERE id = $1 AND org_id = $2"
        )
    )
    .bind(id)
    .bind(org_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Card template not found".to_string()))?;

    Ok(CardTemplateResponse::from_template(template, org_id))
}

pub async fn create_template(pool: &PgPool, org_id: Uuid, req: CreateCardTemplateRequest) -> AppResult<CardTemplateResponse> {
    let id = Uuid::new_v4();
    let template = sqlx::query_as::<_, CardTemplate>(
        &format!(
            "INSERT INTO card_templates (id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, is_global, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, TRUE), COALESCE($9, FALSE), NOW(), NOW()) \
             RETURNING {TEMPLATE_COLUMNS}"
        )
    )
    .bind(id)
    .bind(org_id)
    .bind(req.name)
    .bind(req.description)
    .bind(req.theme_config)
    .bind(req.background_file_id)
    .bind(req.preview_image_url)
    .bind(req.is_active)
    .bind(req.is_global)
    .fetch_one(pool)
    .await?;

    Ok(CardTemplateResponse::from_template(template, org_id))
}

pub async fn update_template(pool: &PgPool, id: Uuid, org_id: Uuid, req: UpdateCardTemplateRequest) -> AppResult<CardTemplateResponse> {
    let template = sqlx::query_as::<_, CardTemplate>(
        &format!(
            "UPDATE card_templates \
             SET name = COALESCE($3, name), description = COALESCE($4, description), theme_config = COALESCE($5, theme_config), \
                 background_file_id = COALESCE($6, background_file_id), preview_image_url = COALESCE($7, preview_image_url), \
                 is_active = COALESCE($8, is_active), is_global = COALESCE($9, is_global), updated_at = NOW() \
             WHERE id = $1 AND org_id = $2 \
             RETURNING {TEMPLATE_COLUMNS}"
        )
    )
    .bind(id)
    .bind(org_id)
    .bind(req.name)
    .bind(req.description)
    .bind(req.theme_config)
    .bind(req.background_file_id)
    .bind(req.preview_image_url)
    .bind(req.is_active)
    .bind(req.is_global)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Card template not found".to_string()))?;

    Ok(CardTemplateResponse::from_template(template, org_id))
}

pub async fn delete_template(pool: &PgPool, id: Uuid, org_id: Uuid) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM card_templates WHERE id = $1 AND org_id = $2")
        .bind(id)
        .bind(org_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Card template not found".to_string()));
    }
    Ok(())
}

/// Locate the template that references a stored background file, returning
/// (owning_org_id, is_active, is_global). Used to serve shared platform
/// template images cross-organization.
pub async fn find_template_by_file(
    pool: &PgPool,
    file_id: &str,
) -> AppResult<Option<(Uuid, bool, bool)>> {
    let row = sqlx::query(
        "SELECT org_id, is_active, is_global FROM card_templates \
         WHERE theme_config->>'front_file_id' = $1 OR background_file_id = $1 \
         ORDER BY (is_global = TRUE AND is_active = TRUE) DESC, updated_at DESC LIMIT 1",
    )
    .bind(file_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| {
        (
            r.get::<Uuid, _>("org_id"),
            r.get::<bool, _>("is_active"),
            r.get::<bool, _>("is_global"),
        )
    }))
}

/// Verify a template can actually produce guest cards before an event is
/// allowed to reference it. Returns a descriptive 400 on failure.
pub async fn ensure_renderable(pool: &PgPool, org_id: Uuid, template_id: Uuid) -> AppResult<()> {
    let template = get_template(pool, template_id, org_id).await?;

    if !template.is_active {
        return Err(AppError::BadRequest(format!(
            "Card template '{}' is inactive — activate it in the Card Studio first",
            template.name
        )));
    }

    let config = &template.theme_config;
    let has_background = config
        .get("front_file_id")
        .and_then(Value::as_str)
        .map(|s| !s.is_empty())
        .unwrap_or(false)
        || template
            .background_file_id
            .as_deref()
            .map(|s| !s.is_empty())
            .unwrap_or(false);
    if !has_background {
        return Err(AppError::BadRequest(format!(
            "Card template '{}' has no background image — upload the design in the Card Studio first",
            template.name
        )));
    }

    if !config.get("qr_position").and_then(Value::as_object).is_some() {
        return Err(AppError::BadRequest(format!(
            "Card template '{}' has no QR position configured — set it in the Card Studio first",
            template.name
        )));
    }

    Ok(())
}
