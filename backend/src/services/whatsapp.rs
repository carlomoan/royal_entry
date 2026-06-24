use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::{error::{AppError, AppResult}, services::mpesa::MpesaService};

#[derive(Debug, Clone)]
pub struct WhatsappDeliveryResult {
    pub message_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct WhatsappTextBody<'a> {
    messaging_product: &'static str,
    recipient_type: &'static str,
    to: &'a str,
    r#type: &'static str,
    text: WhatsappTextPayload<'a>,
}

#[derive(Debug, Serialize)]
struct WhatsappTextPayload<'a> {
    preview_url: bool,
    body: &'a str,
}

#[derive(Debug, Deserialize)]
struct WhatsappResponse {
    messages: Option<Vec<WhatsappMessage>>,
}

#[derive(Debug, Deserialize)]
struct WhatsappMessage {
    id: String,
}

pub struct WhatsappService {
    client: Client,
}

impl WhatsappService {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    pub async fn send_text(&self, to: &str, message: &str) -> AppResult<WhatsappDeliveryResult> {
        let access_token = std::env::var("WHATSAPP_ACCESS_TOKEN")
            .map_err(|_| AppError::WhatsappError("WHATSAPP_ACCESS_TOKEN is not configured".to_string()))?;
        let phone_number_id = std::env::var("WHATSAPP_PHONE_NUMBER_ID")
            .map_err(|_| AppError::WhatsappError("WHATSAPP_PHONE_NUMBER_ID is not configured".to_string()))?;

        let normalized_phone = MpesaService::normalize_phone(to);
        let payload = WhatsappTextBody {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: &normalized_phone,
            r#type: "text",
            text: WhatsappTextPayload {
                preview_url: false,
                body: message,
            },
        };

        let response = self
            .client
            .post(format!("https://graph.facebook.com/v19.0/{}/messages", phone_number_id))
            .bearer_auth(access_token)
            .json(&payload)
            .send()
            .await
            .map_err(|e| AppError::WhatsappError(format!("WhatsApp request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::WhatsappError(format!("WhatsApp gateway returned {}: {}", status, body)));
        }

        let body: WhatsappResponse = response
            .json()
            .await
            .map_err(|e| AppError::WhatsappError(format!("Invalid WhatsApp gateway response: {}", e)))?;

        let message_id = body.messages.and_then(|mut messages| messages.pop().map(|m| m.id));

        Ok(WhatsappDeliveryResult { message_id })
    }
}

impl Default for WhatsappService {
    fn default() -> Self {
        Self::new()
    }
}
