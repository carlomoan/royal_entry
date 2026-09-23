use crate::{
    error::AppResult,
    channels::{email::EmailChannel, telegram::TelegramChannel, traits::{MessageChannel, OutboundMessage}},
    services::{sms::SmsService, whatsapp::WhatsappService},
};

#[derive(Debug, Clone)]
pub struct DeliveryAttempt {
    pub channel: String,
    pub success: bool,
    pub provider_message_id: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Clone)]
pub struct MessagingService {
    sms: SmsService,
    whatsapp: WhatsappService,
    email: EmailChannel,
    telegram: TelegramChannel,
}

impl MessagingService {
    pub fn new() -> Self {
        Self {
            sms: SmsService::new(),
            whatsapp: WhatsappService::new(),
            email: EmailChannel::new(),
            telegram: TelegramChannel::new(),
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
            "email" => {
                let result = self.email.send(&OutboundMessage {
                    to: to.to_string(),
                    body: message.to_string(),
                    attachments: Vec::new(),
                }).await;
                attempts.push(match result {
                    Ok(receipt) => DeliveryAttempt {
                        channel: "email".to_string(),
                        success: receipt.success,
                        provider_message_id: receipt.provider_message_id,
                        error_message: receipt.error_message,
                    },
                    Err(error) => DeliveryAttempt {
                        channel: "email".to_string(),
                        success: false,
                        provider_message_id: None,
                        error_message: Some(error.to_string()),
                    },
                });
            }
            "telegram" => {
                let result = self.telegram.send(&OutboundMessage {
                    to: to.to_string(),
                    body: message.to_string(),
                    attachments: Vec::new(),
                }).await;
                attempts.push(match result {
                    Ok(receipt) => DeliveryAttempt {
                        channel: "telegram".to_string(),
                        success: receipt.success,
                        provider_message_id: receipt.provider_message_id,
                        error_message: receipt.error_message,
                    },
                    Err(error) => DeliveryAttempt {
                        channel: "telegram".to_string(),
                        success: false,
                        provider_message_id: None,
                        error_message: Some(error.to_string()),
                    },
                });
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
        match self.whatsapp.send_message(to, message).await {
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
