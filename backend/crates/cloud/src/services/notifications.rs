use std::sync::Arc;
use uuid::Uuid;
use crate::{error::AppResult, models::user::Claims, AppState};

pub struct NotificationService {
    _state: Arc<AppState>,
}

impl NotificationService {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { _state: state }
    }

    pub async fn list_for(&self, _claims: &Claims, _limit: i64) -> AppResult<Vec<serde_json::Value>> {
        Ok(vec![]) // TODO: Wire to DB
    }

    pub async fn unread_count(&self, _claims: &Claims) -> AppResult<i64> {
        Ok(0) // TODO: Wire to DB
    }

    pub async fn mark_read(&self, _claims: &Claims, _id: Uuid) -> AppResult<()> {
        Ok(())
    }

    pub async fn mark_all_read(&self, _claims: &Claims) -> AppResult<()> {
        Ok(())
    }
}
