use crate::{
    channels::registry::get_channel,
    channels::traits::{ChannelKind, OutboundMessage, Attachment},
    error::{AppResult, AppError},
    retry::scheduler::{get_retry_delay, should_retry, max_retry_attempts},
    qr::token::VerifyPayload,
    qr::render::render_qr_png,
    cards::renderer::composite_card,
    files::storage::{Storage, LocalStorage},
};
use std::path::Path;
use std::sync::Arc;

pub struct BroadcastDispatcher;

impl BroadcastDispatcher {
    pub async fn dispatch_batch(
        broadcast_id: uuid::Uuid,
        event_id: uuid::Uuid,
        recipients: Vec<uuid::Uuid>,
        channels: Vec<ChannelKind>,
        state: Arc<crate::AppState>,
    ) -> AppResult<()> {
        // 1. Pick queued broadcast_deliveries (batch=50)
        // 2. For each recipient × each channel:
        for recipient_id in recipients {
            for channel_kind in &channels {
                // 9a. Generate secure QR token (per recipient)
                let payload = VerifyPayload::new(
                    recipient_id,
                    event_id,
                    None, // card_template_id — would come from broadcast config
                    3600, // 1 hour expiry
                );

                // 9b. Render QR PNG
                let check_in_url = format!("{}/public/verify?t={}",
                    state.config.app.frontend_url,
                    base64::encode(&payload.to_string()) // placeholder encoding
                );
                let qr_png = render_qr_png(&check_in_url)?;

                // 9c. Composite QR + guest text onto card → PNG
                // (Placeholder: uses background from card template)
                let card_png = qr_png; // In full impl: composite_card(...)

                // 9d. Upload rendered card → file storage → file_id + signed URL
                let storage = LocalStorage::new("uploads");
                let file_path = format!("broadcast_{}_{}_{}.png", broadcast_id, recipient_id, channel_kind.as_str());
                let file_id = storage.upload(Path::new(&file_path), card_png, "image/png").await?;
                let signed_url = storage.signed_url(&file_path, 3600).await?;

                // 9e. Render message body via Handlebars
                let message_body = format!(
                    "Dear attendee, your invitation card is ready. Check-in link: {}",
                    signed_url
                );

                // 9f. Build OutboundMessage
                let outbound = OutboundMessage {
                    to: recipient_id.to_string(), // Would resolve to actual phone/email
                    body: message_body,
                    attachments: vec![Attachment {
                        file_id: file_id.clone(),
                        url: signed_url,
                        mime_type: "image/png".to_string(),
                    }],
                };

                // 9g. Call channel.send()
                let channel = get_channel(channel_kind.clone());
                let receipt = channel.send(&outbound).await?;

                // 9h. Update broadcast_deliveries
                sqlx::query(
                    "UPDATE broadcast_deliveries SET status = $2, gateway_msg_id = $3, response = $4, retry_count = $5, updated_at = NOW() WHERE broadcast_id = $1 AND recipient_id = $6"
                )
                .bind(broadcast_id)
                .bind(if receipt.success { "sent" } else { "failed" })
                .bind(receipt.provider_message_id.as_deref().unwrap_or(""))
                .bind(receipt.raw_response.as_deref().unwrap_or(""))
                .bind(0) // retry_count — would increment on retry
                .bind(recipient_id)
                .execute(&*state.db.pool())
                .await?;

                // 9i. Append message_logs row (immutable audit trail)
                sqlx::query(
                    r#"INSERT INTO message_logs (broadcast_id, delivery_id, recipient_id, event_id, channel, status, gateway_msg_id, response, retry_count, created_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())"#
                )
                .bind(broadcast_id)
                .bind(uuid::Uuid::new_v4()) // delivery_id — would reference actual delivery
                .bind(recipient_id)
                .bind(event_id)
                .bind(channel_kind.as_str())
                .bind(if receipt.success { "sent" } else { "failed" })
                .bind(receipt.provider_message_id.as_deref().unwrap_or(""))
                .bind(receipt.raw_response.as_deref().unwrap_or(""))
                .bind(0)
                .execute(&*state.db.pool())
                .await?;

                // 10. Retry with exponential backoff: 1m, 5m, 15m, 1h, 6h (max 5)
                if !receipt.success {
                    tracing::warn!("Delivery failed for recipient {} via {:?}: {:?}",
                        recipient_id, channel_kind, receipt.error_message);

                    // Get current retry count from DB
                    let current_retry: i32 = sqlx::query_scalar(
                        "SELECT retry_count FROM broadcast_deliveries WHERE broadcast_id = $1 AND recipient_id = $2"
                    )
                    .bind(broadcast_id)
                    .bind(recipient_id)
                    .fetch_one(&*state.db.pool())
                    .await
                    .unwrap_or(0);

                    if should_retry(current_retry as u32) {
                        let delay = get_retry_delay(current_retry as u32).unwrap_or(60);
                        tracing::info!("Scheduling retry for recipient {} in {} seconds (attempt {})",
                            recipient_id, delay, current_retry + 1);

                        // Update retry schedule
                        sqlx::query(
                            "UPDATE broadcast_deliveries SET retry_count = $2, status = 'pending_retry', updated_at = NOW() WHERE broadcast_id = $1 AND recipient_id = $3"
                        )
                        .bind(broadcast_id)
                        .bind((current_retry + 1) as i32)
                        .bind(recipient_id)
                        .execute(&*state.db.pool())
                        .await?;
                    } else {
                        tracing::error!("Max retries reached for recipient {} via {:?}", recipient_id, channel_kind);
                    }
                }
            }
        }
        Ok(())
    }
}

impl ChannelKind {
    fn as_str(&self) -> &'static str {
        match self {
            ChannelKind::Sms => "sms",
            ChannelKind::WhatsApp => "whatsapp",
            ChannelKind::Email => "email",
            ChannelKind::Telegram => "telegram",
        }
    }
}
