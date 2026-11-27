// ==============================================================================
// FILE: crates/cloud/src/services/channels.rs
// ==============================================================================
// One configuration object for every outbound channel. Values come from the
// backend .env and can be overridden from the Settings UI (system_settings).
// Secrets are never logged and are returned masked by the settings API.
//
//   SMS       NextSMS or Unitxt (with optional failover)
//   Email     Resend or SMTP
//   Telegram  Bot API
//   WhatsApp  Cloud API
//
// NEVER expose any credential through a NEXT_PUBLIC_* name.
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
use sqlx::PgPool;
use uuid::Uuid;

/// One provider call result. `success` is authoritative — a 200 response from
/// a provider does not necessarily mean the message was accepted.
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

// ── Configuration ────────────────────────────────────────────────────────────

/// Every setting used by the outbound channels. Env is the base layer; the
/// Settings UI writes overrides into `system_settings` (same keys, lowercase).
#[derive(Debug, Clone)]
pub struct ChannelConfig {
    pub sms_provider: String,
    pub sms_failover: bool,
    pub sms_order: Vec<String>,
    pub nextsms_token: String,
    pub nextsms_sender: String,
    pub nextsms_base_url: String,
    pub unitxt_token: String,
    pub unitxt_sender: String,
    pub unitxt_base_url: String,
    pub email_provider: String,
    pub resend_api_key: String,
    pub email_from: String,
    pub email_from_name: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_user: String,
    pub smtp_password: String,
    pub smtp_tls: bool,
    pub telegram_token: String,
    pub whatsapp_token: String,
    pub whatsapp_phone_id: String,
    pub whatsapp_version: String,
    /// `cloud` (Meta Cloud API) or `nextsms` (template-based WhatsApp gateway).
    pub whatsapp_provider: String,
    pub nextsms_whatsapp_account: String,
    pub nextsms_whatsapp_template: String,
    /// Placeholder names in the approved template body, in order (without braces).
    pub nextsms_whatsapp_placeholders: Vec<String>,
    pub sms_sandbox: bool,
    pub whatsapp_sandbox: bool,
}

fn env(name: &str) -> String {
    std::env::var(name).unwrap_or_default().trim().to_string()
}

fn env_bool(name: &str, default: bool) -> bool {
    match env(name).to_ascii_lowercase().as_str() {
        "" => default,
        "1" | "true" | "yes" | "on" => true,
        _ => false,
    }
}

impl Default for ChannelConfig {
    fn default() -> Self {
        Self {
            sms_provider: env("SMS_PROVIDER"),
            sms_failover: env_bool("SMS_FAILOVER", true),
            sms_order: env("SMS_PROVIDER_ORDER")
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_lowercase)
                .collect(),
            nextsms_token: env("NEXTSMS_API_TOKEN"),
            nextsms_sender: env("NEXTSMS_SENDER_ID"),
            nextsms_base_url: if env("NEXTSMS_BASE_URL").is_empty() {
                "https://messaging-service.co.tz".to_string()
            } else {
                env("NEXTSMS_BASE_URL")
            },
            unitxt_token: env("UNITXT_API_TOKEN"),
            unitxt_sender: env("UNITXT_SENDER_ID"),
            unitxt_base_url: if env("UNITXT_BASE_URL").is_empty() {
                "https://unitxt.co.tz/api/v3".to_string()
            } else {
                env("UNITXT_BASE_URL")
            },
            email_provider: env("EMAIL_PROVIDER"),
            resend_api_key: env("RESEND_API_KEY"),
            email_from: env("EMAIL_FROM"),
            email_from_name: if env("EMAIL_FROM_NAME").is_empty() {
                "RoyalEntry".to_string()
            } else {
                env("EMAIL_FROM_NAME")
            },
            smtp_host: env("SMTP_HOST"),
            smtp_port: env("SMTP_PORT").parse().unwrap_or(587),
            smtp_user: env("SMTP_USER"),
            smtp_password: if env("SMTP_PASSWORD").is_empty() { env("SMTP_PASS") } else { env("SMTP_PASSWORD") },
            smtp_tls: env_bool("SMTP_USE_TLS", true),
            telegram_token: env("TELEGRAM_BOT_TOKEN"),
            whatsapp_token: env("WHATSAPP_ACCESS_TOKEN"),
            whatsapp_phone_id: env("WHATSAPP_PHONE_NUMBER_ID"),
            whatsapp_version: if env("WHATSAPP_API_VERSION").is_empty() {
                "v21.0".to_string()
            } else {
                env("WHATSAPP_API_VERSION")
            },
            whatsapp_provider: env("WHATSAPP_PROVIDER"),
            nextsms_whatsapp_account: env("NEXTSMS_WHATSAPP_ACCOUNT"),
            nextsms_whatsapp_template: env("NEXTSMS_WHATSAPP_TEMPLATE"),
            nextsms_whatsapp_placeholders: {
                let raw = env("NEXTSMS_WHATSAPP_PLACEHOLDERS");
                if raw.is_empty() {
                    vec!["message".to_string()]
                } else {
                    raw.split(',').map(str::trim).filter(|s| !s.is_empty()).map(str::to_string).collect()
                }
            },
            sms_sandbox: env_bool("ENABLE_SMS_SANDBOX", false),
            whatsapp_sandbox: env_bool("ENABLE_WHATSAPP_SANDBOX", false),
        }
    }
}


