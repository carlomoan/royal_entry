use serde::{Serialize, Deserialize};
use uuid::Uuid;
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use ed25519_dalek::{Signer, SigningKey, VerifyingKey, Verifier};
use ed25519_dalek::Signature;
use rand_core::{RngCore, OsRng};

use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyPayload {
    pub recipient_id: Uuid,
    pub event_id: Uuid,
    pub card_template_id: Option<Uuid>,
    pub issued_at: i64,
    pub nonce: String,
    pub exp: i64,
}

impl VerifyPayload {
    pub fn new(recipient_id: Uuid, event_id: Uuid, card_template_id: Option<Uuid>, ttl_secs: i64) -> Self {
        Self {
            recipient_id,
            event_id,
            card_template_id,
            issued_at: chrono::Utc::now().timestamp(),
            nonce: Uuid::new_v4().to_string(),
            exp: chrono::Utc::now().timestamp() + ttl_secs,
        }
    }

    pub fn is_expired(&self) -> bool {
        chrono::Utc::now().timestamp() > self.exp
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).expect("serialize payload")
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, crate::error::AppError> {
        serde_json::from_slice(bytes).map_err(|_| crate::error::AppError::InternalServerError)
    }
}

pub fn encrypt_and_sign(payload: &VerifyPayload) -> Result<String, crate::error::AppError> {
    // Load AES-256 key from env
    let key_b64 = std::env::var("QR_ENCRYPTION_KEY")
        .map_err(|_| crate::error::AppError::InternalServerError)?;
    let key_bytes = general_purpose::STANDARD.decode(&key_b64)
        .map_err(|_| crate::error::AppError::InternalServerError)?;
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    // Generate random nonce
    let mut nonce_bytes = [0u8; 12];
    rand_core::OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt payload
    let plaintext = payload.to_bytes();
    let ciphertext = cipher.encrypt(nonce, plaintext.as_ref())
        .map_err(|_| crate::error::AppError::InternalServerError)?;

    // Load Ed25519 signing key
    let sign_key_b64 = std::env::var("QR_SIGNING_KEY")
        .map_err(|_| crate::error::AppError::InternalServerError)?;
    let sign_key_bytes = general_purpose::STANDARD.decode(&sign_key_b64)
        .map_err(|_| crate::error::AppError::InternalServerError)?;
    let signing_key_bytes: [u8; 32] = sign_key_bytes.try_into()
        .map_err(|_| crate::error::AppError::InternalServerError)?;
    let signing_key = SigningKey::from_bytes(&signing_key_bytes);

    // Sign ciphertext
    let signature = signing_key.sign(&ciphertext);

    // Combine: nonce || ciphertext || signature
    let mut token_bytes = nonce_bytes.to_vec();
    token_bytes.extend_from_slice(&ciphertext);
    token_bytes.extend_from_slice(&signature.to_bytes());

    Ok(general_purpose::URL_SAFE_NO_PAD.encode(&token_bytes))
}

pub fn verify_and_decrypt(token: &str) -> Result<VerifyPayload, crate::error::AppError> {
    let token_bytes = general_purpose::URL_SAFE_NO_PAD.decode(token)
        .map_err(|_| crate::error::AppError::InternalServerError)?;

    if token_bytes.len() < 12 + 64 {
        return Err(crate::error::AppError::BadRequest("Invalid token length".to_string()));
    }

    // Extract nonce (first 12 bytes)
    let nonce_bytes = &token_bytes[0..12];
    let nonce = Nonce::from_slice(nonce_bytes);

    // Extract signature (last 64 bytes for Ed25519)
    let sig_start = token_bytes.len() - 64;
    let ciphertext = &token_bytes[12..sig_start];
    let signature_bytes = &token_bytes[sig_start..];

    // Load verification key (would derive from signing key or separate env var)
    // For simplicity, we verify using the same key mechanism
    let sign_key_b64 = std::env::var("QR_SIGNING_KEY")
        .map_err(|_| crate::error::AppError::InternalServerError)?;
    let sign_key_bytes = general_purpose::STANDARD.decode(&sign_key_b64)
        .map_err(|_| crate::error::AppError::InternalServerError)?;
    let verify_key_bytes: [u8; 32] = sign_key_bytes.try_into()
        .map_err(|_| crate::error::AppError::InternalServerError)?;
    let signing_key = SigningKey::from_bytes(&verify_key_bytes);
    let verifying_key: VerifyingKey = (&signing_key).into();

    // Verify signature
    verifying_key.verify(ciphertext, &Signature::from_slice(signature_bytes)?)
        .map_err(|_| crate::error::AppError::Forbidden)?;

    // Decrypt
    let key_b64 = std::env::var("QR_ENCRYPTION_KEY")
        .map_err(|_| crate::error::AppError::InternalServerError)?;
    let key_bytes = general_purpose::STANDARD.decode(&key_b64)
        .map_err(|_| crate::error::AppError::InternalServerError)?;
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| crate::error::AppError::Forbidden)?;

    let payload = VerifyPayload::from_bytes(&plaintext)?;
    if payload.is_expired() {
        return Err(crate::error::AppError::Forbidden);
    }

    Ok(payload)
}
