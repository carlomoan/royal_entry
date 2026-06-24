// ==============================================================================
// FILE: src/error.rs
// ==============================================================================
// Comprehensive error handling for the entire application

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

/// Application error types
#[derive(Debug, Error)]
pub enum AppError {
    // ========================================================================
    // Authentication Errors
    // ========================================================================
    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Invalid token")]
    InvalidToken,

    #[error("Invalid token type, expected: {0}")]
    InvalidTokenType(String),

    #[error("Token generation failed")]
    TokenGenerationFailed,

    #[error("Password hashing failed")]
    PasswordHashingFailed,

    #[error("Invalid password hash")]
    InvalidPasswordHash,

    #[error("Email already exists")]
    EmailAlreadyExists,

    // ========================================================================
    // Database Errors
    // ========================================================================
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    // ========================================================================
    // Validation Errors
    // ========================================================================
    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    // ========================================================================
    // Authorization Errors
    // ========================================================================
    #[error("Forbidden")]
    Forbidden,

    #[error("Access denied: {0}")]
    AccessDenied(String),

    // ========================================================================
    // Business Logic Errors
    // ========================================================================
    #[error("QR code not found")]
    QrNotFound,

    #[error("QR code expired")]
    QrExpired,

    #[error("Guest already scanned")]
    DuplicateScan,

    #[error("Invalid QR code")]
    InvalidQrCode,

    #[error("Event not found")]
    EventNotFound,

    #[error("Event is inactive")]
    EventInactive,

    #[error("Guest not found")]
    GuestNotFound,

    #[error("Invitation not found")]
    InvitationNotFound,

    // ========================================================================
    // Payment Errors
    // ========================================================================
    #[error("Payment processing failed: {0}")]
    PaymentError(String),

    #[error("Invalid payment method")]
    InvalidPaymentMethod,

    #[error("Payment already processed")]
    PaymentAlreadyProcessed,

    // ========================================================================
    // Messaging Errors
    // ========================================================================
    #[error("SMS sending failed: {0}")]
    SmsError(String),

    #[error("WhatsApp sending failed: {0}")]
    WhatsappError(String),

    #[error("Email sending failed: {0}")]
    EmailError(String),

    // ========================================================================
    // QR Code Errors
    // ========================================================================
    #[error("QR code generation failed: {0}")]
    QrGenerationError(String),

    #[error("QR code validation failed: {0}")]
    QrValidationError(String),

    // ========================================================================
    // External API Errors
    // ========================================================================
    #[error("External API error: {0}")]
    ExternalApiError(String),

    #[error("M-Pesa API error: {0}")]
    MpesaError(String),

    // ========================================================================
    // Server Errors
    // ========================================================================
    #[error("Internal server error")]
    InternalServerError,

    #[error("Service unavailable")]
    ServiceUnavailable,

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Request timeout")]
    RequestTimeout,

    // ========================================================================
    // File Operation Errors
    // ========================================================================
    #[error("File upload failed: {0}")]
    FileUploadError(String),

    #[error("File not found")]
    FileNotFound,

    #[error("Invalid file type")]
    InvalidFileType,

    // ========================================================================
    // Conflict Errors
    // ========================================================================
    #[error("Resource already exists")]
    AlreadyExists,

    #[error("Conflict: {0}")]
    Conflict(String),

    // ========================================================================
    // Unprocessable Entity Errors
    // ========================================================================
    #[error("Invalid input: {0}")]
    UnprocessableEntity(String),

    // ========================================================================
    // Generic Errors
    // ========================================================================
    #[error("{0}")]
    GenericError(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_code, message) = match self {
            // ====================================================================
            // 401 Unauthorized
            // ====================================================================
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", msg),
            AppError::InvalidToken => (
                StatusCode::UNAUTHORIZED,
                "INVALID_TOKEN",
                "Invalid or expired token".to_string(),
            ),
            AppError::InvalidTokenType(expected) => (
                StatusCode::UNAUTHORIZED,
                "INVALID_TOKEN_TYPE",
                format!("Expected {} token", expected),
            ),

            // ====================================================================
            // 403 Forbidden
            // ====================================================================
            AppError::Forbidden => (
                StatusCode::FORBIDDEN,
                "FORBIDDEN",
                "Access denied".to_string(),
            ),
            AppError::AccessDenied(msg) => (StatusCode::FORBIDDEN, "ACCESS_DENIED", msg),

            // ====================================================================
            // 404 Not Found
            // ====================================================================
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "NOT_FOUND", msg),
            AppError::EventNotFound => (
                StatusCode::NOT_FOUND,
                "EVENT_NOT_FOUND",
                "Event not found".to_string(),
            ),
            AppError::GuestNotFound => (
                StatusCode::NOT_FOUND,
                "GUEST_NOT_FOUND",
                "Guest not found".to_string(),
            ),
            AppError::InvitationNotFound => (
                StatusCode::NOT_FOUND,
                "INVITATION_NOT_FOUND",
                "Invitation not found".to_string(),
            ),
            AppError::QrNotFound => (
                StatusCode::NOT_FOUND,
                "QR_NOT_FOUND",
                "QR code not found".to_string(),
            ),
            AppError::FileNotFound => (
                StatusCode::NOT_FOUND,
                "FILE_NOT_FOUND",
                "File not found".to_string(),
            ),

