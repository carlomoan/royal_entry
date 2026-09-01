// ==============================================================================
// FILE: src/handlers/payments.rs
// ==============================================================================

use axum::{
    extract::{Query, State},
    http::StatusCode,
    Extension, Json,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

use crate::{
    error::{AppError, AppResult},
    models::{
        payment::{
            InitiatePaymentRequest, InitiatePaymentResponse,
            PaymentResponse,
        },
        user::Claims,
    },
    repository::payment_repository::PaymentRepository,
    services::mpesa::{MpesaCallback, MpesaService},
    AppState,
};

// ==============================================================================
// POST /api/v1/payments/mpesa/initiate
// ==============================================================================

/// Initiate a Lipa Na M-Pesa payment (STK Push).
///
/// Request:
/// ```json
/// {
///   "event_id": "optional-uuid",
///   "package_name": "Standard",
///   "amount_tsh": 200000,
///   "phone": "+255700001001"
/// }
/// ```
///
/// Response (200):
/// ```json
/// {
///   "payment_id": "uuid",
///   "checkout_request_id": "ws_CO_...",
///   "message": "Payment request sent to +255700001001. Enter M-Pesa PIN to confirm."
/// }
/// ```
pub async fn initiate_mpesa_payment(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<InitiatePaymentRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    payload.validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    if payload.amount_tsh <= 0 {
        return Err(AppError::BadRequest("Amount must be greater than 0".to_string()));
    }

    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    // Normalize phone
    let phone_normalized = MpesaService::normalize_phone(&payload.phone);
    if phone_normalized.len() < 10 {
        return Err(AppError::BadRequest("Invalid phone number".to_string()));
    }

    let mpesa = MpesaService::new(state.clone());

    // Build a short reference visible to customer on their M-Pesa screen
    let reference = format!("ROYALENTRY-{}", &payload.package_name.to_uppercase()[..4.min(payload.package_name.len())]);

    // Initiate STK Push
    let stk_response = mpesa
        .stk_push(
            &payload.phone,
            payload.amount_tsh as u64,
            &reference,
            &format!("RoyalEntry {} package", payload.package_name),
        )
        .await?;

    // Persist pending payment record
    let payment = PaymentRepository::create_pending(
        state.db.pool(),
        org_id,
        payload.event_id,
        &payload.package_name,
        payload.amount_tsh,
        &phone_normalized,
        &stk_response.checkout_request_id,
    )
    .await?;

    tracing::info!(
        payment_id          = %payment.id,
        checkout_request_id = %stk_response.checkout_request_id,
        amount_tsh          = payload.amount_tsh,
        phone               = %phone_normalized,
        "STK Push initiated"
    );

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": InitiatePaymentResponse {
                payment_id: payment.id,
                checkout_request_id: stk_response.checkout_request_id.clone(),
                message: format!(
                    "Payment request sent to {}. Enter M-Pesa PIN to confirm.",
                    payload.phone
                ),
            }
        })),
    ))
}

// ==============================================================================
// POST /api/v1/payments/mpesa/callback  (PUBLIC — called by Safaricom)
// ==============================================================================

/// Webhook called by Safaricom Daraja when payment completes.
///
/// This endpoint MUST be publicly accessible (no JWT required).
/// Safaricom will POST the result here after the customer confirms or cancels.
pub async fn mpesa_callback(
    State(state): State<Arc<AppState>>,
    Json(callback): Json<MpesaCallback>,
) -> (StatusCode, Json<serde_json::Value>) {
    match MpesaService::extract_callback(&callback) {
        Ok(Some(result)) => {
            // Payment succeeded
            match PaymentRepository::mark_completed(
                state.db.pool(),
                &result.checkout_request_id,
                &result.mpesa_receipt_number,
                result.amount as i64,
            )
            .await
            {
                Ok(payment) => {
                    tracing::info!(
                        payment_id   = %payment.id,
                        receipt      = %result.mpesa_receipt_number,
                        amount_tsh   = result.amount,
                        "M-Pesa payment confirmed and recorded"
                    );

                    // TODO (Phase 2): trigger event approval notification
                    // TODO (Phase 2): send SMS/WhatsApp receipt to payer
                }
                Err(e) => {
                    tracing::error!(error = %e, "Failed to mark payment completed");
                }
            }
        }
        Ok(None) => {
            // Payment failed or was cancelled by user
            let stk = &callback.body.stk_callback;
            let _ = PaymentRepository::mark_failed(
                state.db.pool(),
                &stk.checkout_request_id,
                &stk.result_desc,
            )
            .await;

            tracing::warn!(
                checkout_request_id = %stk.checkout_request_id,
                reason              = %stk.result_desc,
                "M-Pesa payment not completed"
            );
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to parse M-Pesa callback");
        }
    }

    // Daraja expects a 200 OK with this body regardless of our outcome
    (
        StatusCode::OK,
        Json(json!({
            "ResultCode": 0,
            "ResultDesc": "Accepted"
        })),
    )
}

