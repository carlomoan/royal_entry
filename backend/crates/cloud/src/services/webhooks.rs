// ==============================================================================
// FILE: src/services/webhooks.rs
// ==============================================================================
// Webhook delivery service with retry logic and HMAC signatures
// ==============================================================================
use std::sync::Arc;
use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};
use reqwest::Client;
use sha2::Sha256;
use std::fmt::Write;
use uuid::Uuid;
use crate::{
    error::{AppError, AppResult},
    models::webhook::{
        WebhookDelivery, WebhookEndpoint, CreateWebhookEndpointRequest,
        UpdateWebhookEndpointRequest, WebhookEndpointResponse,
    },
    AppState,
};

type HmacSha256 = Hmac<Sha256>;

pub struct WebhookService {
    state: Arc<AppState>,
    http_client: Client,
}

impl WebhookService {
    pub fn new(state: Arc<AppState>) -> Self {
        let http_client = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_default();
        Self { state, http_client }
    }

    // ============================================================================
    // ENDPOINT MANAGEMENT
    // ============================================================================

    pub async fn create_endpoint(
        &self,
        org_id: Uuid,
        payload: CreateWebhookEndpointRequest,
    ) -> AppResult<WebhookEndpointResponse> {
        if !payload.url.starts_with("https://") {
            return Err(AppError::BadRequest("Webhook URL must use HTTPS".to_string()));
        }

        let secret = Uuid::new_v4().to_string().replace('-', "");
        let endpoint = sqlx::query_as::<_, WebhookEndpoint>(
            r#"
            INSERT INTO webhook_endpoints (organization_id, url, secret, events, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
            RETURNING *
            "#,
        )
        .bind(org_id)
        .bind(&payload.url)
        .bind(&secret)
        .bind(&payload.events)
        .fetch_one(&*self.state.db.pool())
        .await?;

        Ok(endpoint.into())
    }

    pub async fn list_endpoints(&self, org_id: Uuid) -> AppResult<Vec<WebhookEndpointResponse>> {
        let endpoints = sqlx::query_as::<_, WebhookEndpoint>(
            "SELECT * FROM webhook_endpoints WHERE organization_id = $1 ORDER BY created_at DESC",
        )
        .bind(org_id)
        .fetch_all(&*self.state.db.pool())
        .await?;
        Ok(endpoints.into_iter().map(Into::into).collect())
    }

    pub async fn get_endpoint(
        &self,
        org_id: Uuid,
        endpoint_id: Uuid,
    ) -> AppResult<WebhookEndpointResponse> {
        let endpoint = sqlx::query_as::<_, WebhookEndpoint>(
            "SELECT * FROM webhook_endpoints WHERE id = $1 AND organization_id = $2",
        )
        .bind(endpoint_id)
        .bind(org_id)
        .fetch_optional(&*self.state.db.pool())
        .await?
        .ok_or_else(|| AppError::NotFound("Webhook endpoint not found".to_string()))?;
        Ok(endpoint.into())
    }

    pub async fn update_endpoint(
        &self,
        org_id: Uuid,
        endpoint_id: Uuid,
        payload: UpdateWebhookEndpointRequest,
    ) -> AppResult<WebhookEndpointResponse> {
        if let Some(ref url) = payload.url {
            if !url.starts_with("https://") {
                return Err(AppError::BadRequest("Webhook URL must use HTTPS".to_string()));
            }
        }

        if let Some(url) = payload.url {
            sqlx::query(
                "UPDATE webhook_endpoints SET url = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3",
            )
            .bind(url)
            .bind(endpoint_id)
            .bind(org_id)
            .execute(&*self.state.db.pool())
            .await?;
        }

        if let Some(events) = payload.events {
            sqlx::query(
                "UPDATE webhook_endpoints SET events = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3",
            )
            .bind(events)
            .bind(endpoint_id)
            .bind(org_id)
            .execute(&*self.state.db.pool())
            .await?;
        }

        if let Some(is_active) = payload.is_active {
            sqlx::query(
                "UPDATE webhook_endpoints SET is_active = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3",
            )
            .bind(is_active)
            .bind(endpoint_id)
            .bind(org_id)
            .execute(&*self.state.db.pool())
            .await?;
        }

        let endpoint = sqlx::query_as::<_, WebhookEndpoint>(
            "SELECT * FROM webhook_endpoints WHERE id = $1 AND organization_id = $2",
        )
        .bind(endpoint_id)
        .bind(org_id)
        .fetch_optional(&*self.state.db.pool())
        .await?
        .ok_or_else(|| AppError::NotFound("Webhook endpoint not found".to_string()))?;
        Ok(endpoint.into())
    }

    pub async fn delete_endpoint(&self, org_id: Uuid, endpoint_id: Uuid) -> AppResult<()> {
        let result = sqlx::query(
            "DELETE FROM webhook_endpoints WHERE id = $1 AND organization_id = $2",
        )
        .bind(endpoint_id)
        .bind(org_id)
        .execute(&*self.state.db.pool())
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Webhook endpoint not found".to_string()));
        }
        Ok(())
    }

    // ============================================================================
    // EVENT TRIGGERING
    // ============================================================================

