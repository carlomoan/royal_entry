use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;
use crate::{
    handlers::{
        audit, auth, broadcast, event, guest, invitations, michango, payment, platform,
        public_invitation, reports, scanner, settings,
    },
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
        .route(
            "/api/v1/public/invitations/{code}",
            get(public_invitation::get_public_invitation),
        )
        .route(
            "/api/v1/public/invitations/{code}/rsvp",
            post(public_invitation::submit_public_rsvp),
        )
        .route(
            "/api/v1/public/g/{code}",
            get(public_invitation::get_public_invitation),
        )
        .route(
            "/api/v1/public/g/{code}/rsvp",
            post(public_invitation::submit_public_rsvp),
        )
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

    let platform_routes = Router::new()
        .route("/api/v1/platform/summary", get(platform::get_platform_summary))
        .route("/api/v1/platform/plans", get(platform::list_plans))
        .route("/api/v1/platform/customers", get(platform::list_customers))
        .route(
            "/api/v1/platform/customers/{id}",
            get(platform::get_customer_detail).put(platform::update_customer_status),
        )
        .route(
            "/api/v1/platform/customers/{id}/subscription",
            put(platform::update_customer_subscription),
        )
        .route(
            "/api/v1/platform/customers/{id}/invoices",
            post(platform::create_customer_invoice),
        )
        .route(
            "/api/v1/platform/invoices/{id}/mark-paid",
            post(platform::mark_invoice_paid),
        );

    let settings_routes = Router::new()
        .route("/api/v1/settings/system", get(settings::get_system_settings).put(settings::update_system_settings))
        .route("/api/v1/settings/account", get(settings::get_account_settings).put(settings::update_account_settings))
        .route("/api/v1/settings/roles", get(settings::get_role_catalog))
        .route("/api/v1/settings/users", post(settings::create_account_user))
        .route("/api/v1/settings/users/{id}", put(settings::update_account_user));

    let audit_routes = Router::new()
        .route("/api/v1/audit/logs", get(audit::list_audit_logs))
        .route("/api/v1/audit/export", get(audit::export_audit_logs));

    let report_routes = Router::new()
        .route("/api/v1/reports/summary", get(reports::report_summary))
        .route("/api/v1/reports/export", get(reports::export_report));

    // Merge all protected routes and apply the JWT middleware
    let protected = auth_routes
        .merge(event_routes)
        .merge(guest_routes)
        .merge(invitation_routes)
        .merge(scanner_routes)
        .merge(michango_routes)
        .merge(broadcast_routes)
        .merge(payment_routes)
        .merge(platform_routes)
        .merge(settings_routes)
        .merge(audit_routes)
        .merge(report_routes)
        .layer(middleware::from_fn(auth_middleware));

    public_routes
        .merge(protected)
        .with_state(state)
}
