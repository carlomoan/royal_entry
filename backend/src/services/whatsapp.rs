use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::{error::{AppError, AppResult}, services::mpesa::MpesaService};

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Clone)]
pub struct WhatsappService {
    client: Client,
}

impl WhatsappService {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    async fn access_token(&self) -> AppResult<String> {
        let consumer_key = std::env::var("WHATSAPP_CONSUMER_KEY")
            .map_err(|_| AppError::InternalServerError)?;
        let consumer_secret = std::env::var("WHATSAPP_CONSUMER_SECRET")
            .map_err(|_| AppError::InternalServerError)?;

        let response = self.client
            .get("https://graph.facebook.com/v17.0/oauth/access_token")
            .query(&[
                ("grant_type", "client_credentials"),
                ("client_id", &consumer_key),
                ("client_secret", &consumer_secret),
            ])
            .send()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        let json: serde_json::Value = response.json().await.map_err(|_| AppError::InternalServerError)?;
        json["access_token"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or(AppError::InternalServerError)
    }

    pub async fn send_message(&self, to: &str, message: &str) -> AppResult<WhatsappDeliveryResult> {
        let token = self.access_token().await?;
        let phone_number_id = std::env::var("WHATSAPP_PHONE_NUMBER_ID")
            .map_err(|_| AppError::InternalServerError)?;

        let body = WhatsappTextBody {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to,
            r#type: "text",
            text: WhatsappTextPayload {
                preview_url: false,
                body: message,
            },
        };

        let response = self.client
            .post(&format!("https://graph.facebook.com/v17.0/{}/messages", phone_number_id))
            .bearer_auth(token)
            .json(&body)
            .send()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        let json: serde_json::Value = response.json().await.map_err(|_| AppError::InternalServerError)?;

        let message_id = json["messages"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|msg| msg["id"].as_str())
            .map(|s| s.to_string());

        Ok(WhatsappDeliveryResult { message_id })
    }
}