/// Accepts Meta-style components (`{type:"body", parameters:[{type:"text",text:"…"}]}`)
/// and the legacy flat `{text:"…"}` shape.
fn collect_body_variables(components: &[serde_json::Value]) -> Vec<String> {
    let mut out = Vec::new();
    for c in components {
        if let Some(params) = c.get("parameters").and_then(|p| p.as_array()) {
            for p in params {
                if let Some(t) = p.get("text").and_then(|t| t.as_str()) {
                    out.push(t.to_string());
                }
            }
        } else if let Some(t) = c.get("text").and_then(|t| t.as_str()) {
            out.push(t.to_string());
        }
    }
    out
}

/// sandbox_messages.channel has a CHECK constraint. Never pass an arbitrary
/// channel name (e.g. "both") through — map it to a valid value.
fn safe_channel(channel: &str) -> &'static str {
    match channel.to_ascii_lowercase().as_str() {
        "sms" => "sms",
        "whatsapp" => "whatsapp",
        "email" => "email",
        "telegram" => "telegram",
        _ => "sms",
    }
}

fn str_value(v: &serde_json::Value) -> Option<String> {
    v.as_str().map(str::trim).filter(|s| !s.is_empty()).map(str::to_string)
}

fn bool_value(v: &serde_json::Value) -> Option<bool> {
    v.as_bool().or_else(|| match v.as_str() {
        Some(s) if s.eq_ignore_ascii_case("true") => Some(true),
        Some(s) if s.eq_ignore_ascii_case("false") => Some(false),
        _ => None,
    })
}

async fn overlay_from_db(config: &mut ChannelConfig, pool: &PgPool) {
    let rows: Vec<(String, serde_json::Value)> = match sqlx::query_as(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN \
         ('sms_provider','sms_failover','sms_provider_order','nextsms_api_token','nextsms_sender_id','nextsms_base_url', \
          'unitxt_api_token','unitxt_sender_id','unitxt_base_url','email_provider','resend_api_key','email_from', \
          'email_from_name','smtp_host','smtp_port','smtp_user','smtp_password','smtp_use_tls','telegram_bot_token', \
          'whatsapp_access_token','whatsapp_phone_number_id','whatsapp_api_version','whatsapp_provider', \
          'nextsms_whatsapp_account','nextsms_whatsapp_template','nextsms_whatsapp_placeholders', \
          'enable_sms_sandbox','enable_whatsapp_sandbox')"
    )
    .fetch_all(pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!(error = %e, "Could not load channel settings from DB; using env only");
            return;
        }
    };

    for (key, value) in rows {
        let s = str_value(&value);
        match key.as_str() {
            "sms_provider" => { if let Some(v) = s { config.sms_provider = v.to_lowercase(); } }
            "sms_failover" => { if let Some(v) = bool_value(&value) { config.sms_failover = v; } }
            "sms_provider_order" => {
                if let Some(v) = s {
                    config.sms_order = v.split(',').map(str::trim).filter(|x| !x.is_empty()).map(str::to_lowercase).collect();
                }
            }
            "nextsms_api_token" => { if let Some(v) = s { config.nextsms_token = v; } }
            "nextsms_sender_id" => { if let Some(v) = s { config.nextsms_sender = v; } }
            "nextsms_base_url" => { if let Some(v) = s { config.nextsms_base_url = v; } }
            "unitxt_api_token" => { if let Some(v) = s { config.unitxt_token = v; } }
            "unitxt_sender_id" => { if let Some(v) = s { config.unitxt_sender = v; } }
            "unitxt_base_url" => { if let Some(v) = s { config.unitxt_base_url = v; } }
            "email_provider" => { if let Some(v) = s { config.email_provider = v.to_lowercase(); } }
            "resend_api_key" => { if let Some(v) = s { config.resend_api_key = v; } }
            "email_from" => { if let Some(v) = s { config.email_from = v; } }
            "email_from_name" => { if let Some(v) = s { config.email_from_name = v; } }
            "smtp_host" => { if let Some(v) = s { config.smtp_host = v; } }
            "smtp_port" => { if let Some(v) = value.as_i64() { config.smtp_port = v as u16; } }
            "smtp_user" => { if let Some(v) = s { config.smtp_user = v; } }
            "smtp_password" => { if let Some(v) = s { config.smtp_password = v; } }
            "smtp_use_tls" => { if let Some(v) = bool_value(&value) { config.smtp_tls = v; } }
            "telegram_bot_token" => { if let Some(v) = s { config.telegram_token = v; } }
            "whatsapp_access_token" => { if let Some(v) = s { config.whatsapp_token = v; } }
            "whatsapp_phone_number_id" => { if let Some(v) = s { config.whatsapp_phone_id = v; } }
            "whatsapp_api_version" => { if let Some(v) = s { config.whatsapp_version = v; } }
            "whatsapp_provider" => { if let Some(v) = s { config.whatsapp_provider = v.to_lowercase(); } }
            "nextsms_whatsapp_account" => { if let Some(v) = s { config.nextsms_whatsapp_account = v; } }
            "nextsms_whatsapp_template" => { if let Some(v) = s { config.nextsms_whatsapp_template = v; } }
            "nextsms_whatsapp_placeholders" => {
                if let Some(v) = s {
                    let names: Vec<String> = v.split(',').map(str::trim).filter(|x| !x.is_empty()).map(str::to_string).collect();
                    if !names.is_empty() { config.nextsms_whatsapp_placeholders = names; }
                }
            }
            "enable_sms_sandbox" => { if let Some(v) = bool_value(&value) { config.sms_sandbox = v; } }
            "enable_whatsapp_sandbox" => { if let Some(v) = bool_value(&value) { config.whatsapp_sandbox = v; } }
            _ => {}
        }
    }
}

