// ==============================================================================
// FILE: src/routes.rs
// ==============================================================================
use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;
use crate::{
    handlers::{
        audit, auth, billing, broadcast, card_templates, event, event_assignment, guest,
        invitations, michango, notifications, payment, platform, public_invitation, rbac,
        reports, scanner, settings, webhooks,
    },
    middleware::{
        auth::auth_middleware,
        rbac::{
            require_account_admin_middleware, require_permission_middleware,
            require_platform_admin_middleware,
        },
    },
    AppState,
};

pub fn create_router(state: Arc<AppState>) -> Router {
    // ── Public routes ─────────────────────────────────────────────────────────
    let public_routes = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/api/v1/auth/register", post(auth::register))
        .route("/api/v1/auth/login", post(auth::login))
        .
