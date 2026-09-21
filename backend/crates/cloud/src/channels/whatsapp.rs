use async_trait::async_trait;
use crate::{
    channels::traits::{MessageChannel, ChannelKind, DeliveryReceipt, OutboundMessage},
    error::AppResult,
    services::whatsapp::WhatsappService,
};

pub struct WhatsAppChannel {
    service: WhatsappService,
}

impl WhatsAppChannel {
    pub fn new() -> Self {
        Self { service: WhatsappService::new() }
    }
}

#[async_trait]
impl MessageChannel for WhatsAppChannel {
    async fn send(&self, message: &OutboundMessage) -> AppResult<DeliveryReceipt> {
        match self.service.send_message(&message.to, &message.body).await {
            Ok(result) => Ok(DeliveryReceipt {
                channel: ChannelKind::WhatsApp,
                success: true,
                provider_message_id: result.message_id,
                error_message: None,
                raw_response: None,
            }),
            Err(err) => Ok(DeliveryReceipt {
                channel: ChannelKind::WhatsApp,
                success: false,
                provider_message_id: None,
                error_message: Some(err.to_string()),
                raw_response: None,
            }),
        }
    }

    fn kind(&self) -> ChannelKind {
        ChannelKind::WhatsApp
    }
}