// ── Channels ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct Channels {
    pub config: ChannelConfig,
    pub db: Option<PgPool>,
    client: Client,
}

impl Channels {
    /// Env-only configuration (used by tools and tests).
    pub fn from_env() -> Self {
        Self::from_config(ChannelConfig::default(), None)
    }

    /// Env defaults overlaid with Settings-UI values from `system_settings`.
    pub async fn from_env_with_db(pool: Option<PgPool>) -> Self {
        let mut config = ChannelConfig::default();
        if let Some(p) = &pool {
            overlay_from_db(&mut config, p).await;
        }
        // Sandbox is never allowed in production, whatever env or UI says.
        if env("ENVIRONMENT").eq_ignore_ascii_case("production") {
            config.sms_sandbox = false;
            config.whatsapp_sandbox = false;
        }
        let channels = Self::from_config(config, pool);
        tracing::info!(
            sms_providers = ?channels.sms_backends(),
            sms_sender_set = !channels.config.nextsms_sender.is_empty(),
            sms_token_set = !channels.config.nextsms_token.is_empty(),
            "SMS providers loaded"
        );
        channels
    }

    fn from_config(config: ChannelConfig, db: Option<PgPool>) -> Self {
        Self { config, db, client: Client::new() }
    }

    /// Names of the channels that can actually send.
    pub fn configured(&self) -> Vec<&'static str> {
        let mut names = Vec::new();
        if !self.sms_backends().is_empty() || self.config.sms_sandbox {
            names.push("sms");
        }
        if self.email_ready() {
            names.push("email");
        }
        if !self.config.telegram_token.is_empty() {
            names.push("telegram");
        }
        if self.whatsapp_ready() || self.config.whatsapp_sandbox {
            names.push("whatsapp");
        }
        names
    }

    /// True when a channel can actually deliver (sandbox counts as ready).
    pub fn is_sms_ready(&self) -> bool {
        self.config.sms_sandbox || !self.sms_backends().is_empty()
    }

    pub fn is_email_ready(&self) -> bool {
        self.email_ready()
    }

    pub fn is_whatsapp_ready(&self) -> bool {
        self.config.whatsapp_sandbox || self.whatsapp_ready()
    }

    fn email_ready(&self) -> bool {
        match self.config.email_provider.as_str() {
            "smtp" => !self.config.smtp_host.is_empty(),
            "resend" => !self.config.resend_api_key.is_empty(),
            "" => !self.config.resend_api_key.is_empty() || !self.config.smtp_host.is_empty(),
            _ => false,
        }
    }

    fn whatsapp_ready(&self) -> bool {
        if self.config.whatsapp_provider.eq_ignore_ascii_case("nextsms") {
            !self.config.nextsms_token.is_empty()
                && !self.config.nextsms_whatsapp_account.is_empty()
                && !self.config.nextsms_whatsapp_template.is_empty()
        } else {
            !self.config.whatsapp_token.is_empty() && !self.config.whatsapp_phone_id.is_empty()
        }
    }

    /// Configured SMS providers in preference order. Beem is intentionally
    /// absent — only NextSMS and Unitxt are supported.
    fn sms_backends(&self) -> Vec<&'static str> {
        let mut order = self.config.sms_order.clone();
        if order.is_empty() {
            order.push(self.config.sms_provider.clone());
            order.push("nextsms".to_string());
            order.push("unitxt".to_string());
        }
        order.into_iter().filter_map(|name| match name.as_str() {
            "nextsms" if !self.config.nextsms_token.is_empty() && !self.config.nextsms_sender.is_empty() => Some("nextsms"),
            "unitxt" if !self.config.unitxt_token.is_empty() && !self.config.unitxt_sender.is_empty() => Some("unitxt"),
            _ => None,
        }).collect()
    }

    // ── Sandbox previews ─────────────────────────────────────────────────────

    /// Attach event/guest context, QR link and token to the most recent preview.
    pub async fn annotate_last_sandbox(
        &self,
        recipient: &str,
        channel: &str,
        event_id: Uuid,
        guest_id: Uuid,
        qr_url: Option<&str>,
        token: Option<&str>,
    ) {
        let Some(pool) = &self.db else { return };
        let result = sqlx::query(
            r#"UPDATE sandbox_messages SET event_id=$1, guest_id=$2,
                   qr_url=COALESCE($3,qr_url), token=COALESCE($4,token)
               WHERE id=(SELECT id FROM sandbox_messages WHERE recipient=$5 AND channel=$6 ORDER BY created_at DESC LIMIT 1)"#,
        )
        .bind(event_id).bind(guest_id).bind(qr_url).bind(token).bind(recipient).bind(channel)
        .execute(pool).await;
        if let Err(e) = result { tracing::warn!(error = %e, "Failed to annotate sandbox message"); }
    }

    /// Record a preview for a channel that was delivered for real.
    #[allow(clippy::too_many_arguments)]
    pub async fn record_preview(
        &self,
        event_id: Uuid,
        guest_id: Uuid,
        channel: &str,
        recipient: &str,
        subject: Option<&str>,
        body: &str,
        qr_url: Option<&str>,
        token: Option<&str>,
        provider_id: Option<&str>,
    ) {
        let Some(pool) = &self.db else { return };
        let result = sqlx::query(
            r#"INSERT INTO sandbox_messages
                   (id,event_id,guest_id,channel,recipient,subject,body,qr_url,token,provider_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)"#,
        )
        .bind(Uuid::new_v4()).bind(event_id).bind(guest_id).bind(safe_channel(channel)).bind(recipient)
        .bind(subject).bind(body).bind(qr_url).bind(token).bind(provider_id)
        .execute(pool).await;
        if let Err(e) = result { tracing::warn!(error = %e, "Failed to record message preview"); }
    }

    async fn log_sandbox(&self, channel: &'static str, to: &str, body: &str) -> ProviderReceipt {
        let id = format!("sandbox-{}", Uuid::new_v4().simple());
        if let Some(pool) = &self.db {
            let _ = sqlx::query(
                "INSERT INTO sandbox_messages (id,channel,recipient,body,provider_id) VALUES ($1,$2,$3,$4,$5)",
            )
            .bind(Uuid::new_v4()).bind(safe_channel(channel)).bind(to).bind(body).bind(&id)
            .execute(pool).await;
        }
        tracing::info!(channel, recipient = to, provider_id = %id, "Sandbox message recorded");
        ProviderReceipt::ok("sandbox", Some(id))
    }

    // ── SMS ──────────────────────────────────────────────────────────────────

    pub async fn sms(&self, numbers: &[String], message: &str) -> AppResult<Vec<ProviderReceipt>> {
        if numbers.is_empty() { return Ok(Vec::new()); }
        if self.config.sms_sandbox {
            let mut receipts = Vec::with_capacity(numbers.len());
            for n in numbers { receipts.push(self.log_sandbox("sms", n, message).await); }
            return Ok(receipts);
        }
        let mut first_failure: Option<Vec<ProviderReceipt>> = None;
        for provider in self.sms_backends() {
            let result = match provider {
                "nextsms" => self.send_nextsms(numbers, message).await,
                _ => self.send_unitxt(numbers, message).await,
            };
            match result {
                Ok(receipts) if receipts.iter().all(|r| r.success) => return Ok(receipts),
                Ok(receipts) => {
                    if first_failure.is_none() { first_failure = Some(receipts); }
                }
                Err(e) => {
                    if first_failure.is_none() {
                        first_failure = Some(vec![ProviderReceipt::fail(provider, e.to_string())]);
                    }
                }
            }
            if !self.config.sms_failover { break; }
        }
        Ok(first_failure.unwrap_or_else(|| vec![ProviderReceipt::fail(
            "sms", "No SMS provider configured (set SMS_PROVIDER=nextsms or unitxt)".to_string(),
        )]))
    }

    async fn send_nextsms(&self, numbers: &[String], message: &str) -> AppResult<Vec<ProviderReceipt>> {
        // The v2 /text/single endpoint expects `to` as a single phone string,
        // not an array. One request per recipient gives one receipt per number.
        let mut receipts = Vec::with_capacity(numbers.len());
        for number in numbers {
            let to = normalize_tz_phone(number);
            let body = json!({ "from": self.config.nextsms_sender, "to": to, "text": message });
            let response = self.client
                .post(format!("{}/api/sms/v2/text/single", self.config.nextsms_base_url.trim_end_matches('/')))
                .bearer_auth(&self.config.nextsms_token)
                .header("Accept", "application/json")
                .json(&body).send().await
                .map_err(|e| AppError::ExternalApiError(format!("NextSMS request failed: {}", e.without_url())))?;
            let status = response.status();
            let payload: serde_json::Value = response.json().await.unwrap_or_else(|_| json!({}));
            if !status.is_success() {
                let reason = payload.get("message").or_else(|| payload.get("error"))
                    .and_then(|v| v.as_str()).unwrap_or("request failed").to_string();
                receipts.push(ProviderReceipt::fail("nextsms", format!("NextSMS {}: {}", status, reason)));
                continue;
            }
            let messages = payload.get("messages").and_then(|m| m.as_array()).cloned().unwrap_or_default();
            let Some(entry) = messages.first() else {
                receipts.push(ProviderReceipt::fail("nextsms", "No status returned".to_string()));
                continue;
            };
            let group = entry.pointer("/status/groupName").and_then(|v| v.as_str()).unwrap_or("");
            let name = entry.pointer("/status/name").and_then(|v| v.as_str()).unwrap_or("");
            let rejected = group.eq_ignore_ascii_case("REJECTED") || group.eq_ignore_ascii_case("FAILED")
                || name.starts_with("REJECTED") || name.starts_with("FAILED");
            let id = entry.get("messageId").and_then(|v| v.as_str().map(String::from)
                .or_else(|| v.as_i64().map(|n| n.to_string())));
            if id.is_some() && !rejected {
                receipts.push(ProviderReceipt::ok("nextsms", id));
            } else {
                let why = entry.pointer("/status/description").and_then(|v| v.as_str()).unwrap_or(name);
                let why = if why.is_empty() { "no message id" } else { why };
                let hint = if why.to_ascii_lowercase().contains("sender id") {
                    " — register NEXTSMS_SENDER_ID on your NextSMS account"
                } else { "" };
                receipts.push(ProviderReceipt::fail("nextsms", format!("NextSMS rejected: {why}{hint}")));
            }
        }
        Ok(receipts)
    }

    async fn send_unitxt(&self, numbers: &[String], message: &str) -> AppResult<Vec<ProviderReceipt>> {
        let mut receipts = Vec::with_capacity(numbers.len());
        for number in numbers {
            let body = json!({
                "recipient": normalize_tz_phone(number),
                "sender_id": self.config.unitxt_sender,
                "type": "plain",
                "message": message,
            });
            let response = self.client
                .post(format!("{}/sms/send", self.config.unitxt_base_url.trim_end_matches('/')))
                .bearer_auth(&self.config.unitxt_token)
                .header("Accept", "application/json")
                .json(&body).send().await
                .map_err(|e| AppError::ExternalApiError(format!("UniTxt request failed: {}", e.without_url())))?;
            let status = response.status();
            let payload: serde_json::Value = response.json().await.unwrap_or_else(|_| json!({}));
            if status.is_success() && payload.get("status").and_then(|v| v.as_str()) == Some("success") {
                let id = ["/data/uid", "/data/id", "/data/message_id"].iter()
                    .find_map(|p| payload.pointer(p))
                    .and_then(|v| v.as_str().map(String::from).or_else(|| v.as_i64().map(|n| n.to_string())));
                receipts.push(ProviderReceipt::ok("unitxt", id));
            } else {
                let reason = payload.get("message").and_then(|v| v.as_str())
                    .map(String::from).unwrap_or_else(|| format!("HTTP {}", status.as_u16()));
                receipts.push(ProviderReceipt::fail("unitxt", format!("UniTxt {}: {}", status.as_u16(), reason)));
            }
        }
        Ok(receipts)
    }

    /// Ok only when every recipient was accepted by the provider.
    pub async fn sms_checked(&self, numbers: &[String], message: &str) -> Result<(), String> {
        let receipts = self.sms(numbers, message).await.map_err(|e| e.to_string())?;
        if receipts.is_empty() { return Err("No SMS provider configured".to_string()); }
        let failed: Vec<String> = receipts.iter().filter(|r| !r.success)
            .map(|r| r.error.clone().unwrap_or_else(|| "unknown error".to_string())).collect();
        if failed.is_empty() { Ok(()) } else { Err(failed.join("; ")) }
    }

    // ── Email ────────────────────────────────────────────────────────────────

    pub async fn email(&self, to: &str, subject: &str, html: &str) -> AppResult<ProviderReceipt> {
        match self.config.email_provider.as_str() {
            "smtp" => self.email_smtp(to, subject, html).await,
            "resend" | "" => self.email_resend(to, subject, html).await,
            _ => Err(AppError::ChannelNotConfigured("Email — set EMAIL_PROVIDER=resend or smtp".to_string())),
        }
    }

    async fn email_resend(&self, to: &str, subject: &str, html: &str) -> AppResult<ProviderReceipt> {
        if self.config.resend_api_key.is_empty() {
            return Err(AppError::ChannelNotConfigured("Email — set RESEND_API_KEY".to_string()));
        }
        let from = format_from(&self.config.email_from, &self.config.email_from_name);
        let response = self.client.post("https://api.resend.com/emails")
            .bearer_auth(&self.config.resend_api_key)
            .json(&json!({ "from": from, "to": [to], "subject": subject, "html": html }))
            .send().await
            .map_err(|e| AppError::EmailError(format!("Resend request failed: {}", e.without_url())))?;
        let status = response.status();
        let payload: serde_json::Value = response.json().await.unwrap_or_else(|_| json!({}));
        if status.is_success() {
            Ok(ProviderReceipt::ok("resend", payload.get("id").and_then(|v| v.as_str()).map(String::from)))
        } else {
            let reason = payload.pointer("/message").and_then(|v| v.as_str())
                .map(String::from).unwrap_or_else(|| format!("HTTP {}", status.as_u16()));
            Ok(ProviderReceipt::fail("resend", format!("Resend {}: {}", status.as_u16(), reason)))
        }
    }

    async fn email_smtp(&self, to: &str, subject: &str, html: &str) -> AppResult<ProviderReceipt> {
        if self.config.smtp_host.is_empty() {
            return Err(AppError::ChannelNotConfigured("Email — set SMTP_HOST".to_string()));
        }
        let from_display = format_from(&self.config.email_from, &self.config.email_from_name);
        let from: Mailbox = from_display.parse()
            .map_err(|e| AppError::EmailError(format!("Invalid sender: {e}")))?;
        let to: Mailbox = to.parse().map_err(|e| AppError::EmailError(format!("Invalid recipient: {e}")))?;
        let message = Message::builder().from(from).to(to)
            .subject(subject).header(ContentType::TEXT_HTML).body(html.to_string())
            .map_err(|e| AppError::EmailError(e.to_string()))?;
        let transport = if self.config.smtp_tls {
            AsyncSmtpTransport::<Tokio1Executor>::relay(&self.config.smtp_host)
                .map_err(|e| AppError::EmailError(e.to_string()))?
                .port(self.config.smtp_port)
        } else {
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&self.config.smtp_host)
                .port(self.config.smtp_port)
        };
        let transport = if self.config.smtp_user.is_empty() {
            transport.build()
        } else {
            transport.credentials(Credentials::new(self.config.smtp_user.clone(), self.config.smtp_password.clone())).build()
        };
        transport.send(message).await.map_err(|e| AppError::EmailError(e.to_string()))?;
        Ok(ProviderReceipt::ok("smtp", None))
    }

    /// Email with an inline card image (base64 data URL, supported by Resend).
    pub async fn email_card(&self, to: &str, subject: &str, html: &str, card_png: Option<&[u8]>) -> AppResult<ProviderReceipt> {
        let html = match card_png {
            Some(bytes) if !bytes.is_empty() => {
                let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
                format!("{html}<p><img src=\"data:image/png;base64,{b64}\" alt=\"Your card\" style=\"max-width:420px\" /></p>")
            }
            _ => html.to_string(),
        };
        self.email(to, subject, &html).await
    }

    pub async fn email_checked(&self, to: &str, subject: &str, html: &str) -> Result<(), String> {
        let receipt = self.email(to, subject, html).await.map_err(|e| e.to_string())?;
        if receipt.success { Ok(()) } else { Err(receipt.error.unwrap_or_else(|| "email failed".to_string())) }
    }

    // ── Telegram ─────────────────────────────────────────────────────────────

    pub async fn telegram(&self, chat_id: &str, text: &str) -> AppResult<ProviderReceipt> {
        if self.config.telegram_token.is_empty() {
            return Err(AppError::ChannelNotConfigured("Telegram — set TELEGRAM_BOT_TOKEN".to_string()));
        }
        let url = format!("https://api.telegram.org/bot{}/sendMessage", self.config.telegram_token);
        let response = self.client.post(url)
            .json(&json!({ "chat_id": chat_id, "text": text }))
            .send().await
            .map_err(|e| AppError::ExternalApiError(format!("Telegram request failed: {}", e.without_url())))?;
        let status = response.status();
        let payload: serde_json::Value = response.json().await.unwrap_or_else(|_| json!({}));
        if status.is_success() && payload.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
            Ok(ProviderReceipt::ok("telegram", payload.pointer("/result/message_id").and_then(|v| v.as_i64()).map(|n| n.to_string())))
        } else {
            let reason = payload.pointer("/description").and_then(|v| v.as_str()).unwrap_or("request failed");
            Ok(ProviderReceipt::fail("telegram", reason.to_string()))
        }
    }

    // ── WhatsApp ─────────────────────────────────────────────────────────────

    pub async fn whatsapp_text(&self, to: &str, message: &str) -> AppResult<ProviderReceipt> {
        if self.config.whatsapp_sandbox || !self.whatsapp_ready() {
            return Ok(self.log_sandbox("whatsapp", to, message).await);
        }
        if self.config.whatsapp_provider.eq_ignore_ascii_case("nextsms") {
            // NextSMS renders the approved template body and ignores `text`.
            // The composed message goes into the first named placeholder.
            return self.send_nextsms_whatsapp(to, &[message.to_string()], None).await;
        }
        self.whatsapp_api(json!({
            "messaging_product": "whatsapp",
            "to": normalize_tz_phone(to),
            "type": "text",
            "text": { "body": message },
        })).await
    }

    pub async fn whatsapp_template(
        &self,
        to: &str,
        template_name: &str,
        components: Vec<serde_json::Value>,
    ) -> AppResult<ProviderReceipt> {
        if self.config.whatsapp_sandbox || !self.whatsapp_ready() {
            return Ok(self.log_sandbox("whatsapp", to, &format!("template {template_name}")).await);
        }
        if self.config.whatsapp_provider.eq_ignore_ascii_case("nextsms") {
            let vars = collect_body_variables(&components);
            return self.send_nextsms_whatsapp(to, &vars, Some(template_name)).await;
        }
        self.whatsapp_api(json!({
            "messaging_product": "whatsapp",
            "to": normalize_tz_phone(to),
            "type": "template",
            "template": { "name": template_name, "language": { "code": "en" }, "components": components },
        })).await
    }

    /// NextSMS WhatsApp v2: POST {base}/api/whatsapp/v2/text/single.
    /// Unlike Meta, `to` must be an array and `account` + `template` are required.
    async fn send_nextsms_whatsapp(
        &self,
        to: &str,
        values: &[String],
        template: Option<&str>,
    ) -> AppResult<ProviderReceipt> {
        // Official v2 API: `to` is an array of NUMBERS, and template values go
        // in `personalisation` keyed by the placeholder names without braces.
        let number: u64 = normalize_tz_phone(to).parse().unwrap_or(0);
        let names = if self.config.nextsms_whatsapp_placeholders.is_empty() {
            vec!["message".to_string()]
        } else {
            self.config.nextsms_whatsapp_placeholders.clone()
        };
        let mut personalisation = serde_json::Map::new();
        for (name, value) in names.iter().zip(values.iter()) {
            personalisation.insert(name.clone(), json!(value));
        }
        if personalisation.is_empty() {
            return Ok(ProviderReceipt::fail(
                "nextsms-whatsapp",
                "No template placeholder values supplied".to_string(),
            ));
        }
        let body = json!({
            "to": [number],
            "account": self.config.nextsms_whatsapp_account,
            "template": template.unwrap_or(&self.config.nextsms_whatsapp_template),
            "personalisation": [personalisation],
            "reference": format!("re-{}", Uuid::new_v4().simple()),
        });
        let response = self.client
            .post(format!("{}/api/whatsapp/v2/text/single", self.config.nextsms_base_url.trim_end_matches('/')))
            .bearer_auth(&self.config.nextsms_token)
            .header("Accept", "application/json")
            .json(&body).send().await
            .map_err(|e| AppError::WhatsappError(format!("NextSMS WhatsApp request failed: {}", e.without_url())))?;
        let status = response.status();
        let payload: serde_json::Value = response.json().await.unwrap_or_else(|_| json!({}));
        let has_errors = payload.get("errors").and_then(|v| v.as_object()).map(|m| !m.is_empty()).unwrap_or(false);
        if status.is_success() && !has_errors {
            let id = payload.pointer("/messages/0/id")
                .and_then(|v| v.as_str())
                .or_else(|| payload.get("messageId").and_then(|v| v.as_str()))
                .map(String::from);
            Ok(ProviderReceipt::ok("nextsms-whatsapp", id))
        } else {
            let reason = payload.get("message").and_then(|v| v.as_str())
                .map(String::from)
                .or_else(|| payload.pointer("/errors/template/0").and_then(|v| v.as_str()).map(String::from))
                .unwrap_or_else(|| format!("HTTP {}", status.as_u16()));
            Ok(ProviderReceipt::fail("nextsms-whatsapp", reason))
        }
    }

    async fn whatsapp_api(&self, body: serde_json::Value) -> AppResult<ProviderReceipt> {
        let url = format!("https://graph.facebook.com/{}/{}/messages",
            self.config.whatsapp_version, self.config.whatsapp_phone_id);
        let response = self.client.post(url)
            .bearer_auth(&self.config.whatsapp_token)
            .json(&body).send().await
            .map_err(|e| AppError::WhatsappError(format!("WhatsApp request failed: {}", e.without_url())))?;
        let status = response.status();
        let payload: serde_json::Value = response.json().await.unwrap_or_else(|_| json!({}));
        if status.is_success() {
            Ok(ProviderReceipt::ok("whatsapp", payload.pointer("/messages/0/id").and_then(|v| v.as_str()).map(String::from)))
        } else {
            let reason = payload.pointer("/error/message").and_then(|v| v.as_str())
                .map(String::from).unwrap_or_else(|| format!("HTTP {}", status.as_u16()));
            Ok(ProviderReceipt::fail("whatsapp", reason))
        }
    }
}

