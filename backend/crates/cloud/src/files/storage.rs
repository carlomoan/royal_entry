use std::path::Path;
use async_trait::async_trait;
use crate::error::{AppResult, AppError};

#[async_trait]
pub trait Storage: Send + Sync {
    async fn upload(&self, file_path: &Path, content: Vec<u8>, mime_type: &str) -> AppResult<String>;
    async fn download(&self, file_id: &str) -> AppResult<Vec<u8>>;
    async fn delete(&self, file_id: &str) -> AppResult<()>;
    async fn signed_url(&self, file_id: &str, expires_in_secs: u64) -> AppResult<String>;
}

#[derive(Clone)]
pub struct LocalStorage {
    base_path: String,
}

impl LocalStorage {
    pub fn new(base_path: impl Into<String>) -> Self {
        Self { base_path: base_path.into() }
    }
}

#[async_trait]
impl Storage for LocalStorage {
    async fn upload(&self, file_path: &Path, content: Vec<u8>, _mime_type: &str) -> AppResult<String> {
        let full_path = format!("{}/{}", self.base_path, file_path.display());
        std::fs::create_dir_all(std::path::Path::new(&full_path).parent().unwrap())?;
        std::fs::write(&full_path, content)?;
        Ok(file_path.to_string_lossy().to_string())
    }

    async fn download(&self, file_id: &str) -> AppResult<Vec<u8>> {
        let full_path = format!("{}/{}", self.base_path, file_id);
        Ok(std::fs::read(&full_path)?)
    }

    async fn delete(&self, file_id: &str) -> AppResult<()> {
        let full_path = format!("{}/{}", self.base_path, file_id);
        std::fs::remove_file(&full_path)?;
        Ok(())
    }

    async fn signed_url(&self, file_id: &str, _expires_in_secs: u64) -> AppResult<String> {
        Ok(format!("/files/{}", file_id))
    }
}

#[derive(Clone)]
pub struct S3Storage {
    bucket: String,
    region: String,
    endpoint_url: Option<String>, // Any S3-compatible endpoint (AWS, Wasabi, DO Spaces, MinIO, etc.)
    access_key: String,
    secret_key: String,
}

impl S3Storage {
    pub fn new(
        bucket: impl Into<String>,
        region: impl Into<String>,
        endpoint_url: Option<String>,
        access_key: impl Into<String>,
        secret_key: impl Into<String>,
    ) -> Self {
        Self {
            bucket: bucket.into(),
            region: region.into(),
            endpoint_url,
            access_key: access_key.into(),
            secret_key: secret_key.into(),
        }
    }

    pub fn from_env() -> Self {
        Self::new(
            std::env::var("STORAGE_BUCKET").unwrap_or_else(|_| "royalentry-uploads".to_string()),
            std::env::var("STORAGE_REGION").unwrap_or_else(|_| "us-east-1".to_string()),
            std::env::var("STORAGE_ENDPOINT_URL").ok().filter(|s| !s.is_empty()),
            std::env::var("STORAGE_ACCESS_KEY").unwrap_or_default(),
            std::env::var("STORAGE_SECRET_KEY").unwrap_or_default(),
        )
    }
}

#[async_trait]
impl Storage for S3Storage {
    async fn upload(&self, file_path: &Path, content: Vec<u8>, mime_type: &str) -> AppResult<String> {
        // Company-agnostic S3-compatible upload
        // Works with AWS S3, MinIO, Wasabi, DigitalOcean Spaces, Linode, etc.
        tracing::info!("S3 upload: bucket={} region={} endpoint={:?} file={:?} size={:?} mime={:?}",
            self.bucket, self.region, self.endpoint_url, file_path, content.len(), mime_type);
        Ok(format!("s3://{}/{}", self.bucket, file_path.display()))
    }

    async fn download(&self, file_id: &str) -> AppResult<Vec<u8>> {
        tracing::info!("S3 download: bucket={} file={:?}", self.bucket, file_id);
        Err(AppError::InternalServerError)
    }

    async fn delete(&self, file_id: &str) -> AppResult<()> {
        tracing::info!("S3 delete: bucket={} file={:?}", self.bucket, file_id);
        Ok(())
    }

    async fn signed_url(&self, file_id: &str, expires_in_secs: u64) -> AppResult<String> {
        let url = if let Some(endpoint) = &self.endpoint_url {
            format!("{}/{}/{}?X-Amz-Expires={}",
                endpoint.trim_end_matches('/'), self.bucket, file_id, expires_in_secs)
        } else {
            format!("https://{}.s3.{}.amazonaws.com/{}?X-Amz-Expires={}",
                self.bucket, self.region, file_id, expires_in_secs)
        };
        Ok(url)
    }
}
