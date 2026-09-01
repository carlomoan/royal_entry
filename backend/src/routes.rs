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
        audit, auth, broadcast, card_templates, event, event_assignment, guest, invitations,
        michango, payment, platform, public_invitation, rbac, reports, scanner, settings,
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
    // ── Public routes (no auth required) ──────────────────────────────────────
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
        .route(
            "/api/v1/payments/mpesa/callback",
            post(payment::mpesa_callback),
        );

    // ── Auth routes (any authenticated user) ──────────────────────────────────
    let auth_routes = Router::new()
        .route("/api/v1/auth/me", get(auth::get_current_user))
        .route("/api/v1/auth/change-password", post(auth::change_password));

    // ── Event routes (requires events:read permission) ────────────────────────
    let event_routes = Router::new()
        .route("/api/v1/events", post(event::create_event))
        .route("/api/v1/events", get(event::list_events))
        .route("/api/v1/events/{id}", get(event::get_event))
        .route("/api/v1/events/{id}", put(event::update_event))
        .route("/api/v1/events/{id}", delete(event::delete_event))
        .route("/api/v1/events/{id}/activate", post(event::activate_event))
        .route("/api/v1/events/{id}/summary", get(event::get_event_summary))
        .route("/api/v1/events/{id}/approve", post(event::approve_event))
        .route("/api/v1/events/{id}/reject", post(event::reject_event))
        .route("/api/v1/events/{id}/complete", post(event::complete_event))
        .route("/api/v1/events/{id}/report/pdf", get(event::download_event_report))
        .route("/api/v1/events/{id}/send-save-the-date", post(event::send_save_the_date))
        .layer(middleware::from_fn(require_permission_middleware("events:read")));

    // ── Guest routes (requires guests:read) ───────────────────────────────────
    let guest_routes = Router::new()
        .route("/api/v1/events/{eid}/guests", post(guest::create_guest))
        .route("/api/v1/events/{eid}/guests", get(guest::list_guests))
        .route("/api/v1/events/{eid}/guests/bulk", post(guest::bulk_create_guests))
        .route("/api/v1/events/{eid}/guests/import", post(guest::import_guests_csv)) // NEW
        .route("/api/v1/events/{eid}/guests/template", get(guest::download_guest_template)) // NEW
        .route("/api/v1/events/{eid}/guests/count", get(guest::guest_count))
        .route("/api/v1/events/{eid}/guests/{id}", get(guest::get_guest))
        .route("/api/v1/events/{eid}/guests/{id}", put(guest::update_guest))
        .route("/api/v1/events/{eid}/guests/{id}", delete(guest::delete_guest))
        .layer(middleware::from_fn(require_permission_middleware("guests:read")));

    // ── Invitation routes (requires invitations:read) ─────────────────────────
    let invitation_routes = Router::new()
        .route("/api/v1/events/{eid}/invitations", get(invitations::list_invitations))
        .route("/api/v1/events/{eid}/invitations/generate", post(invitations::generate_invitations))
        .route("/api/v1/events/{eid}/invitations/send", post(invitations::send_invitations))
        .layer(middleware::from_fn(require_permission_middleware("invitations:read")));

    // ── Scanner routes (requires scanner:*) ───────────────────────────────────
    let scanner_routes = Router::new()
        .route("/api/v1/events/{eid}/scan", post(scanner::check_in_guest))
        .route("/api/v1/events/{eid}/scan-stats", get(scanner::scan_stats))
        .route("/api/v1/events/{eid}/scan/otp/send", post(scanner::send_otp))
        .route("/api/v1/events/{eid}/scan/otp/verify", post(scanner::verify_otp))
        .layer(middleware::from_fn(require_permission_middleware("scanner:read")));

    // ── Michango routes (requires michango:read) ──────────────────────────────
    let michango_routes = Router::new()
        .route("/api/v1/events/{eid}/michango", get(michango::list_pledges))
        .route("/api/v1/events/{eid}/michango", post(michango::create_pledge))
        .route("/api/v1/events/{eid}/michango/summary", get(michango::get_summary))
        .route("/api/v1/events/{eid}/michango/{id}/payment", post(michango::record_payment))
        .route(
            "/api/v1/events/{eid}/michango/reminders",
            get(michango::list_reminder_deliveries).post(michango::send_reminders),
        )
        .layer(middleware::from_fn(require_permission_middleware("michango:read")));

    // ── Broadcast routes (requires broadcast:read) ────────────────────────────
    let broadcast_routes = Router::new()
        .route("/api/v1/events/{eid}/broadcast", post(broadcast::send_broadcast))
        .route("/api/v1/events/{eid}/broadcasts", get(broadcast::list_broadcasts))
        .route(
            "/api/v1/events/{eid}/broadcasts/{id}/deliveries",
            get(broadcast::list_broadcast_deliveries),
        )
        .layer(middleware::from_fn(require_permission_middleware("broadcast:read")));

    // ── Payment routes (requires payments:read) ───────────────────────────────
    let payment_routes = Router::new()
        .route("/api/v1/payments/mpesa/initiate", post(payment::initiate_mpesa_payment))
        .route("/api/v1/payments/{id}/status", get(payment::get_payment_status))
        .route("/api/v1/payments/{id}/receipt", get(payment::download_payment_receipt))
        .route("/api/v1/payments", get(payment::list_payments))
        .layer(middleware::from_fn(require_permission_middleware("payments:read")));

    // ── Platform routes (requires platform admin) ─────────────────────────────
    let platform_routes = Router::new()
        .route("/api/v1/platform/summary", get(platform::get_platform_summary))
        .route("/api/v1/platform/plans", get(platform::list_plans))
        .route("/api/v1/platform/plans", post(platform::create_plan))
        .route(
            "/api/v1/platform/plans/{id}",
            put(platform::update_plan).delete(platform::delete_plan),
        )
        .route("/api/v1/platform/customers", get(platform::list_customers))
        .route("/api/v1/platform/organizations", post(platform::create_organization))
        .route(
            "/api/v1/platform/customers/{id}",
            get(platform::get_customer_detail).put(platform::update_customer_status).delete(platform::delete_customer_organization),
        )
        .route(
            "/api/v1/platform/customers/{id}/approve",
            post(platform::approve_organization),
        )
        .route(
            "/api/v1/platform/customers/{id}/reject",
            post(platform::reject_organization),
        )
        .route(
            "/api/v1/platform/customers/{id}/suspend",
            post(platform::suspend_organization),
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
        )
        .route(
            "/api/v1/platform/users",
            get(platform::list_platform_users).post(platform::create_platform_user),
        )
        .route(
            "/api/v1/platform/users/{id}",
            put(platform::update_platform_user).delete(platform::delete_platform_user),
        )
        .route(
            "/api/v1/platform/organizations/{id}/impersonate",
            post(platform::impersonate_organization),
        )
        .route(
            "/api/v1/platform/organizations/{id}/impersonate-role",
            post(platform::impersonate_role_in_organization),
        )
        .route(
            "/api/v1/platform/organizations/{id}/usage",
            get(platform::get_organization_usage),
        )
        .route(
            "/api/v1/platform/organizations/{id}/usage/limits",
            get(platform::get_organization_usage_limits),
        )
        .route(
            "/api/v1/platform/organizations/{id}/usage/track",
            post(platform::track_organization_usage),
        )
        .route(
            "/api/v1/platform/card-templates",
            get(card_templates::list_card_templates).post(card_templates::create_card_template),
        )
        .route(
            "/api/v1/platform/card-templates/{id}",
            put(card_templates::update_card_template).delete(card_templates::delete_card_template),
        )
        .layer(middleware::from_fn(require_platform_admin_middleware));

    // ── Settings routes ───────────────────────────────────────────────────────
    let settings_routes = Router::new()
        .route(
            "/api/v1/settings/system",
            get(settings::get_system_settings).put(settings::update_system_settings),
        )
        .layer(middleware::from_fn(require_platform_admin_middleware))
        .merge(
            Router::new()
                .route(
                    "/api/v1/settings/account",
                    get(settings::get_account_settings).put(settings::update_account_settings),
                )
                .route("/api/v1/settings/roles", get(settings::get_role_catalog))
                .route("/api/v1/settings/users", post(settings::create_account_user))
                .route("/api/v1/settings/users/{id}", put(settings::update_account_user))
                .layer(middleware::from_fn(require_account_admin_middleware)),
        );

    // ── RBAC routes (requires platform admin) ────────────────────────────────
    let rbac_routes = Router::new()
        .route("/api/v1/platform/roles", get(rbac::list_roles).post(rbac::create_role))
        .route("/api/v1/platform/roles/{id}", put(rbac::update_role).delete(rbac::delete_role))
        .route("/api/v1/platform/permissions", get(rbac::list_permissions))
        .route(
            "/api/v1/platform/users/{user_id}/roles",
            post(rbac::assign_role_to_user),
        )
        .route(
            "/api/v1/platform/users/{user_id}/permissions",
            post(rbac::grant_permission_to_user).put(rbac::revoke_permission_from_user),
        )
        .layer(middleware::from_fn(require_platform_admin_middleware));

    // ── Audit routes (requires audit:read) ────────────────────────────────────
    let audit_routes = Router::new()
        .route("/api/v1/audit/logs", get(audit::list_audit_logs))
        .route("/api/v1/audit/export", get(audit::export_audit_logs))
        .layer(middleware::from_fn(require_permission_middleware("audit:read")));

    // ── Report routes (requires reports:read) ─────────────────────────────────
    let report_routes = Router::new()
        .route("/api/v1/reports/summary", get(reports::report_summary))
        .route("/api/v1/reports/export", get(reports::export_report))
        .layer(middleware::from_fn(require_permission_middleware("reports:read")));

    // ── Merge all protected routes ────────────────────────────────────────────
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
        .merge(rbac_routes)
        .merge(audit_routes)
        .merge(report_routes)
        .layer(middleware::from_fn(auth_middleware));

    public_routes.merge(protected).with_state(state)
}
