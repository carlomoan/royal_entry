//! Email channel used by the broadcast dispatcher (via channels/registry.rs).
//!
//! Sends through the Resend HTTP API, the same provider as services/channels.rs,
//! so both code paths read the same two variables:
//!   RESEND_API_KEY   API key (starts with "re_")
//!   EMAIL_FROM       e.g. RoyalEntry <noreply@royalentry.foctek.co.tz>
//!
//! Replaces the old SMTP sender, which defaulted to an Outlook mailbox with an
//! empty password. Nothing here has a built-in address or fallback host.
//!
//! NOT compiled against your crate; adjust imports if cargo check complains.

use crate::{
    channels::traits::{ChannelKind, DeliveryReceipt, MessageChannel, OutboundMessage},
    error::{AppError, AppResult},
};
use async_trait::async_trait;
use serde_json::{json, Value};
use std::time::Duration;

const SUBJECT: &str = "RoyalEntry Invitation";

#[derive(Clone)]
pub struct EmailChannel {
    client: reqwest::Client,
    api_key: Option<String>,
    from: Option<String>,
}

fn env_nonempty(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

impl EmailChannel {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap_or_default(),
            api_key: env_nonempty("RESEND_API_KEY"),
            from: env_nonempty("EMAIL_FROM"),
        }
    }
}

impl Default for EmailChannel {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MessageChannel for EmailChannel {
    async fn send(&self, message: &OutboundMessage) -> AppResult<DeliveryReceipt> {
        let api_key = self.api_key.as_deref().ok_or_else(|| {
            AppError::EmailError("Email is not configured: RESEND_API_KEY is missing".into())
        })?;
        let from = self.from.as_deref().ok_or_else(|| {
            AppError::EmailError("Email is not configured: EMAIL_FROM is missing".into())
        })?;

        let to = message.to.trim();
        if to.is_empty() || !to.contains('@') {
            return Err(AppError::EmailError(format!(
                "Invalid or missing recipient email address: {to:?}"
            )));
        }

        // Card images travel as real attachments. data: URIs inside HTML are
        // blocked by Gmail and most other clients, so they would show as broken images.
        // (Attachment.url carries the base64 PNG data in the existing dispatcher.)
        let attachments: Vec<Value> = message
            .attachments
            .iter()
            .filter(|a| a.mime_type == "image/png")
            .enumerate()
            .map(|(i, a)| {
                json!({ "filename": format!("invitation-card-{}.png", i + 1), "content": a.url })
            })
            .collect();

        let card_note = if attachments.is_empty() {
            ""
        } else {
            r#"<p><strong>Your invitation card is attached.</strong> Show it at the entrance for check-in.</p>"#
        };

        let html = format!(
            r#"<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
<p>{}</p>{}
<p style="margin-top:20px;color:#666;font-size:12px;">Sent by RoyalEntry.</p>
</div>"#,
            escape_html(&message.body).replace('\n', "<br>"),
            card_note
        );

        let mut payload = json!({
            "from": from,
            "to": [to],
            "subject": SUBJECT,
            "html": html,
            "text": message.body,
        });
        if !attachments.is_empty() {
            payload["attachments"] = Value::Array(attachments);
        }

        let resp = self
            .client
            .post("https://api.resend.com/emails")
            .bearer_auth(api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|e| {
                AppError::EmailError(format!("Resend request failed: {}", e.without_url()))
            })?;

        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            // Resend's JSON message says exactly what is wrong (unverified domain,
            // invalid key, bad recipient). Keep it so it can be shown in the UI.
            return Err(AppError::EmailError(format!(
                "Resend API {}: {}",
                status.as_u16(),
                body
            )));
        }

        let provider_id = serde_json::from_str::<Value>(&body)
            .ok()
            .and_then(|v| v.get("id").and_then(|i| i.as_str()).map(String::from));

        Ok(DeliveryReceipt {
            channel: ChannelKind::Email,
            success: true,
            provider_message_id: provider_id,
            error_message: None,
            raw_response: Some(body),
        })
    }

    fn kind(&self) -> ChannelKind {
        ChannelKind::Email
    }
}
