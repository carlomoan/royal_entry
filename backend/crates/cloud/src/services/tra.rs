// ==============================================================================
// FILE: crates/cloud/src/services/tra.rs
// ==============================================================================
// Tanzania Revenue Authority (TRA) e-invoice submission. Best-effort client:
// reads the platform's tax config (enabled + API URL + credentials) from
// system_settings and POSTs invoice data to TRA. The exact payload must match
// TRA's current e-invoice API spec — adjust `body` once credentials are set.
// ==============================================================================
use std::sync::Arc;
use base64::Engine as _;
use reqwest::Client;
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;
use crate::{error::{AppError, AppResult}, AppState};

pub struct TraService {
    state: Arc<AppState>,
    client: Client,
}

impl TraService {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state, client: Client::new() }
    }

    async fn tax_config(&self) -> (bool, String, String, String) {
        let rows: Vec<(String, serde_json::Value)> = sqlx::query_as(
            "SELECT setting_key, setting_value FROM system_settings \
             WHERE setting_key IN ('tax_enabled','tax_tra_api_url','tax_tra_api_key','tax_tra_secret_key')",
        )
        .fetch_all(&*self.state.db.pool())
        .await
        .unwrap_or_default();

        let mut enabled = false;
        let mut url = String::new();
        let mut key = String::new();
        let mut secret = String::new();
        for (k, v) in rows {
            match k.as_str() {
                "tax_enabled" => enabled = v.as_bool().unwrap_or(false),
                "tax_tra_api_url" => url = v.as_str().unwrap_or("").to_string(),
                "tax_tra_api_key" => key = v.as_str().unwrap_or("").to_string(),
                "tax_tra_secret_key" => secret = v.as_str().unwrap_or("").to_string(),
                _ => {}
            }
        }
        (enabled, url, key, secret)
    }

    /// Submit an invoice to TRA. No-op when tax/TRA isn't configured.
    pub async fn submit_invoice(&self, invoice_id: Uuid) -> AppResult<()> {
        let (enabled, api_url, api_key, secret) = self.tax_config().await;
        if !enabled || api_url.trim().is_empty() {
            return Ok(());
        }

        let row = sqlx::query(
            "SELECT invoice_number, amount_tsh, tax_amount_tsh, tax_rate_percent, organization_id \
             FROM billing_invoices WHERE id = $1",
        )
        .bind(invoice_id)
        .fetch_optional(&*self.state.db.pool())
        .await?
        .ok_or_else(|| AppError::NotFound("Invoice not found".to_string()))?;

        let invoice_number: String = row.try_get("invoice_number")?;
        let amount: i64 = row.try_get("amount_tsh")?;
        let tax: i64 = row.try_get("tax_amount_tsh")?;
        let rate: f64 = row.try_get("tax_rate_percent")?;
        let org_id: Uuid = row.try_get("organization_id")?;

        // NOTE: adjust this payload to TRA's current e-invoice API spec.
        let body = json!({
            "invoice_number": invoice_number,
            "organization_id": org_id.to_string(),
            "amount_tsh": amount,
            "tax_amount_tsh": tax,
            "tax_rate_percent": rate,
            "currency": "TZS",
        });

        let credentials = base64::engine::general_purpose::STANDARD.encode(format!("{api_key}:{secret}"));
        let resp = self
            .client
            .post(&api_url)
            .header("Authorization", format!("Basic {credentials}"))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("TRA submission failed: {e}")))?;

        tracing::info!(
            invoice_id = %invoice_id,
            status = %resp.status(),
            "TRA e-invoice submission attempt"
        );
        Ok(())
    }
}
