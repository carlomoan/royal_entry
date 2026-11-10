// ==============================================================================
// FILE: crates/cloud/src/services/channels.rs
// ==============================================================================
// Unified outbound messaging channels, each configured entirely from
// environment variables. Build once with `Channels::from_env()` at startup and
// share it (clone it into Axum state). A channel whose variables are missing is
// simply `None`, so channels can be enabled one at a time.
//
//   SMS       Beem (beem.africa)           BEEM_API_KEY / BEEM_SECRET_KEY / BEEM_SENDER_NAME
//   Email     Resend (resend.com)          RESEND_API_KEY / EMAIL_FROM
//   Telegram  Bot API (telegram.org)      TELEGRAM_BOT_TOKEN
//   WhatsApp  Cloud API (graph.facebook)  WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_API_VERSION
//
// NEVER expose any of these through a NEXT_PUBLIC_* name — they must stay in the
// backend process only.
// ==============================================================================

use crate::error::{AppError, AppResult};
use base64::Engine as _;
use lettre::{
    message::{header::ContentType, Mailbox, Message},
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Tokio1Executor,
};
use reqwest::Client;
use serde_json::json;

/// One successful (or failed) provider call.
#[derive(Debug, Clone, Default)]
pub struct ProviderReceipt {
    pub provider: &'static str,
    pub provider_id: Option<String>,
    pub success: bool,
    pub error: Option<String>,
}

impl ProviderReceipt {
    fn ok(provider: &'static str, provider_id: Option<String>) -> Self {
        Self { provider, provider_id, success: true, error: None }
    }

    fn fail(provider: &'static str, error: String) -> Self {
        Self { provider, provider_id: None, success: false, error: Some(error) }
    }
}

// ── Beem SMS ────────────────────────────────────────────────────────────────
#[derive(Debug, Clone)]
pub struct BeemSms {
    api_key: String,
    secret_key: String,
    sender_name: String,
    client: Client,
}

impl BeemSms {
    fn from_env(client: &Client) -> Option<Self> {
        let api_key = std::env::var("BEEM_API_KEY").ok()?;
        let secret_key = std::env::var("BEEM_SECRET_KEY").ok()?;
        if api_key.trim().is_empty() || secret_key.trim().is_empty() {
            return None;
        }
        Some(Self {
            api_key,
            secret_key,
            sender_name: std::env::var("BEEM_SENDER_NAME")
                .unwrap_or_else(|_| "RoyalEntry".to_string()),
            client: client.clone(),
        })
    }

    /// Beem sends to full international numbers without the leading `+` and
    /// with the country code (e.g. `2557...` for Tanzania).
    fn normalize(phone: &str) -> String {
        let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
        if digits.starts_with('0') && digits.len() >= 10 {
            format!("255{}", &digits[1..])
        } else {
            digits
        }
    }

