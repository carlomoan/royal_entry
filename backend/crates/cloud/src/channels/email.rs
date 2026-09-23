use async_trait::async_trait;
use lettre::{
    message::{header::ContentType, Mailbox, Message},
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Tokio1Executor,
};
use crate::{
    channels::traits::{MessageChannel, ChannelKind, DeliveryReceipt, OutboundMessage},
    error::{AppError, AppResult},
};

#[derive(Clone)]
pub struct EmailChannel {
    smtp_host: String,
    smtp_port: u16,
    smtp_user: String,
    smtp_pass: String,
    smtp_from: String,
}

impl EmailChannel {
    pub fn new() -> Self {
        Self {
            smtp_host: std::env::var("SMTP_HOST").unwrap_or_else(|_| "localhost".to_string()),
            smtp_port: std::env::var("SMTP_PORT").unwrap_or_else(|_| "587".to_string()).parse().unwrap_or(587),
            smtp_user: std::env::var("SMTP_USER").unwrap_or_default(),
            smtp_pass: std::env::var("SMTP_PASS")
                .or_else(|_| std::env::var("SMTP_PASSWORD"))
                .unwrap_or_default(),
            smtp_from: std::env::var("SMTP_FROM")
                .or_else(|_| std::env::var("SMTP_FROM_ADDRESS"))
                .unwrap_or_default(),
        }
    }
}

#[async_trait]
impl MessageChannel for EmailChannel {
    async fn send(&self, message: &OutboundMessage) -> AppResult<DeliveryReceipt> {
        if self.smtp_host.is_empty() || self.smtp_from.is_empty() {
            return Err(AppError::EmailError(
                "SMTP_HOST and SMTP_FROM (or SMTP_USER) must be configured".to_string(),
            ));
        }

        let from: Mailbox = self.smtp_from.parse().map_err(|error| {
            AppError::EmailError(format!("Invalid SMTP_FROM address: {error}"))
        })?;
        let to: Mailbox = message.to.parse().map_err(|error| {
            AppError::EmailError(format!("Invalid recipient address: {error}"))
        })?;
        let email = Message::builder()
            .from(from)
            .to(to)
            .subject("RoyalEntry invitation")
            .header(ContentType::TEXT_PLAIN)
            .body(message.body.clone())
            .map_err(|error| AppError::EmailError(error.to_string()))?;

        let transport = if self.smtp_user.is_empty() {
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&self.smtp_host)
                .port(self.smtp_port)
                .build()
        } else {
            let credentials = Credentials::new(self.smtp_user.clone(), self.smtp_pass.clone());
            AsyncSmtpTransport::<Tokio1Executor>::relay(&self.smtp_host)
                .map_err(|error| AppError::EmailError(error.to_string()))?
                .port(self.smtp_port)
                .credentials(credentials)
                .build()
        };

        transport.send(email).await.map_err(|error| {
            AppError::EmailError(format!("SMTP delivery failed: {error}"))
        })?;

        Ok(DeliveryReceipt {
            channel: ChannelKind::Email,
            success: true,
            provider_message_id: Some(format!("smtp_{}", uuid::Uuid::new_v4())),
            error_message: None,
            raw_response: Some("SMTP accepted message".to_string()),
        })
    }

    fn kind(&self) -> ChannelKind {
        ChannelKind::Email
    }
}