    pub async fn trigger_event(
        &self,
        org_id: Uuid,
        event_type: &str,
        payload: serde_json::Value,
    ) -> AppResult<u64> {
        let endpoints = sqlx::query_as::<_, WebhookEndpoint>(
            "SELECT * FROM webhook_endpoints WHERE organization_id = $1 AND is_active = TRUE AND $2 = ANY(events)",
        )
        .bind(org_id)
        .bind(event_type)
        .fetch_all(&*self.state.db.pool())
        .await?;

        let mut triggered = 0u64;
        for endpoint in endpoints {
            sqlx::query(
                r#"
                INSERT INTO webhook_deliveries (id, endpoint_id, event_type, payload, attempt, status, created_at)
                VALUES ($1, $2, $3, $4, 0, 'pending', NOW())
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(endpoint.id)
            .bind(event_type)
            .bind(&payload)
            .execute(&*self.state.db.pool())
            .await?;
            triggered += 1;
        }
        Ok(triggered)
    }

    // ============================================================================
    // DELIVERY PROCESSING
    // ============================================================================

    pub async fn process_deliveries(&self) -> AppResult<u64> {
        let now = Utc::now();

        let deliveries = sqlx::query_as::<_, WebhookDelivery>(
            r#"
            SELECT * FROM webhook_deliveries
            WHERE status IN ('pending', 'failed')
              AND (next_retry_at IS NULL OR next_retry_at <= $1)
              AND attempt < 5
            ORDER BY created_at ASC
            LIMIT 100
            "#,
        )
        .bind(now)
        .fetch_all(&*self.state.db.pool())
        .await?;

        let mut processed = 0u64;
        for delivery in deliveries {
            if let Err(e) = self.deliver(&delivery).await {
                tracing::warn!(delivery_id = %delivery.id, error = %e, "Webhook delivery failed");
            }
            processed += 1;
        }
        Ok(processed)
    }

    async fn deliver(&self, delivery: &WebhookDelivery) -> AppResult<()> {
        let endpoint = sqlx::query_as::<_, WebhookEndpoint>(
            "SELECT * FROM webhook_endpoints WHERE id = $1",
        )
        .bind(delivery.endpoint_id)
        .fetch_optional(&*self.state.db.pool())
        .await?
        .ok_or_else(|| AppError::NotFound("Endpoint not found".to_string()))?;

        sqlx::query(
            "UPDATE webhook_deliveries SET status = 'delivering', attempt = attempt + 1 WHERE id = $1",
        )
        .bind(delivery.id)
        .execute(&*self.state.db.pool())
        .await?;

        let timestamp = Utc::now().timestamp().to_string();
        let signature = self.generate_signature(&endpoint.secret, &delivery.payload, &timestamp);

        let response = self
            .http_client
            .post(&endpoint.url)
            .header("Content-Type", "application/json")
            .header("X-RoyalEntry-Signature", &signature)
            .header("X-RoyalEntry-Timestamp", &timestamp)
            .header("X-RoyalEntry-Event", &delivery.event_type)
            .header("X-RoyalEntry-Delivery", delivery.id.to_string())
            .json(&delivery.payload)
            .send()
            .await;

        match response {
            Ok(resp) => {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                if status >= 200 && status < 300 {
                    sqlx::query(
                        "UPDATE webhook_deliveries SET status = 'success', response_status = $1, response_body = $2, completed_at = NOW() WHERE id = $3"
                    )
                    .bind(status as i32)
                    .bind(&body)
                    .bind(delivery.id)
                    .execute(&*self.state.db.pool())
                    .await?;
                } else {
                    self.schedule_retry(delivery, status, &body).await?;
                }
            }
            Err(e) => {
                self.schedule_retry(delivery, 0, &e.to_string()).await?;
            }
        }
        Ok(())
    }

    async fn schedule_retry(
        &self,
        delivery: &WebhookDelivery,
        status: u16,
        error: &str,
    ) -> AppResult<()> {
        let next_attempt = delivery.attempt + 1;
        if next_attempt >= 5 {
            sqlx::query(
                "UPDATE webhook_deliveries SET status = 'abandoned', response_status = $1, response_body = $2, error = $3, completed_at = NOW() WHERE id = $4"
            )
            .bind(status as i32)
            .bind(error)
            .bind(format!("Max retries exceeded: {}", error))
            .bind(delivery.id)
            .execute(&*self.state.db.pool())
            .await?;
        } else {
            let delay_minutes = match next_attempt {
                1 => 1,
                2 => 5,
                3 => 15,
                4 => 60,
                _ => 240,
            };
            let next_retry = Utc::now() + Duration::minutes(delay_minutes);
            sqlx::query(
                "UPDATE webhook_deliveries SET status = 'failed', response_status = $1, response_body = $2, error = $3, next_retry_at = $4 WHERE id = $5"
            )
            .bind(status as i32)
            .bind(error)
            .bind(format!("HTTP {}: {}", status, error))
            .bind(next_retry)
            .bind(delivery.id)
            .execute(&*self.state.db.pool())
            .await?;
        }
        Ok(())
    }

    fn generate_signature(
        &self,
        secret: &str,
        payload: &serde_json::Value,
        timestamp: &str,
    ) -> String {
        let mut mac =
            HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
        let payload_str = serde_json::to_string(payload).unwrap_or_default();
        let message = format!("{}.{}", timestamp, payload_str);
        mac.update(message.as_bytes());
        let result = mac.finalize();
        let mut hex_str = String::new();
        for byte in result.into_bytes() {
            write!(&mut hex_str, "{:02x}", byte).unwrap();
        }
        hex_str
    }
    pub async fn test_endpoint(&self, _endpoint_id: Uuid) -> AppResult<serde_json::Value> {
        Ok(serde_json::json!({
            "status": "success",
            "message": "Test webhook fired successfully (mock)"
        }))
    }
}
