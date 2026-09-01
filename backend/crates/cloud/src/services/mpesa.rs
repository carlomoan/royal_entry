// ==============================================================================
// FILE: src/services/mpesa.rs
// ==============================================================================
use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use crate::error::{AppError, AppResult};
use crate::AppState;

fn env(key: &str) -> AppResult<String> {
    std::env::var(key).map_err(|_| {
        tracing::error!(key = key, "Missing required environment variable");
        AppError::InternalServerError
    })
}

#[derive(Debug, Clone)]
struct CachedToken {
    token: String,
    expires_at: Instant,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "PascalCase")]
struct StkPushRequest {
    business_short_code: String,
    password: String,
    timestamp: String,
    transaction_type: String,
    amount: u64,
    party_a: String,
    party_b: String,
    phone_number: String,
    call_back_url: String,
    account_reference: String,
    transaction_desc: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct StkPushResponse {
    pub merchant_request_id: String,
    pub checkout_request_id: String,
    pub response_code: String,
    pub response_description: String,
    pub customer_message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "PascalCase")]
struct StkQueryRequest {
    business_short_code: String,
    password: String,
    timestamp: String,
    checkout_request_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct StkQueryResponse {
    pub merchant_request_id: String,
    pub checkout_request_id: String,
    pub response_code: String,
    pub response_description: String,
    pub result_code: String,
    pub result_desc: String,
}

#[derive(Debug, Deserialize)]
struct OAuthResponse {
    access_token: String,
    expires_in: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct MpesaCallback {
    pub body: CallbackBody,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct CallbackBody {
    pub stk_callback: StkCallback,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct StkCallback {
    pub merchant_request_id: String,
    pub checkout_request_id: String,
    pub result_code: i32,
    pub result_desc: String,
    pub callback_metadata: Option<CallbackMetadata>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct CallbackMetadata {
    pub item: Vec<CallbackItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct CallbackItem {
    pub name: String,
    pub value: Option<serde_json::Value>,
}

#[derive(Debug)]
pub struct MpesaPaymentResult {
    pub checkout_request_id: String,
    pub mpesa_receipt_number: String,
    pub amount: u64,
    pub phone_number: String,
    pub transaction_date: String,
}

#[derive(Clone)]
pub struct MpesaService {
    client: Client,
    token_cache: Arc<Mutex<Option<CachedToken>>>,
}

impl MpesaService {
    pub fn new(_state: Arc<AppState>) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .expect("Failed to build HTTP client"),
            token_cache: Arc::new(Mutex::new(None)),
        }
    }

    fn base_url() -> AppResult<String> {
        let env_str = env("MPESA_ENVIRONMENT").unwrap_or_else(|_| "sandbox".to_string());
        Ok(match env_str.as_str() {
            "production" => "https://api.safaricom.co.tz".to_string(),
            _ => "https://sandbox.safaricom.co.tz".to_string(),
        })
    }

    fn stk_password(shortcode: &str, passkey: &str, timestamp: &str) -> String {
        STANDARD.encode(format!("{}{}{}", shortcode, passkey, timestamp))
    }

    fn timestamp() -> String {
        Utc::now().format("%Y%m%d%H%M%S").to_string()
    }

    pub fn normalize_phone(phone: &str) -> String {
        let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
        if digits.starts_with("255") {
            digits
        } else if digits.starts_with('0') {
            format!("255{}", &digits[1..])
        } else {
            digits
        }
    }

    pub async fn access_token(&self) -> AppResult<String> {
        let mut cache = self.token_cache.lock().await;
        if let Some(ref cached) = *cache {
            if cached.expires_at > Instant::now() + Duration::from_secs(60) {
                return Ok(cached.token.clone());
            }
        }

        let consumer_key = env("MPESA_CONSUMER_KEY")?;
        let consumer_secret = env("MPESA_CONSUMER_SECRET")?;
        let credentials = STANDARD.encode(format!("{}:{}", consumer_key, consumer_secret));
        let base_url = Self::base_url()?;

        let response = self
            .client
            .get(format!(
                "{}/oauth/v1/generate?grant_type=client_credentials",
                base_url
            ))
            .header("Authorization", format!("Basic {}", credentials))
            .send()
            .await
            .map_err(|e| {
                tracing::error!("M-Pesa OAuth request failed: {}", e);
                AppError::MpesaError("OAuth request failed".to_string())
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::error!(status = %status, body = %body, "M-Pesa OAuth failed");
            return Err(AppError::MpesaError(format!(
                "OAuth failed with status {}",
                status
            )));
        }

        let oauth: OAuthResponse = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse OAuth response: {}", e);
            AppError::MpesaError("Invalid OAuth response".to_string())
        })?;

        let expires_secs: u64 = oauth.expires_in.parse().unwrap_or(3600);
        *cache = Some(CachedToken {
            token: oauth.access_token.clone(),
            expires_at: Instant::now() + Duration::from_secs(expires_secs),
        });
        tracing::debug!(
            "M-Pesa OAuth token refreshed (expires in {}s)",
            expires_secs
        );
        Ok(oauth.access_token)
    }

    pub async fn stk_push(
        &self,
        phone: &str,
        amount_tsh: u64,
        reference: &str,
        description: &str,
    ) -> AppResult<StkPushResponse> {
        let shortcode = env("MPESA_SHORTCODE")?;
        let passkey = env("MPESA_PASSKEY")?;
        let callback = format!(
            "{}/api/v1/payments/mpesa/callback",
            env("APP_URL").unwrap_or_else(|_| "http://localhost:3000".to_string())
        );
        let base_url = Self::base_url()?;
        let timestamp = Self::timestamp();
        let password = Self::stk_password(&shortcode, &passkey, &timestamp);
        let phone_norm = Self::normalize_phone(phone);
        let reference_trimmed = if reference.len() > 12 {
            &reference[..12]
        } else {
            reference
        };
        let token = self.access_token().await?;

        let body = StkPushRequest {
            business_short_code: shortcode.clone(),
            password,
            timestamp,
            transaction_type: "CustomerBuyGoodsOnline".to_string(),
            amount: amount_tsh,
            party_a: phone_norm.clone(),
            party_b: shortcode,
            phone_number: phone_norm,
            call_back_url: callback,
            account_reference: reference_trimmed.to_string(),
            transaction_desc: description.chars().take(20).collect(),
        };

        tracing::info!(
            phone = phone,
            amount = amount_tsh,
            reference = reference,
            "Initiating M-Pesa STK Push"
        );

        let response = self
            .client
            .post(format!("{}/mpesa/stkpush/v1/processrequest", base_url))
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("STK Push request failed: {}", e);
                AppError::MpesaError("STK Push request failed".to_string())
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            tracing::error!(status = %status, body = %text, "STK Push rejected");
            return Err(AppError::MpesaError(format!(
                "STK Push rejected: {}",
                text
            )));
        }

        let stk_response: StkPushResponse = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse STK Push response: {}", e);
            AppError::MpesaError("Invalid STK Push response".to_string())
        })?;