    async fn send(&self, numbers: &[String], message: &str) -> AppResult<Vec<ProviderReceipt>> {
        if numbers.is_empty() {
            return Ok(Vec::new());
        }
        // Beem v1 endpooint. If your Beem account uses header auth instead
        // (X-Api-Key / X-Api-Secret), swap the Authorization header below.
        let url = "https://apisms.beem.africa/public/v1/send";
        let credentials =
            base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", self.api_key, self.secret_key));

        let recipients: Vec<serde_json::Value> = numbers
            .iter()
            .enumerate()
            .map(|(i, number)| {
                json!({
                    "recipient_id": i.to_string(),
                    "dest_addr": Self::normalize(number),
                })
            })
            .collect();

        let body = json!({
            "source_addr": self.sender_name,
            "schedule_time": "",
            "encoding": "0",
            "message": message,
            "recipients": recipients,
            "message_type": "A",
        });

        let response = self
            .client
            .post(url)
            .header("Authorization", format!("Basic {credentials}"))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Beem SMS request failed: {e}")))?;

        let status = response.status();
        let payload: serde_json::Value = response
            .json()
            .await
            .unwrap_or_else(|_| json!({ "raw": "unparseable response" }));

        if status.is_success() {
            let request_id = payload
                .pointer("/data/request_id")
                .or_else(|| payload.pointer("/request_id"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            Ok(vec![ProviderReceipt::ok("beem", request_id)])
        } else {
            let message_text = payload
                .pointer("/message")
                .or_else(|| payload.pointer("/error"))
                .and_then(|v| v.as_str())
                .unwrap_or(&status.to_string())
                .to_string();
            Ok(vec![ProviderReceipt::fail(
                "beem",
                format!("Beem SMS API {}: {message_text}", status.as_u16()),
            )])
        }
    }
}

// ── Resend email ─────────────────────────────────────────────────────────────
#[derive(Debug, Clone)]
pub struct ResendEmail {
    api_key: String,
    from: String,
    client: Client,
}

impl ResendEmail {
    fn from_env(client: &Client) -> Option<Self> {
        let api_key = std::env::var("RESEND_API_KEY").ok()?;
        if api_key.trim().is_empty() {
            return None;
        }
        Some(Self {
            api_key,
            from: std::env::var("EMAIL_FROM")
                .unwrap_or_else(|_| "RoyalEntry <noreply@royalentry.foctek.co.tz>".to_string()),
            client: client.clone(),
        })
    }

    async fn send(&self, to: &str, subject: &str, html: &str) -> AppResult<ProviderReceipt> {
        let body = json!({
            "from": self.from,
            "to": [to],
            "subject": subject,
            "html": html,
        });

        let response = self
            .client
            .post("https://api.resend.com/emails")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Resend request failed: {e}")))?;

        let status = response.status();
        let payload: serde_json::Value = response
            .json()
            .await
            .unwrap_or_else(|_| json!({ "raw": "unparseable response" }));

        if status.is_success() {
            Ok(ProviderReceipt::ok(
                "resend",
                payload.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()),
            ))
        } else {
            let message_text = payload
                .pointer("/message")
                .and_then(|v| v.as_str())
                .unwrap_or(&status.to_string())
                .to_string();
            Ok(ProviderReceipt::fail(
                "resend",
                format!("Resend API {}: {message_text}", status.as_u16()),
            ))
        }
    }
}

// ── SMTP email (e.g. Yahoo) ──────────────────────────────────────────────────
#[derive(Debug, Clone)]
pub struct SmtpEmail {
    host: String,
    port: u16,
    user: String,
    pass: String,
    from: String,
    from_name: String,
}

impl SmtpEmail {
    fn from_env() -> Option<Self> {
        let host = std::env::var("SMTP_HOST").ok()?;
        if host.trim().is_empty() {
            return None;
        }
        Some(Self {
            host,
            port: std::env::var("SMTP_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(587),
            user: std::env::var("SMTP_USER").unwrap_or_default(),
            pass: std::env::var("SMTP_PASSWORD")
                .or_else(|_| std::env::var("SMTP_PASS"))
                .unwrap_or_default(),
            from: std::env::var("EMAIL_FROM")
                .or_else(|_| std::env::var("SMTP_FROM"))
                .or_else(|_| std::env::var("SMTP_FROM_ADDRESS"))
                .unwrap_or_else(|_| "agbbelly89@outlook.com".to_string()),
            from_name: std::env::var("SMTP_FROM_NAME")
                .unwrap_or_else(|_| "RoyalEntry".to_string()),
        })
    }

    async fn send(&self, to: &str, subject: &str, html: &str) -> AppResult<ProviderReceipt> {
        let from_display = format!("{} <{}>", self.from_name, self.from);
        let from: Mailbox = from_display
            .parse()
            .map_err(|e| AppError::EmailError(format!("Invalid sender address: {e}")))?;
        let to: Mailbox = to
            .parse()
            .map_err(|e| AppError::EmailError(format!("Invalid recipient address: {e}")))?;

        let email = Message::builder()
            .from(from)
            .to(to)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(html.to_string())
            .map_err(|e| AppError::EmailError(e.to_string()))?;

        let credentials = Credentials::new(self.user.clone(), self.pass.clone());
        let transport = AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&self.host)
            .map_err(|e| AppError::EmailError(format!("Failed to create SMTP transport: {e}")))?
            .port(self.port)
            .credentials(credentials)
            .build();

        transport
            .send(email)
            .await
            .map_err(|e| AppError::EmailError(format!("SMTP delivery failed: {e}")))?;

        Ok(ProviderReceipt::ok(
            "smtp",
            Some(format!("smtp_{}", uuid::Uuid::new_v4())),
        ))
    }
}

// ── Telegram bot ─────────────────────────────────────────────────────────────
#[derive(Debug, Clone)]
pub struct TelegramBot {
    bot_token: String,
    client: Client,
}

impl TelegramBot {
    fn from_env(client: &Client) -> Option<Self> {
        let bot_token = std::env::var("TELEGRAM_BOT_TOKEN").ok()?;
        if bot_token.trim().is_empty() {
            return None;
        }
        Some(Self { bot_token, client: client.clone() })
    }

