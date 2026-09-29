use crate::error::{AppError, AppResult};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use urlencoding::encode;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhatsappDeliveryResult {
    pub message_id: Option<String>,
    pub status: String,
}

#[derive(Clone)]
pub struct WhatsappService {
    client: Client,
    api_key: String,
}

impl WhatsappService {
    pub fn new() -> Self {
        let api_key = std::env::var("WHATSAPP_CALLMEBOT_API_KEY")
            .unwrap_or_else(|_| "your_api_key".to_string());

        Self {
            client: Client::new(),
            api_key,
        }
    }

    /// Send WhatsApp message using CallMeBot free API
    pub async fn send_message(&self, to: &str, message: &str) -> AppResult<WhatsappDeliveryResult> {
        let formatted_phone = to.trim_start_matches('+');
        let encoded_message = encode(message);

        let url = format!(
            "https://api.callmebot.com/whatsapp.php?phone={}&text={}&apikey={}",
            formatted_phone, encoded_message, self.api_key
        );

        let response = self.client.get(&url).send().await.map_err(|e| {
            AppError::ExternalApiError(format!("WhatsApp API request failed: {}", e))
        })?;

        if response.status().is_success() {
            let response_text = response.text().await.map_err(|e| {
                AppError::ExternalApiError(format!("Failed to read response: {}", e))
            })?;

            if response_text.contains("Message sent successfully") || response_text.contains("OK") {
                Ok(WhatsappDeliveryResult {
                    message_id: Some(format!(
                        "msg_{}",
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_secs()
                    )),
                    status: "sent".to_string(),
                })
            } else {
                Err(AppError::WhatsappError(format!(
                    "WhatsApp API error: {}",
                    response_text
                )))
            }
        } else {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());

            Err(AppError::WhatsappError(format!(
                "WhatsApp API failed with status {}: {}",
                status, error_text
            )))
        }
    }

    /// Send WhatsApp message with image attachment
    pub async fn send_image(
        &self,
        to: &str,
        image_url: &str,
        caption: Option<&str>,
    ) -> AppResult<WhatsappDeliveryResult> {
        let formatted_phone = to.trim_start_matches('+');
        let encoded_caption = encode(caption.unwrap_or(""));

        let url = format!(
            "https://api.callmebot.com/whatsapp.php?phone={}&image={}&caption={}&apikey={}",
            formatted_phone, image_url, encoded_caption, self.api_key
        );

        // ✅ FIXED: Changed InternalServerError to WhatsappError
        let response = self.client.get(&url).send().await.map_err(|e| {
            AppError::WhatsappError(format!("WhatsApp image API request failed: {}", e))
        })?;

        if response.status().is_success() {
            let response_text = response
                .text()
                .await
                .map_err(|e| AppError::WhatsappError(format!("Failed to read response: {}", e)))?;

            if response_text.contains("Message sent successfully") || response_text.contains("OK") {
                Ok(WhatsappDeliveryResult {
                    message_id: Some(format!(
                        "img_{}",
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_secs()
                    )),
                    status: "sent".to_string(),
                })
            } else {
                Err(AppError::WhatsappError(format!(
                    "WhatsApp image API error: {}",
                    response_text
                )))
            }
        } else {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());

            Err(AppError::WhatsappError(format!(
                "WhatsApp image API failed with status {}: {}",
                status, error_text
            )))
        }
    }

    /// Send WhatsApp message with file/document attachment
    pub async fn send_file(
        &self,
        to: &str,
        file_url: &str,
        filename: Option<&str>,
    ) -> AppResult<WhatsappDeliveryResult> {
        let formatted_phone = to.trim_start_matches('+');
        let encoded_filename = encode(filename.unwrap_or("document"));

        let url = format!(
            "https://api.callmebot.com/whatsapp.php?phone={}&file={}&filename={}&apikey={}",
            formatted_phone, file_url, encoded_filename, self.api_key
        );

        // ✅ FIXED: Changed InternalServerError to WhatsappError
        let response = self.client.get(&url).send().await.map_err(|e| {
            AppError::WhatsappError(format!("WhatsApp file API request failed: {}", e))
        })?;

        if response.status().is_success() {
            let response_text = response
                .text()
                .await
                .map_err(|e| AppError::WhatsappError(format!("Failed to read response: {}", e)))?;

            if response_text.contains("Message sent successfully") || response_text.contains("OK") {
                Ok(WhatsappDeliveryResult {
                    message_id: Some(format!(
                        "file_{}",
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_secs()
                    )),
                    status: "sent".to_string(),
                })
            } else {
                Err(AppError::WhatsappError(format!(
                    "WhatsApp file API error: {}",
                    response_text
                )))
            }
        } else {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());

            Err(AppError::WhatsappError(format!(
                "WhatsApp file API failed with status {}: {}",
                status, error_text
            )))
        }
    }
}
