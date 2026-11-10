// ==============================================================================
// FILE: crates/cloud/src/middleware/rate_limit.rs
// ==============================================================================
// Simple in-memory sliding-window rate limiter keyed by client IP + route.
// Protects auth and OTP endpoints from brute-force / abuse. Behind Apache the
// real client IP arrives via X-Forwarded-For.
// ==============================================================================
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use crate::AppState;

#[derive(Clone)]
pub struct RateLimiter {
    inner: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
    limit: usize,
    window: Duration,
}

impl RateLimiter {
    pub fn new(limit: usize, window_secs: u64) -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
            limit,
            window: Duration::from_secs(window_secs),
        }
    }

    /// Returns true when the key is within the limit (and records the attempt).
    pub fn check(&self, key: &str) -> bool {
        let mut map = self.inner.lock().unwrap();
        let now = Instant::now();
        let entries = map.entry(key.to_string()).or_default();
        entries.retain(|t| now.duration_since(*t) < self.window);
        if entries.len() >= self.limit {
            return false;
        }
        entries.push(now);
        true
    }
}

pub async fn rate_limit_middleware(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Response {
    let ip = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let key = format!("{}:{}", req.uri().path(), ip);
    if !state.rate_limiter.check(&key) {
        return Response::builder()
            .status(StatusCode::TOO_MANY_REQUESTS)
            .header("Retry-After", "60")
            .body(axum::body::Body::from("Too many requests — try again shortly"))
            .unwrap();
    }
    next.run(req).await
}
