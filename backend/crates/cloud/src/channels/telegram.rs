use async_trait::async_trait;
use crate::{
    channels::traits::{MessageChannel, ChannelKind, DeliveryReceipt, OutboundMessage},
    error::AppResult,
};

#[derive(Clone)]
pub struct TelegramChannel {
    bot_token: String,
}

impl TelegramChannel {
    pub fn new() -> Self {
        Self {
            bot_token: std::env::var("TELEGRAM_BOT_TOKEN").unwrap_or_default(),
        }
    }
}

#[async_trait]
impl MessageChannel for TelegramChannel {
    async fn send(&self, message: &OutboundMessage) -> AppResult<DeliveryReceipt> {
        // Placeholder: integrate with teloxide crate
        if self.bot_token.is_empty() {
            return Ok(DeliveryReceipt {
                channel: ChannelKind::Telegram,
                success: false,
                provider_message_id: None,
                error_message: Some("TELEGRAM_BOT_TOKEN not configured".to_string()),
                raw_response: None,
            });
        }
        Ok(DeliveryReceipt {
            channel: ChannelKind::Telegram,
            success: true,
            provider_message_id: Some(format!("tg_{}", message.to)),
            error_message: None,
            raw_response: Some("Message sent".to_string()),
        })
    }

    fn kind(&self) -> ChannelKind {
        ChannelKind::Telegram
    }
}
