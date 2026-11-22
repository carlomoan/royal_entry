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
    pub sms: Option<SmsRouter>,
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
            sms: SmsRouter::from_env(&client),
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
                "SMS — set UNITXT_API_TOKEN and UNITXT_SENDER_ID (or BEEM_API_KEY, BEEM_SECRET_KEY and BEEM_SENDER_NAME)".to_string(),
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

    /// Send an email with a card image embedded (base64) below the message body.
    /// `card_png` is optional — when None/empty the email is sent without it.
    pub async fn email_card(
        &self,
        to: &str,
        subject: &str,
        html: &str,
        card_png: Option<&[u8]>,
    ) -> AppResult<ProviderReceipt> {
        let html_with_card = match card_png {
            Some(png) if !png.is_empty() => {
                let b64 = base64::engine::general_purpose::STANDARD.encode(png);
                format!(
                    "{html}<p style='text-align:center;margin:18px 0;'><img src='data:image/png;base64,{b64}' alt='Card' style='max-width:100%;border-radius:8px;'/></p>"
                )
            }
            _ => html.to_string(),
        };
        self.email(to, subject, &html_with_card).await
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

fn sms_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// Tanzanian numbers as 255XXXXXXXXX (no plus sign): accepts +255..., 255..., 0712... and 712...
fn normalize_tz_phone(phone: &str) -> String {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.starts_with("255") {
        digits
    } else if digits.starts_with('0') && digits.len() == 10 {
        format!("255{}", &digits[1..])
    } else if digits.len() == 9 {
        format!("255{digits}")
    } else {
        digits
    }
}

// ── SMS length / cost ────────────────────────────────────────────────────────

const GSM7_BASIC: &str = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENDED: &str = "^{}\\[~]|€"; // each counts as two characters

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SmsSegments {
    /// true when any character is outside the GSM-7 alphabet (curly quotes, emoji, ...)
    pub unicode: bool,
    /// length in the units the network counts
    pub length: usize,
    /// number of SMS units billed per recipient
    pub parts: usize,
}

/// How many SMS units a message will use. GSM-7: 160 characters, then 153 per part.
/// Unicode: 70 characters, then 67 per part.
pub fn sms_segments(text: &str) -> SmsSegments {
    let mut gsm_len = 0usize;
    let mut is_gsm = true;
    for c in text.chars() {
        if GSM7_BASIC.contains(c) {
            gsm_len += 1;
        } else if GSM7_EXTENDED.contains(c) {
            gsm_len += 2;
        } else {
            is_gsm = false;
            break;
        }
    }
    if is_gsm {
        let parts = if gsm_len <= 160 { 1 } else { (gsm_len + 152) / 153 };
        SmsSegments { unicode: false, length: gsm_len, parts }
    } else {
        let len = text.encode_utf16().count();
        let parts = if len <= 70 { 1 } else { (len + 66) / 67 };
        SmsSegments { unicode: true, length: len, parts }
    }
}

// ── UniTxt SMS (Laravel-style API v3: POST {base}/sms/send, Bearer token, JSON) ──

#[derive(Clone)]
pub struct UniTxtSms {
    base_url: String,
    token: String,
    sender_id: String,
    client: Client,
}

// Manual Debug so the token can never end up in a log line.
impl std::fmt::Debug for UniTxtSms {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("UniTxtSms")
            .field("base_url", &self.base_url)
            .field("sender_id", &self.sender_id)
            .field("token", &"<hidden>")
            .finish()
    }
}

impl UniTxtSms {
    fn from_env(client: &Client) -> Option<Self> {
        let token = sms_env("UNITXT_API_TOKEN")?;
        let sender_id = sms_env("UNITXT_SENDER_ID")?;
        let base_url = sms_env("UNITXT_BASE_URL")
            .unwrap_or_else(|| "https://unitxt.co.tz/api/v3".to_string());
        Some(Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            token,
            sender_id,
            client: client.clone(),
        })
    }

    /// One request per recipient, so every number gets its own receipt.
    async fn send(&self, numbers: &[String], message: &str) -> AppResult<Vec<ProviderReceipt>> {
        let mut receipts = Vec::with_capacity(numbers.len());
        for number in numbers {
            let body = json!({
                "recipient": normalize_tz_phone(number),
                "sender_id": self.sender_id,
                "type": "plain",
                "message": message,
            });
            let response = self
                .client
                .post(format!("{}/sms/send", self.base_url))
                .bearer_auth(&self.token)
                .header("Accept", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| {
                    AppError::ExternalApiError(format!(
                        "UniTxt SMS request failed: {}",
                        e.without_url()
                    ))
                })?;

            let status = response.status();
            let payload: serde_json::Value =
                response.json().await.unwrap_or_else(|_| json!({}));
            let api_ok = payload.get("status").and_then(|v| v.as_str()) == Some("success");

            if status.is_success() && api_ok {
                let id = ["/data/uid", "/data/id", "/data/message_id"]
                    .iter()
                    .find_map(|p| payload.pointer(p))
                    .and_then(|v| {
                        v.as_str()
                            .map(String::from)
                            .or_else(|| v.as_i64().map(|n| n.to_string()))
                    });
                receipts.push(ProviderReceipt::ok("unitxt", id));
            } else {
                let reason = payload
                    .get("message")
                    .and_then(|v| v.as_str())
                    .map(String::from)
                    .unwrap_or_else(|| format!("HTTP {}", status.as_u16()));
                receipts.push(ProviderReceipt::fail(
                    "unitxt",
                    format!("UniTxt SMS API {}: {}", status.as_u16(), reason),
                ));
            }
        }
        Ok(receipts)
    }
}

// ── Router: several SMS providers, in order, with optional failover ──────────

