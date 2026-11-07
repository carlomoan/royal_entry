use crate::{
    channels::traits::Attachment,
    error::AppResult,
    services::channels::{html_wrap, Channels},
};

#[derive(Debug, Clone)]
pub struct DeliveryAttempt {
    pub channel: String,
    pub success: bool,
    pub provider_message_id: Option<String>,
    pub error_message: Option<String>,
}

/// Single sending path for every outbound channel. Built once from the
/// environment via `Channels::from_env()`; channels without credentials are
/// reported as failed attempts rather than errors, so callers can carry on.
#[derive(Clone)]
pub struct MessagingService {
    channels: Channels,
}

impl MessagingService {
    pub fn new() -> Self {
        Self { channels: Channels::from_env() }
    }

    pub fn with_channels(channels: Channels) -> Self {
        Self { channels }
    }

    pub fn channels(&self) -> &Channels {
        &self.channels
    }

    pub async fn send(
        &self,
        channel: &str,
        to: &str,
        message: &str,
    ) -> AppResult<Vec<DeliveryAttempt>> {
        self.send_with_attachments(channel, to, message, Vec::new())
            .await
    }

    pub async fn send_with_attachments(
        &self,
        channel: &str,
        to: &str,
        message: &str,
        _attachments: Vec<Attachment>,
    ) -> AppResult<Vec<DeliveryAttempt>> {
        let normalized = channel.trim().to_lowercase();
        let mut attempts = Vec::new();

        match normalized.as_str() {
            "sms" => {
                attempts.push(
                    self.attempt(
                        "sms",
                        self.channels
                            .sms(&[to.to_string()], message)
                            .await
                            .map(|receipts| receipts.into_iter().next().unwrap_or_default()),
                    ),
                );
            }
            "whatsapp" => {
                // NOTE: media (card PNG) delivery is not implemented yet —
                // the message body carries the check-in link instead.
                attempts.push(
                    self.attempt("whatsapp", self.channels.whatsapp_text(to, message).await),
                );
            }
            "email" => {
                attempts.push(
                    self.attempt(
                        "email",
                        self.channels.email(to, "RoyalEntry", &html_wrap(message)).await,
                    ),
                );
            }
            "telegram" => {
                attempts.push(self.attempt("telegram", self.channels.telegram(to, message).await));
            }
            "both" => {
                attempts.push(
                    self.attempt("whatsapp", self.channels.whatsapp_text(to, message).await),
                );
                attempts.push(
                    self.attempt(
                        "sms",
                        self.channels
                            .sms(&[to.to_string()], message)
                            .await
                            .map(|receipts| receipts.into_iter().next().unwrap_or_default()),
                    ),
                );
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

    fn attempt(
        &self,
        channel: &str,
        result: AppResult<crate::services::channels::ProviderReceipt>,
    ) -> DeliveryAttempt {
        match result {
            Ok(receipt) => DeliveryAttempt {
                channel: channel.to_string(),
                success: receipt.success,
                provider_message_id: receipt.provider_id,
                error_message: receipt.error,
            },
            Err(error) => DeliveryAttempt {
                channel: channel.to_string(),
                success: false,
                provider_message_id: None,
                error_message: Some(error.to_string()),
            },
        }
    }
}

impl Default for MessagingService {
    fn default() -> Self {
        Self::new()
    }
}
