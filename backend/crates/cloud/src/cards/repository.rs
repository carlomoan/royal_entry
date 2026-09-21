use sqlx::PgPool;
use crate::cards::model::CardTemplate;
use crate::error::{AppResult, AppError};
use uuid::Uuid;

pub async fn get_by_id(pool: &PgPool, id: Uuid) -> AppResult<Option<CardTemplate>> {
    sqlx::query_as::<_, CardTemplate>(
        "SELECT * FROM card_templates WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|_| AppError::InternalServerError)
}

pub async fn list_by_org(pool: &PgPool, org_id: Uuid) -> AppResult<Vec<CardTemplate>> {
    sqlx::query_as::<_, CardTemplate>(
        "SELECT * FROM card_templates WHERE org_id = $1 ORDER BY created_at DESC"
    )
    .bind(org_id)
    .fetch_all(pool)
    .await
    .map_err(|_| AppError::InternalServerError)
}
