use crate::{
    error::AppResult,
    services::{sms::SmsService, whatsapp::WhatsappService},
};

#[derive(Debug, Clone)]
pub struct DeliveryAttempt {
    pub channel: String,
    pub success: bool,
    pub provider_message_id: Option<String>,
    pub error_message: Option<String>,
}

pub struct MessagingService {
    sms: SmsService,
    whatsapp: WhatsappService,
}

impl MessagingService {
    pub fn new() -> Self {
        Self {
            sms: SmsService::new(),
            whatsapp: WhatsappService::new(),
        }
    }

    pub async fn send(&self, channel: &str, to: &str, message: &str) -> AppResult<Vec<DeliveryAttempt>> {
        let normalized = channel.trim().to_lowercase();
        let mut attempts = Vec::new();

        match normalized.as_str() {
            "sms" => {
                attempts.push(self.send_sms(to, message).await);
            }
            "whatsapp" => {
                attempts.push(self.send_whatsapp(to, message).await);
            }
            "both" => {
                attempts.push(self.send_whatsapp(to, message).await);
                attempts.push(self.send_sms(to, message).await);
            }
            other => {
                attempts.push(DeliveryAttempt {
                    channel: other.to_string(),
                    success: false,
                    provider_message_id: None,
                    error_message: Some("Unsupported channel".to_string()),
                });
            }
        }

        Ok(attempts)
    }

    async fn send_sms(&self, to: &str, message: &str) -> DeliveryAttempt {
        match self.sms.send(to, message).await {
            Ok(result) => DeliveryAttempt {
                channel: "sms".to_string(),
                success: true,
                provider_message_id: result.message_id,
                error_message: None,
            },
            Err(err) => DeliveryAttempt {
                channel: "sms".to_string(),
                success: false,
                provider_message_id: None,
                error_message: Some(err.to_string()),
            },
        }
    }

    async fn send_whatsapp(&self, to: &str, message: &str) -> DeliveryAttempt {
        match self.whatsapp.send_text(to, message).await {
            Ok(result) => DeliveryAttempt {
                channel: "whatsapp".to_string(),
                success: true,
                provider_message_id: result.message_id,
                error_message: None,
            },
            Err(err) => DeliveryAttempt {
                channel: "whatsapp".to_string(),
                success: false,
                provider_message_id: None,
                error_message: Some(err.to_string()),
            },
        }
    }
}

impl Default for MessagingService {
    fn default() -> Self {
        Self::new()
    }
}
