use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;
use crate::{
    handlers::{auth, broadcast, event, guest, invitations, michango, payment, scanner},
    middleware::auth::auth_middleware,
    AppState,
};

pub fn create_router(state: Arc<AppState>) -> Router {
    // Public routes
    let public_routes = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/api/v1/auth/register", post(auth::register))
        .route("/api/v1/auth/login", post(auth::login))
        .route("/api/v1/auth/refresh", post(auth::refresh_token))
        // M-Pesa callback — public, called by Safaricom (no JWT)
        .route("/api/v1/payments/mpesa/callback", post(payment::mpesa_callback));

    // Protected routes
    let auth_routes = Router::new()
        .route("/api/v1/auth/me", get(auth::get_current_user))
        .route("/api/v1/auth/change-password", post(auth::change_password));

    let event_routes = Router::new()
        .route("/api/v1/events", post(event::create_event))
        .route("/api/v1/events", get(event::list_events))
        .route("/api/v1/events/{id}", get(event::get_event))
        .route("/api/v1/events/{id}", put(event::update_event))
        .route("/api/v1/events/{id}", delete(event::delete_event))
        .route("/api/v1/events/{id}/activate", post(event::activate_event))
        .route("/api/v1/events/{id}/summary", get(event::get_event_summary));

    let guest_routes = Router::new()
        .route("/api/v1/events/{eid}/guests", post(guest::create_guest))
        .route("/api/v1/events/{eid}/guests", get(guest::list_guests))
        .route("/api/v1/events/{eid}/guests/bulk", post(guest::bulk_create_guests))
        .route("/api/v1/events/{eid}/guests/count", get(guest::guest_count))
        .route("/api/v1/events/{eid}/guests/{id}", get(guest::get_guest))
        .route("/api/v1/events/{eid}/guests/{id}", put(guest::update_guest))
        .route("/api/v1/events/{eid}/guests/{id}", delete(guest::delete_guest));

    let invitation_routes = Router::new()
        .route("/api/v1/events/{eid}/invitations", get(invitations::list_invitations))
        .route("/api/v1/events/{eid}/invitations/generate", post(invitations::generate_invitations));

    let scanner_routes = Router::new()
        .route("/api/v1/events/{eid}/scan", post(scanner::check_in_guest))
        .route("/api/v1/events/{eid}/scan-stats", get(scanner::scan_stats));

    let michango_routes = Router::new()
        .route("/api/v1/events/{eid}/michango", get(michango::list_pledges))
        .route("/api/v1/events/{eid}/michango", post(michango::create_pledge))
        .route("/api/v1/events/{eid}/michango/summary", get(michango::get_summary))
        .route("/api/v1/events/{eid}/michango/{id}/payment", post(michango::record_payment))
        .route(
            "/api/v1/events/{eid}/michango/reminders",
            get(michango::list_reminder_deliveries).post(michango::send_reminders),
        );

    let broadcast_routes = Router::new()
        .route("/api/v1/events/{eid}/broadcast", post(broadcast::send_broadcast))
        .route("/api/v1/events/{eid}/broadcasts", get(broadcast::list_broadcasts))
        .route(
            "/api/v1/events/{eid}/broadcasts/{id}/deliveries",
            get(broadcast::list_broadcast_deliveries),
        );

    let payment_routes = Router::new()
        .route("/api/v1/payments/mpesa/initiate", post(payment::initiate_mpesa_payment))
        .route("/api/v1/payments/{id}/status", get(payment::get_payment_status))
        .route("/api/v1/payments", get(payment::list_payments));

    // Merge all protected routes and apply the JWT middleware
    let protected = auth_routes
        .merge(event_routes)
        .merge(guest_routes)
        .merge(invitation_routes)
        .merge(scanner_routes)
        .merge(michango_routes)
        .merge(broadcast_routes)
        .merge(payment_routes)
        .layer(middleware::from_fn(auth_middleware));

    public_routes
        .merge(protected)
        .with_state(state)
}