    async fn send(&self, chat_id: &str, text: &str) -> AppResult<ProviderReceipt> {
        let url = format!("https://api.telegram.org/bot{}/sendMessage", self.bot_token);
        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&json!({ "chat_id": chat_id, "text": text }))
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Telegram request failed: {e}")))?;

        let status = response.status();
        let payload: serde_json::Value = response
            .json()
            .await
            .unwrap_or_else(|_| json!({ "raw": "unparseable response" }));

        if status.is_success() && payload.get("ok").and_then(|v| v.as_bool()) == Some(true) {
            Ok(ProviderReceipt::ok(
                "telegram",
                payload
                    .pointer("/result/message_id")
                    .and_then(|v| v.as_i64())
                    .map(|v| v.to_string()),
            ))
        } else {
            let description = payload
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or(&status.to_string())
                .to_string();
            Ok(ProviderReceipt::fail(
                "telegram",
                format!("Telegram API {}: {description}", status.as_u16()),
            ))
        }
    }
}

// ── WhatsApp Cloud API ───────────────────────────────────────────────────────
#[derive(Debug, Clone)]
pub struct WhatsAppCloud {
    access_token: String,
    phone_number_id: String,
    api_version: String,
    client: Client,
}

impl WhatsAppCloud {
    fn from_env(client: &Client) -> Option<Self> {
        let access_token = std::env::var("WHATSAPP_ACCESS_TOKEN").ok()?;
        let phone_number_id = std::env::var("WHATSAPP_PHONE_NUMBER_ID").ok()?;
        if access_token.trim().is_empty() || phone_number_id.trim().is_empty() {
            return None;
        }
        Some(Self {
            access_token,
            phone_number_id,
            api_version: std::env::var("WHATSAPP_API_VERSION")
                .unwrap_or_else(|_| "v21.0".to_string()),
            client: client.clone(),
        })
    }

    /// `to` must be the full international number without `+` (e.g. 2557...).
    fn normalize(phone: &str) -> String {
        let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
        if digits.starts_with('0') && digits.len() >= 10 {
            format!("255{}", &digits[1..])
        } else {
            digits
        }
    }

    async fn post_message(&self, body: serde_json::Value) -> AppResult<ProviderReceipt> {
        let url = format!(
            "https://graph.facebook.com/{}/{}/messages",
            self.api_version, self.phone_number_id
        );
        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.access_token))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("WhatsApp request failed: {e}")))?;

        let status = response.status();
        let payload: serde_json::Value = response
            .json()
            .await
            .unwrap_or_else(|_| json!({ "raw": "unparseable response" }));

        if status.is_success() {
            Ok(ProviderReceipt::ok(
                "whatsapp",
                payload.pointer("/messages/0/id").and_then(|v| v.as_str()).map(|s| s.to_string()),
            ))
        } else {
            // Meta returns helpful errors: payload.error.message
            let message_text = payload
                .pointer("/error/message")
                .and_then(|v| v.as_str())
                .or_else(|| payload.pointer("/error").and_then(|v| v.as_str()))
                .unwrap_or(&status.to_string())
                .to_string();
            Ok(ProviderReceipt::fail(
                "whatsapp",
                format!("WhatsApp API {}: {message_text}", status.as_u16()),
            ))
        }
    }

    /// Free-form text — WhatsApp only delivers this inside the 24-hour
    /// customer service window after the guest contacts you.
    async fn send_text(&self, to: &str, message: &str) -> AppResult<ProviderReceipt> {
        self.post_message(json!({
            "messaging_product": "whatsapp",
            "to": Self::normalize(to),
            "type": "text",
            "text": { "body": message },
        }))
        .await
    }

    /// Approved template message — required for the first message to guests
    /// who have never contacted you. `components` is the array of template
    /// parameters (e.g. `[{"type":"body","parameters":[{"type":"text","text":"..."}]}]`).
    async fn send_template(
        &self,
        to: &str,
        template_name: &str,
        components: Vec<serde_json::Value>,
    ) -> AppResult<ProviderReceipt> {
        self.post_message(json!({
            "messaging_product": "whatsapp",
            "to": Self::normalize(to),
            "type": "template",
            "template": {
                "name": template_name,
                "language": { "code": "en" },
                "components": components,
            },
        }))
        .await
    }
}

