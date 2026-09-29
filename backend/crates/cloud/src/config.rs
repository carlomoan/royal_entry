// ==============================================================================
// FILE: src/config.rs
// ==============================================================================
// Direct environment variable loading — no config-crate separator ambiguity.
// Every field maps to an explicit env var name. Easy to debug.

use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub app: AppConfig,
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub jwt: JwtConfig,
    pub mpesa: MpesaConfig,
    pub sms: SmsConfig,
    pub whatsapp: WhatsappConfig,
    pub email: EmailConfig,
    pub aws: AwsConfig,
    pub security: SecurityConfig,
}

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub name: String,
    pub version: String,
    pub environment: String,
    pub url: String,
    pub frontend_url: String,
}

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub connection_timeout_secs: u64,
    pub idle_timeout_secs: u64,
}

#[derive(Debug, Clone)]
pub struct JwtConfig {
    pub secret: String,
    pub expiry_hours: i64,
    pub refresh_expiry_days: i64,
}

#[derive(Debug, Clone)]
pub struct MpesaConfig {
    pub consumer_key: String,
    pub consumer_secret: String,
    pub shortcode: String,
    pub passkey: String,
    pub environment: String, // sandbox | production
}

#[derive(Debug, Clone)]
pub struct SmsConfig {
    pub api_key: String,
    pub username: String,
    pub from_name: String,
}

#[derive(Debug, Clone)]
pub struct WhatsappConfig {
    pub callmebot_api_key: String,
}

#[derive(Debug, Clone)]
pub struct EmailConfig {
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_user: String,
    pub smtp_password: String,
    pub from_address: String,
    pub from_name: String,
}

#[derive(Debug, Clone)]
pub struct AwsConfig {
    pub s3_bucket: String,
    pub region: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub endpoint_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SecurityConfig {
    pub qr_encryption_key: String,
    pub qr_signing_key: String,
    pub cors_allowed_origins: Vec<String>,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Read required env var — panics with a clear message if missing.
fn require(key: &str) -> String {
    env::var(key).unwrap_or_else(|_| {
        panic!(
            "\n\n[RoyalEntry] Missing required environment variable: {}\n\
             Check your .env file and ensure it is loaded before starting.\n",
            key
        )
    })
}

/// Read optional env var, return default if absent.
fn optional(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

/// Parse a required numeric env var.
fn _require_num<T: std::str::FromStr>(key: &str) -> T
where
    T::Err: std::fmt::Display,
{
    let raw = require(key);
    raw.parse::<T>().unwrap_or_else(|e| {
        panic!(
            "\n\n[RoyalEntry] Environment variable {} has invalid value {:?}: {}\n",
            key, raw, e
        )
    })
}

/// Parse an optional numeric env var.
fn optional_num<T: std::str::FromStr>(key: &str, default: T) -> T
where
    T::Err: std::fmt::Display,
{
    match env::var(key) {
        Ok(raw) => raw.parse::<T>().unwrap_or_else(|e| {
            panic!(
                "\n\n[RoyalEntry] Environment variable {} has invalid value {:?}: {}\n",
                key, raw, e
            )
        }),
        Err(_) => default,
    }
}

// ── Config::from_env ─────────────────────────────────────────────────────────

impl Config {
    pub fn from_env() -> Self {
        Self {
            app: AppConfig {
                name: optional("APP_NAME", "RoyalEntry"),
                version: optional("APP_VERSION", "0.1.0"),
                environment: optional("ENVIRONMENT", "development"),
                url: optional("APP_URL", "http://localhost:3000"),
                frontend_url: optional("FRONTEND_URL", "http://localhost:5173"),
            },

            server: ServerConfig {
                host: optional("SERVER_HOST", "127.0.0.1"),
                port: optional_num("SERVER_PORT", 3000u16),
            },

            database: DatabaseConfig {
                url: require("DATABASE_URL"),
                max_connections: optional_num("DATABASE_MAX_CONNECTIONS", 20u32),
                connection_timeout_secs: optional_num("DATABASE_CONNECTION_TIMEOUT_SECS", 30u64),
                idle_timeout_secs: optional_num("DATABASE_IDLE_TIMEOUT_SECS", 300u64),
            },

            jwt: JwtConfig {
                secret: require("JWT_SECRET"),
                expiry_hours: optional_num("JWT_EXPIRY_HOURS", 24i64),
                refresh_expiry_days: optional_num("JWT_REFRESH_EXPIRY_DAYS", 30i64),
            },

            mpesa: MpesaConfig {
                consumer_key: optional("MPESA_CONSUMER_KEY", ""),
                consumer_secret: optional("MPESA_CONSUMER_SECRET", ""),
                shortcode: optional("MPESA_SHORTCODE", "174379"),
                passkey: optional("MPESA_PASSKEY", ""),
                environment: optional("MPESA_ENVIRONMENT", "sandbox"),
            },

            sms: SmsConfig {
                api_key: optional("AT_API_KEY", ""),
                username: optional("AT_USERNAME", "sandbox"),
                from_name: optional("AT_FROM_NAME", "RoyalEntry"),
            },

            whatsapp: WhatsappConfig {
                callmebot_api_key: optional("WHATSAPP_CALLMEBOT_API_KEY", ""),
            },

            email: EmailConfig {
                smtp_host: optional("SMTP_HOST", "smtp.gmail.com"),
                smtp_port: optional_num("SMTP_PORT", 587u16),
                smtp_user: optional("SMTP_USER", ""),
                smtp_password: optional("SMTP_PASSWORD", ""),
                from_address: optional("SMTP_FROM_ADDRESS", "noreply@royalentry.co.tz"),
                from_name: optional("SMTP_FROM_NAME", "RoyalEntry"),
            },

            aws: AwsConfig {
                s3_bucket: optional("AWS_S3_BUCKET", "royalentry-uploads"),
                region: optional("AWS_REGION", "us-east-1"),
                access_key_id: optional("AWS_ACCESS_KEY_ID", ""),
                secret_access_key: optional("AWS_SECRET_ACCESS_KEY", ""),
                endpoint_url: env::var("AWS_ENDPOINT_URL").ok().filter(|s| !s.is_empty()),
            },

            security: SecurityConfig {
                qr_encryption_key: optional("QR_ENCRYPTION_KEY", ""),
                qr_signing_key: optional("QR_SIGNING_KEY", ""),
                cors_allowed_origins: optional(
                    "CORS_ALLOWED_ORIGINS",
                    "http://localhost:3000,http://localhost:5173",
                )
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect(),
            },
        }
    }
}
