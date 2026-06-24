use reqwest::Client;
use serde::Deserialize;
use url::form_urlencoded;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct SmsDeliveryResult {
    pub message_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AtResponse {
    #[serde(rename = "SMSMessageData")]
    sms_message_data: AtMessageData,
}

#[derive(Debug, Deserialize)]
struct AtMessageData {
    #[serde(rename = "Recipients")]
    recipients: Vec<AtRecipient>,
}

#[derive(Debug, Deserialize)]
struct AtRecipient {
    status: String,
    #[serde(rename = "messageId")]
    message_id: Option<String>,
}

pub struct SmsService {
    client: Client,
}

impl SmsService {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    pub async fn send(&self, to: &str, message: &str) -> AppResult<SmsDeliveryResult> {
        let api_key = std::env::var("AT_API_KEY").map_err(|_| AppError::SmsError("AT_API_KEY is not configured".to_string()))?;
        let username = std::env::var("AT_USERNAME").map_err(|_| AppError::SmsError("AT_USERNAME is not configured".to_string()))?;
        let from_name = std::env::var("AT_FROM_NAME").unwrap_or_else(|_| "RoyalEntry".to_string());

        let encoded_body = {
            let mut serializer = form_urlencoded::Serializer::new(String::new());
            serializer.append_pair("username", &username);
            serializer.append_pair("to", to);
            serializer.append_pair("message", message);
            if !from_name.trim().is_empty() {
                serializer.append_pair("from", &from_name);
            }
            serializer.finish()
        };

        let response = self
            .client
            .post("https://api.africastalking.com/version1/messaging")
            .header("apiKey", api_key)
            .header("Accept", "application/json")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(encoded_body)
            .send()
            .await
            .map_err(|e| AppError::SmsError(format!("SMS request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::SmsError(format!("SMS gateway returned {}: {}", status, body)));
        }

        let body: AtResponse = response
            .json()
            .await
            .map_err(|e| AppError::SmsError(format!("Invalid SMS gateway response: {}", e)))?;

        let recipient = body
            .sms_message_data
            .recipients
            .into_iter()
            .next()
            .ok_or_else(|| AppError::SmsError("SMS gateway returned no recipients".to_string()))?;

        if !recipient.status.to_lowercase().contains("success") {
            return Err(AppError::SmsError(format!("SMS delivery failed: {}", recipient.status)));
        }

        Ok(SmsDeliveryResult {
            message_id: recipient.message_id,
        })
    }
}

impl Default for SmsService {
    fn default() -> Self {
        Self::new()
    }
}