        if stk_response.response_code != "0" {
            tracing::error!(
                code = %stk_response.response_code,
                desc = %stk_response.response_description,
                "STK Push failed"
            );
            return Err(AppError::MpesaError(
                stk_response.response_description.clone(),
            ));
        }

        tracing::info!(
            checkout_request_id = %stk_response.checkout_request_id,
            "STK Push initiated successfully"
        );
        Ok(stk_response)
    }

    pub async fn query_stk_status(
        &self,
        checkout_request_id: &str,
    ) -> AppResult<StkQueryResponse> {
        let shortcode = env("MPESA_SHORTCODE")?;
        let passkey = env("MPESA_PASSKEY")?;
        let base_url = Self::base_url()?;
        let timestamp = Self::timestamp();
        let password = Self::stk_password(&shortcode, &passkey, &timestamp);
        let token = self.access_token().await?;

        let body = StkQueryRequest {
            business_short_code: shortcode,
            password,
            timestamp,
            checkout_request_id: checkout_request_id.to_string(),
        };

        let response = self
            .client
            .post(format!("{}/mpesa/stkpushquery/v1/query", base_url))
            .bearer_auth(&token)
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("STK query request failed: {}", e);
                AppError::MpesaError("STK query failed".to_string())
            })?;

        let query: StkQueryResponse = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse STK query response: {}", e);
            AppError::MpesaError("Invalid STK query response".to_string())
        })?;

        tracing::debug!(
            checkout_request_id = checkout_request_id,
            result_code = %query.result_code,
            result_desc = %query.result_desc,
            "STK status queried"
        );
        Ok(query)
    }

    pub fn extract_callback(
        callback: &MpesaCallback,
    ) -> AppResult<Option<MpesaPaymentResult>> {
        let stk = &callback.body.stk_callback;
        tracing::info!(
            checkout_request_id = %stk.checkout_request_id,
            result_code = stk.result_code,
            result_desc = %stk.result_desc,
            "M-Pesa callback received"
        );

        if stk.result_code != 0 {
            tracing::warn!(
                code = stk.result_code,
                desc = %stk.result_desc,
                "M-Pesa payment not successful"
            );
            return Ok(None);
        }

        let metadata = stk
            .callback_metadata
            .as_ref()
            .ok_or_else(|| AppError::MpesaError("Missing callback metadata".to_string()))?;

        let find = |name: &str| -> Option<String> {
            metadata
                .item
                .iter()
                .find(|i| i.name == name)
                .and_then(|i| i.value.as_ref())
                .map(|v| match v {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Number(n) => n.to_string(),
                    other => other.to_string(),
                })
        };

        let amount = find("Amount")
            .and_then(|s| s.parse::<f64>().ok())
            .map(|f| f as u64)
            .ok_or_else(|| AppError::MpesaError("Missing Amount in callback".to_string()))?;

        let receipt = find("MpesaReceiptNumber")
            .ok_or_else(|| AppError::MpesaError("Missing MpesaReceiptNumber".to_string()))?;

        let phone = find("PhoneNumber").unwrap_or_default();
        let transaction_date = find("TransactionDate")
            .unwrap_or_else(|| Utc::now().format("%Y%m%d%H%M%S").to_string());

        Ok(Some(MpesaPaymentResult {
            checkout_request_id: stk.checkout_request_id.clone(),
            mpesa_receipt_number: receipt,
            amount,
            phone_number: phone,
            transaction_date,
        }))
    }
}

impl Default for MpesaService {
    fn default() -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .expect("Failed to build HTTP client"),
            token_cache: Arc::new(Mutex::new(None)),
        }
    }
}
