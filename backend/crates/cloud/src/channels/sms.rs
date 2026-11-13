use async_trait::async_trait;
use crate::{
    channels::traits::{MessageChannel, ChannelKind, DeliveryReceipt, OutboundMessage},
    error::AppResult,
};

/// Legacy SMS channel used by the broadcast dispatcher's registry. SMS is now
/// handled by the unified `Channels` (Beem) in `services/channels.rs`; this
/// channel reports not-configured so the placeholder dispatcher doesn't crash.
pub struct SmsChannel;

impl SmsChannel {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl MessageChannel for SmsChannel {
    async fn send(&self, _message: &OutboundMessage) -> AppResult<DeliveryReceipt> {
        Ok(DeliveryReceipt {
            channel: ChannelKind::Sms,
            success: false,
            provider_message_id: None,
            error_message: Some(
                "SMS is handled by the unified Channels (Beem) — legacy channel not wired".to_string(),
            ),
            raw_response: None,
        })
    }

    fn kind(&self) -> ChannelKind {
        ChannelKind::Sms
    }
}