            // ====================================================================
            // 400 Bad Request
            // ====================================================================
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "BAD_REQUEST", msg),
            AppError::ValidationError(msg) => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR", msg),
            AppError::InvalidQrCode => (
                StatusCode::BAD_REQUEST,
                "INVALID_QR_CODE",
                "Invalid QR code".to_string(),
            ),
            AppError::InvalidPaymentMethod => (
                StatusCode::BAD_REQUEST,
                "INVALID_PAYMENT_METHOD",
                "Invalid payment method".to_string(),
            ),
            AppError::InvalidFileType => (
                StatusCode::BAD_REQUEST,
                "INVALID_FILE_TYPE",
                "Invalid file type".to_string(),
            ),
            AppError::SmsError(msg) => (StatusCode::BAD_REQUEST, "SMS_ERROR", msg),
            AppError::WhatsappError(msg) => (StatusCode::BAD_REQUEST, "WHATSAPP_ERROR", msg),

            // ====================================================================
            // 409 Conflict
            // ====================================================================
            AppError::DuplicateScan => (
                StatusCode::CONFLICT,
                "DUPLICATE_SCAN",
                "Guest already scanned".to_string(),
            ),
            AppError::EmailAlreadyExists => (
                StatusCode::CONFLICT,
                "EMAIL_ALREADY_EXISTS",
                "Email already registered".to_string(),
            ),
            AppError::AlreadyExists => (
                StatusCode::CONFLICT,
                "ALREADY_EXISTS",
                "Resource already exists".to_string(),
            ),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, "CONFLICT", msg),
            AppError::PaymentAlreadyProcessed => (
                StatusCode::CONFLICT,
                "PAYMENT_ALREADY_PROCESSED",
                "Payment already processed".to_string(),
            ),

            // ====================================================================
            // 410 Gone - Expired Resource
            // ====================================================================
            AppError::QrExpired => (
                StatusCode::GONE,
                "QR_EXPIRED",
                "QR code expired".to_string(),
            ),
            AppError::EventInactive => (
                StatusCode::GONE,
                "EVENT_INACTIVE",
                "Event is no longer active".to_string(),
            ),

            // ====================================================================
            // 422 Unprocessable Entity
            // ====================================================================
            AppError::UnprocessableEntity(msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "UNPROCESSABLE_ENTITY",
                msg,
            ),
            AppError::QrValidationError(msg) => {
                (StatusCode::UNPROCESSABLE_ENTITY, "QR_VALIDATION_ERROR", msg)
            }

            // ====================================================================
            // 429 Too Many Requests
            // ====================================================================
            AppError::RateLimitExceeded => (
                StatusCode::TOO_MANY_REQUESTS,
                "RATE_LIMIT_EXCEEDED",
                "Too many requests. Please try again later".to_string(),
            ),

            // ====================================================================
            // 500 Internal Server Error
            // ====================================================================
            AppError::Database(ref err) => {
                tracing::error!("Database error: {}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "DATABASE_ERROR",
                    "Database error occurred".to_string(),
                )
            }
            AppError::InternalServerError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "Internal server error".to_string(),
            ),
            AppError::TokenGenerationFailed => {
                tracing::error!("Token generation failed");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "TOKEN_GENERATION_FAILED",
                    "Failed to generate token".to_string(),
                )
            }
            AppError::PasswordHashingFailed => {
                tracing::error!("Password hashing failed");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "PASSWORD_HASHING_FAILED",
                    "Failed to process password".to_string(),
                )
            }
            AppError::InvalidPasswordHash => {
                tracing::error!("Invalid password hash");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INVALID_PASSWORD_HASH",
                    "Invalid password hash".to_string(),
                )
            }
            AppError::QrGenerationError(msg) => {
                tracing::error!("QR generation error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "QR_GENERATION_ERROR",
                    "Failed to generate QR code".to_string(),
                )
            }
            AppError::FileUploadError(msg) => {
                tracing::error!("File upload error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "FILE_UPLOAD_ERROR", msg)
            }
            AppError::EmailError(msg) => {
                tracing::error!("Email error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "EMAIL_ERROR",
                    "Failed to send email".to_string(),
                )
            }

            // ====================================================================
            // 502 Bad Gateway
            // ====================================================================
            AppError::ExternalApiError(msg) => (StatusCode::BAD_GATEWAY, "EXTERNAL_API_ERROR", msg),
            AppError::MpesaError(msg) => (StatusCode::BAD_GATEWAY, "MPESA_ERROR", msg),
            AppError::PaymentError(msg) => (StatusCode::BAD_GATEWAY, "PAYMENT_ERROR", msg),

            // ====================================================================
            // 503 Service Unavailable
            // ====================================================================
            AppError::ServiceUnavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "SERVICE_UNAVAILABLE",
                "Service temporarily unavailable".to_string(),
            ),
            AppError::RequestTimeout => (
                StatusCode::SERVICE_UNAVAILABLE,
                "REQUEST_TIMEOUT",
                "Request timeout".to_string(),
            ),

            // ====================================================================
            // Generic / Unknown
            // ====================================================================
            AppError::GenericError(msg) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", msg)
            }
        };

        let body = Json(json!({
            "success": false,
            "error": {
                "code": error_code,
                "message": message,
                "status": status.as_u16(),
            }
        }));

        (status, body).into_response()
    }
}

/// Result type alias
pub type AppResult<T> = Result<T, AppError>;
