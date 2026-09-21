use async_trait::async_trait;
use crate::error::AppResult;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ChannelKind {
    Sms,
    WhatsApp,
    Email,
    Telegram,
}

#[derive(Debug, Clone)]
pub struct DeliveryReceipt {
    pub channel: ChannelKind,
    pub success: bool,
    pub provider_message_id: Option<String>,
    pub error_message: Option<String>,
    pub raw_response: Option<String>,
}

#[derive(Debug, Clone)]
pub struct OutboundMessage {
    pub to: String,
    pub body: String,
    pub attachments: Vec<Attachment>,
}

#[derive(Debug, Clone)]
pub struct Attachment {
    pub file_id: String,
    pub url: String,
    pub mime_type: String,
}

#[async_trait]
pub trait MessageChannel: Send + Sync {
    async fn send(&self, message: &OutboundMessage) -> AppResult<DeliveryReceipt>;
    fn kind(&self) -> ChannelKind;
}