// ==============================================================================
// GET /api/v1/payments/:id/status
// ==============================================================================

/// Get the current status of a payment.
///
/// If the payment is still pending, this also queries Daraja
/// for the latest status (useful as a polling fallback).
pub async fn get_payment_status(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(payment_id): axum::extract::Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    let payment = PaymentRepository::get_by_id(state.db.pool(), payment_id)
        .await?
        .ok_or(AppError::NotFound("Payment not found".to_string()))?;

    // Ensure it belongs to this org
    if payment.organization_id != org_id {
        return Err(AppError::Forbidden);
    }

    // If still pending and we have a checkout_request_id, query Daraja
    let mut live_status: Option<String> = None;
    if payment.status == "pending" {
        if let Some(ref cid) = payment.checkout_request_id {
            let mpesa = MpesaService::new(state.clone());
            match mpesa.query_stk_status(cid).await {
                Ok(q) => {
                    live_status = Some(format!(
                        "[{}] {}",
                        q.result_code, q.result_desc
                    ));
                    // If Daraja says it's done (result_code "0") but our DB still says pending,
                    // this means the callback hasn't arrived yet — caller should wait.
                    tracing::debug!(
                        payment_id  = %payment_id,
                        result_code = %q.result_code,
                        "STK status polled"
                    );
                }
                Err(e) => {
                    tracing::warn!(error = %e, "STK status query failed");
                }
            }
        }
    }

    Ok(Json(json!({
        "success": true,
        "data": {
            "payment": PaymentResponse::from(payment),
            "live_status": live_status,
        }
    })))
}

// ==============================================================================
// GET /api/v1/payments
// ==============================================================================

/// List all payments for the current organization
pub async fn list_payments(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Query(pagination): Query<crate::models::guest::PaginationQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    let limit   = pagination.limit();
    let offset  = pagination.offset();
    let page    = pagination.page.unwrap_or(1);
    let per_page = pagination.per_page.unwrap_or(20);

    let (payments, total) = PaymentRepository::list_by_organization(
        state.db.pool(),
        org_id,
        limit,
        offset,
    )
    .await?;

    let responses: Vec<PaymentResponse> = payments
        .into_iter()
        .map(PaymentResponse::from)
        .collect();

    use crate::models::guest::PaginationMeta;

    Ok(Json(json!({
        "success": true,
        "data": responses,
        "pagination": PaginationMeta::new(page, per_page, total)
    })))
}

// ==============================================================================
// GET /api/v1/payments/:id/receipt
// ==============================================================================

/// Download a PDF receipt for a completed payment.
pub async fn download_payment_receipt(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    axum::extract::Path(payment_id): axum::extract::Path<Uuid>,
) -> AppResult<(StatusCode, [(String, String); 2], Vec<u8>)> {
    let org_id = Uuid::parse_str(&claims.org_id)
        .map_err(|_| AppError::InvalidToken)?;

    let payment = PaymentRepository::get_by_id(state.db.pool(), payment_id)
        .await?
        .ok_or(AppError::NotFound("Payment not found".to_string()))?;

    if payment.organization_id != org_id {
        return Err(AppError::Forbidden);
    }

    let pdf_bytes = crate::services::PdfService::new(state.clone())
        .generate_payment_receipt(payment_id)
        .await?;

    let filename = format!("receipt-{}.pdf", payment_id.simple());
    let headers = [
        ("Content-Type".to_string(), "application/pdf".to_string()),
        (
            "Content-Disposition".to_string(),
            format!(r#"attachment; filename="{}""#, filename),
        ),
    ];

    Ok((StatusCode::OK, headers, pdf_bytes))
}