// ── Aggregated Channels ──────────────────────────────────────────────────────
#[derive(Debug, Clone)]
pub struct Channels {
    pub sms: Option<BeemSms>,
    pub email_smtp: Option<SmtpEmail>,
    pub email: Option<ResendEmail>,
    pub telegram: Option<TelegramBot>,
    pub whatsapp: Option<WhatsAppCloud>,
}

impl Channels {
    /// Reads all channel configuration from the environment. Missing variables
    /// leave that channel as `None`.
    pub fn from_env() -> Self {
        let client = Client::new();
        Self {
            sms: BeemSms::from_env(&client),
            email_smtp: SmtpEmail::from_env(),
            email: ResendEmail::from_env(&client),
            telegram: TelegramBot::from_env(&client),
            whatsapp: WhatsAppCloud::from_env(&client),
        }
    }

    /// Names of the channels that have credentials configured.
    pub fn configured(&self) -> Vec<&'static str> {
        let mut names = Vec::new();
        if self.sms.is_some() {
            names.push("sms");
        }
        if self.email_smtp.is_some() || self.email.is_some() {
            names.push("email");
        }
        if self.telegram.is_some() {
            names.push("telegram");
        }
        if self.whatsapp.is_some() {
            names.push("whatsapp");
        }
        names
    }

    pub async fn sms(&self, numbers: &[String], message: &str) -> AppResult<Vec<ProviderReceipt>> {
        match &self.sms {
            Some(provider) => provider.send(numbers, message).await,
            None => Err(AppError::ChannelNotConfigured(
                "SMS (Beem) — set BEEM_API_KEY, BEEM_SECRET_KEY and BEEM_SENDER_NAME".to_string(),
            )),
        }
    }

    pub async fn email(&self, to: &str, subject: &str, html: &str) -> AppResult<ProviderReceipt> {
        // Prefer SMTP (e.g. Yahoo) when configured; fall back to Resend.
        if let Some(smtp) = &self.email_smtp {
            return smtp.send(to, subject, html).await;
        }
        match &self.email {
            Some(provider) => provider.send(to, subject, html).await,
            None => Err(AppError::ChannelNotConfigured(
                "Email — set SMTP_HOST/SMTP_USER/SMTP_PASSWORD (or RESEND_API_KEY)".to_string(),
            )),
        }
    }

    pub async fn telegram(&self, chat_id: &str, text: &str) -> AppResult<ProviderReceipt> {
        match &self.telegram {
            Some(provider) => provider.send(chat_id, text).await,
            None => Err(AppError::ChannelNotConfigured(
                "Telegram — set TELEGRAM_BOT_TOKEN".to_string(),
            )),
        }
    }

    /// WhatsApp free-form text (only within the 24-hour window).
    pub async fn whatsapp_text(&self, to: &str, message: &str) -> AppResult<ProviderReceipt> {
        match &self.whatsapp {
            Some(provider) => provider.send_text(to, message).await,
            None => Err(AppError::ChannelNotConfigured(
                "WhatsApp — set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID".to_string(),
            )),
        }
    }

    /// WhatsApp approved template (use for first contact with guests).
    pub async fn whatsapp_template(
        &self,
        to: &str,
        template_name: &str,
        components: Vec<serde_json::Value>,
    ) -> AppResult<ProviderReceipt> {
        match &self.whatsapp {
            Some(provider) => provider.send_template(to, template_name, components).await,
            None => Err(AppError::ChannelNotConfigured(
                "WhatsApp — set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID".to_string(),
            )),
        }
    }
}

impl Default for Channels {
    fn default() -> Self {
        Self::from_env()
    }
}

/// Minimal HTML wrapper for plain-text message bodies sent through Resend.
pub fn html_wrap(text: &str) -> String {
    let escaped = text
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('\n', "<br/>");
    format!("<p style=\"font-family:sans-serif;font-size:15px;line-height:1.5;\">{escaped}</p>")
}
