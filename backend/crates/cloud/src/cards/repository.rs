use sqlx::PgPool;
use uuid::Uuid;
use crate::error::{AppError, AppResult};
use crate::cards::model::{CardTemplate, CardTemplateResponse, CreateCardTemplateRequest, UpdateCardTemplateRequest};

pub async fn list_templates(pool: &PgPool, org_id: Uuid) -> AppResult<Vec<CardTemplateResponse>> {
    let templates = sqlx::query_as::<_, CardTemplate>(
        "SELECT id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, created_at, updated_at 
         FROM card_templates WHERE org_id = $1 ORDER BY created_at DESC"
    )
    .bind(org_id)
    .fetch_all(pool)
    .await?;

    Ok(templates.into_iter().map(Into::into).collect())
}

pub async fn get_template(pool: &PgPool, id: Uuid, org_id: Uuid) -> AppResult<CardTemplateResponse> {
    let template = sqlx::query_as::<_, CardTemplate>(
        "SELECT id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, created_at, updated_at 
         FROM card_templates WHERE id = $1 AND org_id = $2"
    )
    .bind(id)
    .bind(org_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Card template not found".to_string()))?;

    Ok(template.into())
}

pub async fn create_template(pool: &PgPool, org_id: Uuid, req: CreateCardTemplateRequest) -> AppResult<CardTemplateResponse> {
    let id = Uuid::new_v4();
    let template = sqlx::query_as::<_, CardTemplate>(
        "INSERT INTO card_templates (id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW()) 
         RETURNING id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, created_at, updated_at"
    )
    .bind(id)
    .bind(org_id)
    .bind(req.name)
    .bind(req.description)
    .bind(req.theme_config)
    .bind(req.background_file_id)
    .bind(req.preview_image_url)
    .fetch_one(pool)
    .await?;

    Ok(template.into())
}

pub async fn update_template(pool: &PgPool, id: Uuid, org_id: Uuid, req: UpdateCardTemplateRequest) -> AppResult<CardTemplateResponse> {
    let template = sqlx::query_as::<_, CardTemplate>(
        "UPDATE card_templates 
         SET name = COALESCE($3, name), description = COALESCE($4, description), theme_config = COALESCE($5, theme_config), 
             background_file_id = COALESCE($6, background_file_id), preview_image_url = COALESCE($7, preview_image_url), 
             is_active = COALESCE($8, is_active), updated_at = NOW() 
         WHERE id = $1 AND org_id = $2 
         RETURNING id, org_id, name, description, theme_config, background_file_id, preview_image_url, is_active, created_at, updated_at"
    )
    .bind(id)
    .bind(org_id)
    .bind(req.name)
    .bind(req.description)
    .bind(req.theme_config)
    .bind(req.background_file_id)
    .bind(req.preview_image_url)
    .bind(req.is_active)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Card template not found".to_string()))?;

    Ok(template.into())
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