impl Default for Channels {
    fn default() -> Self { Self::from_env() }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Accept both `noreply@example.com` and `Name <noreply@example.com>` forms.
fn format_from(address: &str, name: &str) -> String {
    let address = if address.trim().is_empty() { "noreply@royalentry.co.tz" } else { address.trim() };
    if address.contains('<') {
        address.to_string()
    } else {
        format!("{} <{}>", if name.trim().is_empty() { "RoyalEntry" } else { name.trim() }, address)
    }
}

pub fn html_wrap(text: &str) -> String {
    format!(
        "<!doctype html><html><body style=\"font-family:Arial,sans-serif;color:#0f172a;line-height:1.6\">\
         <div style=\"max-width:600px;margin:auto;padding:24px;border-top:4px solid #0f172a\">{}</div>\
         </body></html>",
        text
    )
}

/// NextSMS/Unitxt expect international format without the leading `+`:
/// `255712345678`. Accept `+255…`, `255…`, `0712…` and `712…` on input.
fn normalize_tz_phone(phone: &str) -> String {
    let trimmed = phone.trim().replace([' ', '-'], "");
    if trimmed.is_empty() { return trimmed; }
    if let Some(rest) = trimmed.strip_prefix('+') { return rest.to_string(); }
    if trimmed.starts_with("255") { return trimmed; }
    if let Some(rest) = trimmed.strip_prefix('0') { return format!("255{rest}"); }
    if trimmed.starts_with('7') { return format!("255{trimmed}"); }
    trimmed
}

#[derive(Debug, Clone, Copy)]
pub struct SmsSegments {
    pub count: usize,
    pub per_message: usize,
    pub unicode: bool,
}

/// GSM-7 fits 160 chars per segment (153 when concatenated); UCS-2 fits 70/67.
pub fn sms_segments(text: &str) -> SmsSegments {
    let unicode = text.chars().any(|c| !c.is_ascii());
    let single = if unicode { 70 } else { 160 };
    let multi = if unicode { 67 } else { 153 };
    let len = text.chars().count();
    if len <= single {
        SmsSegments { count: 1, per_message: single, unicode }
    } else {
        SmsSegments { count: len.div_ceil(multi), per_message: multi, unicode }
    }
}

impl Channels {
    /// Send many personalised SMS in one provider request (NextSMS v2 multi).
    /// Falls back to individual sends when no multi-capable provider is set.
    pub async fn sms_multi(&self, messages: &[(String, String)]) -> AppResult<Vec<ProviderReceipt>> {
        if messages.is_empty() {
            return Ok(Vec::new());
        }
        if self.config.sms_sandbox {
            let mut out = Vec::with_capacity(messages.len());
            for (to, text) in messages {
                out.push(self.log_sandbox("sms", to, text).await);
            }
            return Ok(out);
        }

        // Try the provider batch endpoint first. If it is unavailable, rejected
        // (e.g. sender not enabled for bulk or duplicate protection), fall back
        // to the single-send path that already works for gate codes.
        if !self.config.nextsms_token.is_empty() && !self.config.nextsms_sender.is_empty() {
            let items: Vec<serde_json::Value> = messages
                .iter()
                .map(|(to, text)| json!({
                    "from": self.config.nextsms_sender,
                    "to": normalize_tz_phone(to),
                    "text": text,
                }))
                .collect();
            let batch_result = self.client
                .post(format!("{}/api/sms/v2/text/multi", self.config.nextsms_base_url.trim_end_matches('/')))
                .bearer_auth(&self.config.nextsms_token)
                .header("Accept", "application/json")
                .json(&json!({"messages": items, "reference": format!("re-batch-{}", Uuid::new_v4().simple())}))
                .send().await;
            if let Ok(response) = batch_result {
                let status = response.status();
                let payload: serde_json::Value = response.json().await.unwrap_or_else(|_| json!({}));
                if status.is_success() {
                    let returned = payload.get("messages").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                    let receipts: Vec<ProviderReceipt> = messages.iter().enumerate().map(|(i, _)| {
                        match returned.get(i) {
                            Some(entry) => {
                                let group = entry.pointer("/status/groupName").and_then(|v| v.as_str()).unwrap_or("");
                                let rejected = group.eq_ignore_ascii_case("REJECTED") || group.eq_ignore_ascii_case("FAILED");
                                let id = entry.get("messageId").and_then(|v| v.as_str().map(String::from)
                                    .or_else(|| v.as_i64().map(|n| n.to_string())));
                                if rejected || id.is_none() {
                                    let why = entry.pointer("/status/description").and_then(|v| v.as_str()).unwrap_or("rejected");
                                    ProviderReceipt::fail("nextsms", why.to_string())
                                } else {
                                    ProviderReceipt::ok("nextsms", id)
                                }
                            }
                            None => ProviderReceipt::fail("nextsms", "No status returned".to_string()),
                        }
                    }).collect();
                    if receipts.iter().any(|r| r.success) {
                        return Ok(receipts);
                    }
                } else {
                    let reason = payload.get("message").and_then(|v| v.as_str()).unwrap_or("batch rejected");
                    tracing::warn!(error = reason, "NextSMS batch rejected — falling back to single sends");
                }
            }
        }

        // Single-send fallback (works with the same sender ID and avoids the
        // batch duplicate-protection rule).
        let mut out = Vec::with_capacity(messages.len());
        for (to, text) in messages {
            let mut receipts = self.sms(&[to.clone()], text).await?;
            out.push(receipts.pop().unwrap_or_else(|| ProviderReceipt::fail("sms", "No receipt".to_string())));
        }
        Ok(out)
    }
}

impl Channels {
    /// Send a WhatsApp template message with the rendered card image as its
    /// header. NextSMS accepts base64 image data in `header.image.file`.
    pub async fn whatsapp_card(
        &self,
        to: &str,
        image_png: &[u8],
        message: &str,
    ) -> AppResult<ProviderReceipt> {
        if self.config.whatsapp_sandbox || !self.whatsapp_ready() {
            return Ok(self.log_sandbox("whatsapp", to, message).await);
        }
        if self.config.whatsapp_provider.eq_ignore_ascii_case("nextsms") {
            let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, image_png);
            let names = if self.config.nextsms_whatsapp_placeholders.is_empty() {
                vec!["message".to_string()]
            } else {
                self.config.nextsms_whatsapp_placeholders.clone()
            };
            let mut personalisation = serde_json::Map::new();
            if let Some(name) = names.first() {
                personalisation.insert(name.clone(), json!(message));
            }
            let body = json!({
                "to": [normalize_tz_phone(to).parse::<u64>().unwrap_or(0)],
                "account": self.config.nextsms_whatsapp_account,
                "template": self.config.nextsms_whatsapp_template,
                "personalisation": [personalisation],
                "header": { "image": { "file": format!("data:image/png;base64,{}", b64), "name": "checkin-card.png" } },
                "reference": format!("re-card-{}", Uuid::new_v4().simple()),
            });
            let response = self.client
                .post(format!("{}/api/whatsapp/v2/text/single", self.config.nextsms_base_url.trim_end_matches('/')))
                .bearer_auth(&self.config.nextsms_token)
                .header("Accept", "application/json")
                .json(&body).send().await
                .map_err(|e| AppError::WhatsappError(format!("NextSMS WhatsApp card failed: {}", e.without_url())))?;
            let status = response.status();
            let payload: serde_json::Value = response.json().await.unwrap_or_else(|_| json!({}));
            let has_errors = payload.get("errors").and_then(|v| v.as_object()).map(|m| !m.is_empty()).unwrap_or(false);
            if status.is_success() && !has_errors {
                let id = payload.pointer("/messages/0/id").and_then(|v| v.as_str()).map(String::from);
                Ok(ProviderReceipt::ok("nextsms-whatsapp", id))
            } else {
                let reason = payload.get("message").and_then(|v| v.as_str()).unwrap_or("card send rejected").to_string();
                Ok(ProviderReceipt::fail("nextsms-whatsapp", reason))
            }
        } else {
            // Meta Cloud API needs a media upload first; fall back to text with
            // the card link so the guest still receives their credentials.
            self.whatsapp_text(to, message).await
        }
    }
}
