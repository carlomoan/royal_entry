use crate::{
    channels::traits::{ChannelKind, DeliveryReceipt, MessageChannel, OutboundMessage},
    error::{AppError, AppResult},
};
use async_trait::async_trait;
use lettre::{
    message::{header::ContentType, Mailbox, Message},
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Tokio1Executor,
};

#[derive(Clone)]
pub struct EmailChannel {
    smtp_host: String,
    smtp_port: u16,
    smtp_user: String,
    smtp_pass: String,
    smtp_from: String,
    smtp_from_name: String,
}

impl EmailChannel {
    pub fn new() -> Self {
        Self {
            smtp_host: std::env::var("SMTP_HOST")
                .unwrap_or_else(|_| "smtp-mail.outlook.com".to_string()),
            smtp_port: std::env::var("SMTP_PORT")
                .unwrap_or_else(|_| "587".to_string())
                .parse()
                .unwrap_or(587),
            smtp_user: std::env::var("SMTP_USER")
                .unwrap_or_else(|_| "agbbelly89@outlook.com".to_string()),
            smtp_pass: std::env::var("SMTP_PASS")
                .or_else(|_| std::env::var("SMTP_PASSWORD"))
                .unwrap_or_else(|_| "".to_string()),
            smtp_from: std::env::var("SMTP_FROM")
                .or_else(|_| std::env::var("SMTP_FROM_ADDRESS"))
                .unwrap_or_else(|_| "agbbelly89@outlook.com".to_string()),
            smtp_from_name: std::env::var("SMTP_FROM_NAME")
                .unwrap_or_else(|_| "RoyalEntry".to_string()),
        }
    }

    pub fn with_credentials(
        host: String,
        port: u16,
        user: String,
        pass: String,
        from: String,
        from_name: String,
    ) -> Self {
        Self {
            smtp_host: host,
            smtp_port: port,
            smtp_user: user,
            smtp_pass: pass,
            smtp_from: from,
            smtp_from_name: from_name,
        }
    }
}

#[async_trait]
impl MessageChannel for EmailChannel {
    async fn send(&self, message: &OutboundMessage) -> AppResult<DeliveryReceipt> {
        if self.smtp_host.is_empty() || self.smtp_from.is_empty() {
            return Err(AppError::EmailError(
                "SMTP_HOST and SMTP_FROM must be configured".to_string(),
            ));
        }

        let from_display = format!("{} <{}>", self.smtp_from_name, self.smtp_from);
        let from: Mailbox = from_display
            .parse()
            .map_err(|error| AppError::EmailError(format!("Invalid SMTP_FROM address: {error}")))?;

        let to: Mailbox = message
            .to
            .parse()
            .map_err(|error| AppError::EmailError(format!("Invalid recipient address: {error}")))?;

        let email = if message.attachments.is_empty() {
            // Plain text email without attachments
            Message::builder()
                .from(from)
                .to(to)
                .subject("RoyalEntry Invitation")
                .header(ContentType::TEXT_PLAIN)
                .body(message.body.clone())
                .map_err(|error| AppError::EmailError(error.to_string()))?
        } else {
            // Email with card attachments - embed as base64 images in HTML
            let mut html_body = format!(
                r#"
                <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <p>{}</p>
                    <h3 style="color: #1e3a5f;">Your Invitation Card</h3>
                "#,
                message.body.replace('\n', "<br>")
            );

            for attachment in &message.attachments {
                if attachment.mime_type == "image/png" {
                    // Embed as base64 image
                    html_body.push_str(&format!(
                        r#"<p><img src="data:image/png;base64,{}" alt="Invitation Card" style="max-width: 100%; border: 1px solid #ddd; border-radius: 8px;"></p>"#,
                        attachment.url
                    ));
                }
            }

            html_body.push_str(
                r#"
                    <p style="margin-top: 20px; color: #666; font-size: 12px;">
                        This invitation was sent by RoyalEntry. Show this card at the event entrance for check-in.
                    </p>
                </body>
                </html>
                "#
            );

            Message::builder()
                .from(from)
                .to(to)
                .subject("RoyalEntry Invitation")
                .header(ContentType::TEXT_HTML)
                .body(html_body)
                .map_err(|error| AppError::EmailError(error.to_string()))?
        };

        let credentials = Credentials::new(self.smtp_user.clone(), self.smtp_pass.clone());
        let transport = AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&self.smtp_host)
            .map_err(|error| {
                AppError::EmailError(format!("Failed to create SMTP transport: {error}"))
            })?
            .port(self.smtp_port)
            .credentials(credentials)
            .build();

        transport
            .send(email)
            .await
            .map_err(|error| AppError::EmailError(format!("SMTP delivery failed: {error}")))?;

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
