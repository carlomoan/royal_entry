use async_trait::async_trait;
use crate::{
    channels::traits::{MessageChannel, ChannelKind, DeliveryReceipt, OutboundMessage},
    error::AppResult,
};

/// Legacy registry channel. Production WhatsApp delivery goes through
/// `services::channels::Channels` (Meta Cloud API or NextSMS). This stub only
/// exists so the unused registry keeps compiling; it never sends anything.
pub struct WhatsAppChannel;

impl WhatsAppChannel {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl MessageChannel for WhatsAppChannel {
    async fn send(&self, _message: &OutboundMessage) -> AppResult<DeliveryReceipt> {
        Ok(DeliveryReceipt {
            channel: ChannelKind::WhatsApp,
            success: false,
            provider_message_id: None,
            error_message: Some(
                "WhatsApp is handled by the unified Channels service (NextSMS/Meta)".to_string(),
            ),
            raw_response: None,
        })
    }

    fn kind(&self) -> ChannelKind {
        ChannelKind::WhatsApp
    }
}