#[derive(Debug, Clone)]
pub enum SmsBackend {
    UniTxt(UniTxtSms),
    Beem(BeemSms),
    // NextSms(NextSms),   // add when its request format is confirmed
}

impl SmsBackend {
    fn name(&self) -> &'static str {
        match self {
            SmsBackend::UniTxt(_) => "unitxt",
            SmsBackend::Beem(_) => "beem",
        }
    }

    async fn send(&self, numbers: &[String], message: &str) -> AppResult<Vec<ProviderReceipt>> {
        match self {
            SmsBackend::UniTxt(p) => p.send(numbers, message).await,
            SmsBackend::Beem(p) => p.send(numbers, message).await,
        }
    }
}

#[derive(Debug, Clone)]
pub struct SmsRouter {
    backends: Vec<SmsBackend>,
    failover: bool,
}

impl SmsRouter {
    fn from_env(client: &Client) -> Option<Self> {
        let mut available: Vec<SmsBackend> = Vec::new();
        if let Some(p) = UniTxtSms::from_env(client) {
            available.push(SmsBackend::UniTxt(p));
        }
        if let Some(p) = BeemSms::from_env(client) {
            available.push(SmsBackend::Beem(p));
        }
        if available.is_empty() {
            return None;
        }

        if let Some(order) = sms_env("SMS_PROVIDER_ORDER") {
            let wanted: Vec<String> = order
                .split(',')
                .map(|s| s.trim().to_lowercase())
                .filter(|s| !s.is_empty())
                .collect();
            // stable sort: providers not listed keep their relative order, after the listed ones
            available.sort_by_key(|b| {
                wanted.iter().position(|w| w == b.name()).unwrap_or(usize::MAX)
            });
        }

        let failover = !matches!(
            sms_env("SMS_FAILOVER").as_deref(),
            Some("false") | Some("0") | Some("off")
        );
        Some(Self { backends: available, failover })
    }

    /// Same signature as the old BeemSms::send, so Channels::sms() keeps working.
    ///
    /// Tries the providers in order and stops at the first one whose receipts are all
    /// successful. If every provider fails, the FIRST provider's receipts are returned,
    /// because its error message is the most useful one (for example "sender not
    /// authorized").
    ///
    /// Trade-off: if a provider accepts a message but its reply is unreadable, the next
    /// provider sends it again. That is harmless for gate codes and acceptable for
    /// invitations; set SMS_FAILOVER=false to turn failover off.
    pub async fn send(&self, numbers: &[String], message: &str) -> AppResult<Vec<ProviderReceipt>> {
        if numbers.is_empty() {
            return Ok(Vec::new());
        }
        let mut first_failure: Option<AppResult<Vec<ProviderReceipt>>> = None;
        for backend in &self.backends {
            let result = backend.send(numbers, message).await;
            let delivered =
                matches!(&result, Ok(r) if !r.is_empty() && r.iter().all(|x| x.success));
            if delivered {
                return result;
            }
            tracing::warn!(
                provider = backend.name(),
                failover = self.failover,
                "SMS provider did not accept the message"
            );
            if first_failure.is_none() {
                first_failure = Some(result);
            }
            if !self.failover {
                break;
            }
        }
        first_failure.unwrap_or_else(|| Ok(Vec::new()))
    }
}

// ── Checked send: Ok only when the provider really accepted the SMS ──────────

impl Channels {
    /// Channels::sms() returns Ok even when the provider rejects the message (the
    /// rejection is inside the receipts). Use this wherever "sent" must mean "accepted":
    /// reminders, arrival messages, anything that records a delivery as done.
    pub async fn sms_checked(&self, numbers: &[String], message: &str) -> Result<(), String> {
        match self.sms(numbers, message).await {
            Ok(receipts) if !receipts.is_empty() && receipts.iter().all(|r| r.success) => Ok(()),
            Ok(receipts) => Err(receipts
                .iter()
                .find_map(|r| r.error.clone())
                .unwrap_or_else(|| "SMS provider returned no receipt".to_string())),
            Err(e) => Err(e.to_string()),
        }
    }
}

#[cfg(test)]
mod sms_tests {
    use super::*;

    #[test]
    fn gsm_length_limits() {
        assert_eq!(sms_segments(&"a".repeat(160)).parts, 1);
        assert_eq!(sms_segments(&"a".repeat(161)).parts, 2);
        assert_eq!(sms_segments(&"a".repeat(306)).parts, 2);
        assert_eq!(sms_segments(&"a".repeat(307)).parts, 3);
    }

    #[test]
    fn unicode_length_limits() {
        let one = sms_segments(&"’".repeat(70));
        assert!(one.unicode);
        assert_eq!(one.parts, 1);
        assert_eq!(sms_segments(&"’".repeat(71)).parts, 2);
        assert_eq!(sms_segments(&"’".repeat(134)).parts, 2);
        assert_eq!(sms_segments(&"’".repeat(135)).parts, 3);
    }

    #[test]
    fn phone_normalisation() {
        assert_eq!(normalize_tz_phone("0718474695"), "255718474695");
        assert_eq!(normalize_tz_phone("+255 718 474 695"), "255718474695");
        assert_eq!(normalize_tz_phone("718474695"), "255718474695");
    }
}

impl Channels {
    /// Like sms_checked: Ok only when the email provider accepted the message.
    pub async fn email_checked(&self, to: &str, subject: &str, html: &str) -> Result<(), String> {
        match self.email(to, subject, html).await {
            Ok(r) if r.success => Ok(()),
            Ok(r) => Err(r.error.unwrap_or_else(|| "Email rejected by provider".to_string())),
            Err(e) => Err(e.to_string()),
        }
    }
}
