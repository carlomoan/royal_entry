use async_trait::async_trait;
use crate::{
    channels::traits::{MessageChannel, ChannelKind, DeliveryReceipt, OutboundMessage},
    error::AppResult,
    services::sms::SmsService,
};

pub struct SmsChannel {
    service: SmsService,
}

impl SmsChannel {
    pub fn new() -> Self {
        Self { service: SmsService::new() }
    }
}

#[async_trait]
impl MessageChannel for SmsChannel {
    async fn send(&self, message: &OutboundMessage) -> AppResult<DeliveryReceipt> {
        match self.service.send(&message.to, &message.body).await {
            Ok(result) => Ok(DeliveryReceipt {
                channel: ChannelKind::Sms,
                success: true,
                provider_message_id: result.message_id,
                error_message: None,
                raw_response: None,
            }),
            Err(err) => Ok(DeliveryReceipt {
                channel: ChannelKind::Sms,
                success: false,
                provider_message_id: None,
                error_message: Some(err.to_string()),
                raw_response: None,
            }),
        }
    }

    fn kind(&self) -> ChannelKind {
        ChannelKind::Sms
    }
}
