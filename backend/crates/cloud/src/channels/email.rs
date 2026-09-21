use async_trait::async_trait;
use crate::{
    channels::traits::{MessageChannel, ChannelKind, DeliveryReceipt, OutboundMessage},
    error::AppResult,
};

pub struct EmailChannel {
    smtp_host: String,
    smtp_port: u16,
    smtp_user: String,
    smtp_pass: String,
}

impl EmailChannel {
    pub fn new() -> Self {
        Self {
            smtp_host: std::env::var("SMTP_HOST").unwrap_or_else(|_| "localhost".to_string()),
            smtp_port: std::env::var("SMTP_PORT").unwrap_or_else(|_| "587".to_string()).parse().unwrap_or(587),
            smtp_user: std::env::var("SMTP_USER").unwrap_or_default(),
            smtp_pass: std::env::var("SMTP_PASS").unwrap_or_default(),
        }
    }
}

#[async_trait]
impl MessageChannel for EmailChannel {
    async fn send(&self, message: &OutboundMessage) -> AppResult<DeliveryReceipt> {
        // Placeholder: integrate with lettre crate for SMTP delivery
        // For now, return a simulated receipt
        Ok(DeliveryReceipt {
            channel: ChannelKind::Email,
            success: true,
            provider_message_id: Some(format!("email_{}", message.to)),
            error_message: None,
            raw_response: Some("SMTP queued".to_string()),
        })
    }

    fn kind(&self) -> ChannelKind {
        ChannelKind::Email
    }
}
