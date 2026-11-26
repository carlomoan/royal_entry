// ==============================================================================
// FILE: crates/cloud/src/routes.rs
// ==============================================================================
use crate::{
    files,
    handlers::{
        audit, auth, billing, booking_registration, broadcast, corporate, document_templates, event,
        event_assignment, guest, invitations, messages, michango, notifications, payment, platform,
        public_invitation, qr_code, rbac, reports, scanner, settings, templates, verify_token, webhooks,
    },
    logs,
    middleware::{
        auth::auth_middleware,
        rbac::{
            require_account_admin_middleware, require_permission_middleware,
            require_platform_admin_middleware,
        },
    },
    templates as msg_templates, AppState,
};
use axum::{
    extract::State,
    http::StatusCode,
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;

/// Liveness + DB readiness probe.
async fn health(State(state): State<Arc<AppState>>) -> (StatusCode, &'static str) {
    match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&*state.db.pool())
        .await
    {
        Ok(_) => (StatusCode::OK, "OK"),
        Err(_) => (StatusCode::SERVICE_UNAVAILABLE, "DB unavailable"),
    }
}

pub fn create_router(state: Arc<AppState>) -> Router {
    // ── Public routes (no auth required) ──────────────────────────────────────
    // Auth endpoints are rate-limited to slow brute-force attempts.
    let auth_public_routes = Router::new()
        .route("/api/v1/auth/register", post(auth::register))
        .route("/api/v1/auth/login", post(auth::login))
        .route("/api/v1/auth/refresh", post(auth::refresh_token))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            crate::middleware::rate_limit_middleware,
        ));

    let public_routes = Router::new()
        .route("/health", get(health))
        .merge(auth_public_routes)
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
            "/api/v1/telegram/webhook",
            post(crate::handlers::telegram::telegram_webhook),
        )
        .route(
            "/api/v1/payments/mpesa/callback",
            post(payment::mpesa_callback),
        )
        .route("/api/v1/public/verify", get(verify_token::verify_token))
        .route(
            "/api/v1/public/verify-email",
            get(guest::verify_guest_email),
        )
        .route(
            "/api/v1/public/invitations/{token}/card",
            get(crate::handlers::card_issuing::public_invitation_card),
        )
        .route(
            "/api/v1/public/invitations/{code}/pledge",
            post(public_invitation::submit_public_pledge),
        )
        .route(
            "/api/v1/public/invitations/{code}/qr",
            get(public_invitation::public_invitation_qr),
        )
        .route(
            "/api/v1/public/invitations/{code}/card/pdf",
            get(crate::handlers::card_issuing::public_card_pdf),
        )
        .route(
            "/api/v1/public/invoices/{token}",
            get(document_templates::public_invoice),
        )
        .route(
            "/api/v1/public/bookings/{token}",
            get(booking_registration::booking_info),
        )
        .route(
            "/api/v1/public/bookings/{token}/verify",
            get(booking_registration::verify_contact_email),
        )
        .route(
            "/api/v1/public/bookings/{token}/names",
            post(booking_registration::register_names),
        )
        .route(
            "/api/v1/public/w/{event_id}",
            get(crate::handlers::arrival::venue_info),
        )
        .route(
            "/api/v1/public/w/{event_id}/view",
            post(crate::handlers::arrival::venue_message),
        );

    // ── Auth routes (any authenticated user) ──────────────────────────────────
    let auth_routes = Router::new()
        .route("/api/v1/auth/me", get(auth::get_current_user))
        .route("/api/v1/auth/change-password", post(auth::change_password));

    // ── Event routes ──────────────────────────────────────────────────────────
    let event_routes = Router::new()
        .route("/api/v1/events", post(event::create_event))
        .route("/api/v1/events", get(event::list_events))
        .route("/api/v1/events/{id}", get(event::get_event))
        .route("/api/v1/events/{id}", put(event::update_event))
        .route("/api/v1/events/{id}", delete(event::delete_event))
        .route("/api/v1/events/{id}/activate", post(event::activate_event))
        .route("/api/v1/events/{id}/deactivate", post(event::deactivate_event))
        .route(
            "/api/v1/events/{id}/submit",
            post(event::submit_event_for_approval),
        )
        .route("/api/v1/events/{id}/summary", get(event::get_event_summary))
        .route("/api/v1/events/{id}/approve", post(event::approve_event))
        .route("/api/v1/events/{id}/reject", post(event::reject_event))
        .route("/api/v1/events/{id}/complete", post(event::complete_event))
        .route(
            "/api/v1/events/{id}/report/pdf",
            get(event::download_event_report),
        )
        .route(
            "/api/v1/events/{id}/send-save-the-date",
            post(event::send_save_the_date),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "events:read",
        )));

    // ── Event staff routes ────────────────────────────────────────────────────
    let staff_read_routes = Router::new()
        .route(
            "/api/v1/events/{eid}/staff",
            get(event_assignment::list_event_staff),
        )
        .route(
            "/api/v1/events/{eid}/staff/available",
            get(event_assignment::list_assignable_users),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "events:read",
        )));

    let staff_write_routes = Router::new()
        .route(
            "/api/v1/events/{eid}/staff",
            post(event_assignment::assign_staff_to_event),
        )
        .route(
            "/api/v1/events/{eid}/staff/{user_id}",
            delete(event_assignment::remove_staff_from_event),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "events:write",
        )));

    // ── Corporate packages / bookings / gate routes ─────────────────────────────
    let corporate_read_routes = Router::new()
        .route(
            "/api/v1/events/{eid}/packages",
            get(corporate::list_packages),
        )
        .route(
            "/api/v1/events/{eid}/bookings",
            get(corporate::list_bookings),
        )
        .route(
            "/api/v1/events/{eid}/bookings/{id}",
            get(corporate::get_booking),
        )
        .route(
            "/api/v1/events/{eid}/tables/open",
            get(corporate::list_open_tables),
        )
        .route(
            "/api/v1/events/{eid}/seating/suggest",
            get(corporate::suggest_seating),
        )
        .route(
            "/api/v1/events/{eid}/gate-dashboard",
            get(corporate::gate_dashboard),
        )
        .route(
            "/api/v1/events/{eid}/corporate-report",
            get(corporate::corporate_report),
        )
        .route(
            "/api/v1/events/{eid}/parking-variants",
            get(corporate::list_parking_variants),
        )
        .route(
            "/api/v1/events/{eid}/bookings/{id}/invoice",
            get(corporate::get_booking_invoice),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "events:read",
        )));

    // Credential previews are platform-admin only, never account-scoped.
    let message_inspection_routes = Router::new()
        .route(
            "/api/v1/events/{eid}/messages",
            get(messages::list_event_messages),
        )
        .layer(middleware::from_fn(require_platform_admin_middleware));

    let corporate_write_routes = Router::new()
        .route(
            "/api/v1/events/{eid}/packages",
            post(corporate::create_package),
        )
        .route(
            "/api/v1/events/{eid}/packages/{id}",
            put(corporate::update_package).delete(corporate::delete_package),
        )
        .route(
            "/api/v1/events/{eid}/bookings",
            post(corporate::create_booking),
        )
        .route(
            "/api/v1/events/{eid}/bookings/{id}",
            put(corporate::update_booking),
        )
        .route(
            "/api/v1/events/{eid}/bookings/{id}/tables",
            post(corporate::add_table),
        )
        .route(
            "/api/v1/events/{eid}/bookings/{id}/issue-passes",
            post(corporate::issue_passes),
        )
        .route(
            "/api/v1/events/{eid}/bookings/{id}/passes/{gid}/revoke",
            post(corporate::revoke_pass),
        )
        .route(
            "/api/v1/events/{eid}/bookings/{id}/passes/{gid}/reassign",
            post(corporate::reassign_pass),
        )
        .route(
            "/api/v1/events/{eid}/bookings/{id}/tables/{tid}",
            delete(corporate::remove_table),
        )
        .route(
            "/api/v1/events/{eid}/tables/open",
            post(corporate::create_open_table),
        )
        .route(
            "/api/v1/events/{eid}/parking-variants",
            post(corporate::create_parking_variant),
        )
        .route(
            "/api/v1/events/{eid}/parking-variants/{id}",
            delete(corporate::delete_parking_variant),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "events:write",
        )));

    let corporate_payment_routes = Router::new()
        .route(
            "/api/v1/events/{eid}/bookings/{id}/confirm",
            post(corporate::confirm_booking),
        )
        .route(
            "/api/v1/events/{eid}/bookings/{id}/invoice",
            post(corporate::generate_booking_invoice),
        )
        .route(
            "/api/v1/events/{eid}/bookings/{id}/send-verification",
            post(booking_registration::send_verification),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "payments:write",
        )));

    // ── File upload routes ──────────────────────────────────────────────────────
    let file_routes = Router::new()
        .route("/api/v1/files/upload", post(files::upload_file))
        .layer(middleware::from_fn(require_permission_middleware(
            "cards:write",
        )));

    let file_read_routes = Router::new()
        .route("/api/v1/files/{file_id}", get(files::download_file))
        .layer(middleware::from_fn(require_permission_middleware(
            "cards:read",
        )));

    // ── Card template routes ────────────────────────────────────────────────────
    let card_routes = Router::new()
        .route("/api/v1/cards/templates", get(crate::cards::handlers::list_card_templates))
        .route("/api/v1/cards/templates/{id}", get(crate::cards::handlers::get_card_template))
        .route(
            "/api/v1/cards/render",
            post(crate::cards::handlers::render_card_template),
        )
        .route(
            "/api/v1/cards/render/bulk",
            post(crate::cards::handlers::render_cards_bulk),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "cards:read",
        )));

    let card_write_routes = Router::new()
        .route("/api/v1/cards/templates", post(crate::cards::handlers::create_card_template))
        .route(
            "/api/v1/cards/templates/{id}",
            put(crate::cards::handlers::update_card_template)
                .delete(crate::cards::handlers::delete_card_template),
        )
        .route(
            "/api/v1/cards/templates/{id}/upload",
            post(crate::cards::handlers::upload_template_image),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "cards:write",
        )));

    // ── Message template routes ────────────────────────────────────────────────
    // Templates are used by broadcasts, so broadcast permissions gate them.
    let message_template_read_routes = Router::new()
        .route(
            "/api/v1/message-templates",
            get(msg_templates::list_message_templates),
        )
        .route(
            "/api/v1/message-templates/{id}/preview",
            post(msg_templates::preview_message_template),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "broadcast:read",
        )));

    let message_template_write_routes = Router::new()
        .route(
            "/api/v1/message-templates",
            post(msg_templates::create_message_template),
        )
        .route(
            "/api/v1/message-templates/{id}",
            put(msg_templates::update_message_template).delete(msg_templates::delete_message_template),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "broadcast:write",
        )));

    // ── Message log routes ─────────────────────────────────────────────────────
    let log_routes = Router::new()
        .route("/api/v1/message-logs", get(logs::list_message_logs))
        .route(
            "/api/v1/broadcasts/{id}/deliveries",
            get(logs::list_broadcast_deliveries),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "audit:read",
        )));

    // ── Guest routes ──────────────────────────────────────────────────────────
    let guest_routes = Router::new()
        .route("/api/v1/events/{eid}/guests", post(guest::create_guest))
        .route("/api/v1/events/{eid}/guests", get(guest::list_guests))
        .route(
            "/api/v1/events/{eid}/guests/bulk",
            post(guest::bulk_create_guests),
        )
        .route(
            "/api/v1/events/{eid}/guests/import",
            post(guest::import_guests_csv),
        )
        .route(
            "/api/v1/events/{eid}/guests/template",
            get(guest::download_guest_template),
        )
        .route("/api/v1/events/{eid}/guests/count", get(guest::guest_count))
        .route("/api/v1/events/{eid}/guests/{id}", get(guest::get_guest))
        .route("/api/v1/events/{eid}/guests/{id}", put(guest::update_guest))
        .route(
            "/api/v1/events/{eid}/guests/{id}",
            delete(guest::delete_guest),
        )
        .route(
            "/api/v1/events/{eid}/guests/{id}/verify-email",
            post(guest::send_email_verification),
        )
        .route(
            "/api/v1/events/{eid}/guests/{id}/issue-card",
            post(crate::handlers::card_issuing::issue_card),
        )
        .route(
            "/api/v1/events/{eid}/guests/{id}/approve-card",
            post(crate::handlers::card_issuing::approve_card),
        )
        .route(
            "/api/v1/events/{eid}/guests/{id}/withdraw-approval",
            post(crate::handlers::card_issuing::withdraw_approval),
        )
        .route(
            "/api/v1/events/{eid}/guests/{id}/send-checkin",
            post(crate::handlers::card_issuing::send_checkin_to_guest),
        )
        .route(
            "/api/v1/events/{eid}/guests/send-checkin",
            post(crate::handlers::card_issuing::send_checkin_bulk),
        )
        .route(
            "/api/v1/events/{eid}/guests/{id}/card/pdf",
            get(crate::handlers::card_issuing::guest_card_pdf),
        )
        .route(
            "/api/v1/events/{eid}/arrival-messages",
            get(crate::handlers::arrival::list_messages)
                .post(crate::handlers::arrival::create_message),
        )
        .route(
            "/api/v1/events/{eid}/arrival-messages/{id}",
            delete(crate::handlers::arrival::delete_message),
        )
        .route("/api/v1/events/{eid}/guest/{id}", get(guest::get_guest))
        .layer(middleware::from_fn(require_permission_middleware(
            "guests:read",
        )));

    // ── Invitation routes ─────────────────────────────────────────────────────
    let invitation_routes = Router::new()
        .route(
            "/api/v1/events/{eid}/invitations",
            get(invitations::list_invitations),
        )
        .route(
            "/api/v1/events/{eid}/invitations/generate",
            post(invitations::generate_invitations),
        )
        .route(
            "/api/v1/events/{eid}/invitations/send",
            post(invitations::send_invitations),
        )
        .route(
            "/api/v1/events/{eid}/invitations/{inv_id}/qr",
            get(qr_code::generate_qr_code),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "invitations:read",
        )));

    // ── Scanner routes ────────────────────────────────────────────────────────
    let scanner_routes = Router::new()
        .route("/api/v1/events/{eid}/scan", post(scanner::check_in_guest))
        .route("/api/v1/events/{eid}/scan-stats", get(scanner::scan_stats))
        .route(
            "/api/v1/events/{eid}/scan/otp/send",
            post(scanner::send_otp),
        )
        .route(
            "/api/v1/events/{eid}/scan/otp/verify",
            post(scanner::verify_otp),
        )
        .layer(middleware::from_fn_with_state(
            state.clone(),
            crate::middleware::rate_limit_middleware,
        ))
        .layer(middleware::from_fn(require_permission_middleware(
            "scanner:read",
        )));

    let scanner_write_routes = Router::new()
        .route(
            "/api/v1/events/{eid}/scan/override",
            post(scanner::override_check_in),
        )
        .route(
            "/api/v1/events/{eid}/scan/capture-name",
            post(scanner::capture_name),
        )
        .route(
            "/api/v1/events/{eid}/gate/otp-mode",
            post(scanner::set_gate_otp_mode),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "scanner:write",
        )));

    // ── Michango routes ───────────────────────────────────────────────────────
    let michango_routes = Router::new()
        .route("/api/v1/events/{eid}/michango", get(michango::list_pledges))
        .route(
            "/api/v1/events/{eid}/michango",
            post(michango::create_pledge),
        )
        .route(
            "/api/v1/events/{eid}/michango/summary",
            get(michango::get_summary),
        )
        .route(
            "/api/v1/events/{eid}/michango/bulk",
            post(michango::create_pledges_bulk),
        )
        .route(
            "/api/v1/events/{eid}/michango/{id}/payment",
            post(michango::record_payment),
        )
        .route(
            "/api/v1/events/{eid}/michango/reminders",
            get(michango::list_reminder_deliveries).post(michango::send_reminders),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "michango:read",
        )));

    // ── Broadcast routes ──────────────────────────────────────────────────────
    let broadcast_routes = Router::new()
        .route(
            "/api/v1/events/{eid}/broadcast",
            post(broadcast::send_broadcast),
        )
        .route(
            "/api/v1/events/{eid}/broadcasts",
            get(broadcast::list_broadcasts),
        )
        .route(
            "/api/v1/events/{eid}/broadcasts/{id}/deliveries",
            get(broadcast::list_broadcast_deliveries),
        )
        .route(
            "/api/v1/events/{eid}/message-history",
            get(broadcast::list_message_history),
        )
        .layer(middleware::from_fn(require_permission_middleware(
            "broadcast:read",
        )));

    // ── ✅ BILLING routes (FIXED: No stray semicolon) ─────────────────────────
    let billing_routes = Router::new()
        .route(
            "/api/v1/billing/subscription",
            get(billing::get_my_subscription),
        )
        .route("/api/v1/billing/invoices", get(billing::list_my_invoices))
        .route(
            "/api/v1/billing/invoices/{id}/pdf",
            get(billing::download_invoice_pdf),
        )
        .route("/api/v1/billing/usage", get(billing::get_my_usage));

    // ── Payment routes ────────────────────────────────────────────────────────
    let payment_routes = Router::new()
        .route(
            "/api/v1/payments/mpesa/initiate",
            post(payment::initiate_mpesa_payment),
        )
        .route(
            "/api/v1/payments/{id}/status",
            get(payment::get_payment_status),
        )
        .route(
            "/api/v1/payments/{id}/receipt",
            get(payment::download_payment_receipt),
        )
        .route("/api/v1/payments", get(payment::list_payments))
        .layer(middleware::from_fn(require_permission_middleware(
            "payments:read",
        )));

    // ── Notification routes ───────────────────────────────────────────────────
    let notification_routes = Router::new()
        .route(
            "/api/v1/notifications",
            get(notifications::list_notifications),
        )
        .route(
            "/api/v1/notifications/unread-count",
            get(notifications::unread_count),
        )
        .route(
            "/api/v1/notifications/read-all",
            post(notifications::mark_all_read),
        )
        .route(
            "/api/v1/notifications/{id}/read",
            post(notifications::mark_read),
        );

    // ── Webhook routes ────────────────────────────────────────────────────────
    let webhook_routes = Router::new()
        .route(
            "/api/v1/platform/webhooks",
            get(webhooks::list_webhooks).post(webhooks::create_webhook),
        )
        .route(
            "/api/v1/platform/webhooks/{id}",
            put(webhooks::update_webhook).delete(webhooks::delete_webhook),
        )
        .route(
            "/api/v1/platform/webhooks/{id}/deliveries",
            get(webhooks::list_webhook_deliveries),
        )
        .route(
            "/api/v1/platform/webhooks/{id}/test",
            post(webhooks::test_webhook),
        )
        .layer(middleware::from_fn(require_platform_admin_middleware));

    // ── Platform routes ───────────────────────────────────────────────────────
    let platform_routes = Router::new()
        .route(
            "/api/v1/platform/summary",
            get(platform::get_platform_summary),
        )
        .route("/api/v1/platform/plans", get(platform::list_plans))
        .route("/api/v1/platform/plans", post(platform::create_plan))
        .route(
            "/api/v1/platform/plans/{id}",
            put(platform::update_plan).delete(platform::delete_plan),
        )
        .route("/api/v1/platform/customers", get(platform::list_customers))
        .route(
            "/api/v1/platform/organizations",
            post(platform::create_organization),
        )
        .route(
            "/api/v1/platform/customers/{id}",
            get(platform::get_customer_detail)
                .put(platform::update_customer_status)
                .delete(platform::delete_customer_organization),
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
            "/api/v1/platform/templates",
            get(templates::list_templates).post(templates::create_template),
        )
        .route(
            "/api/v1/platform/templates/preview",
            post(templates::preview_template),
        )
        .route(
            "/api/v1/platform/templates/{id}",
            get(templates::get_template)
                .put(templates::update_template)
                .delete(templates::delete_template),
        )
        .route(
            "/api/v1/platform/templates/{id}/duplicate",
            post(templates::duplicate_template),
        )
        .layer(middleware::from_fn(require_platform_admin_middleware));

    // ── Settings routes ───────────────────────────────────────────────────────
    let settings_routes = Router::new()
        .route(
            "/api/v1/settings/system",
            get(settings::get_system_settings).put(settings::update_system_settings),
        )
        .route(
            "/api/v1/settings/document-templates",
            get(document_templates::list_document_templates)
                .post(document_templates::create_document_template),
        )
        .route(
            "/api/v1/settings/document-templates/{id}",
            put(document_templates::update_document_template)
                .delete(document_templates::delete_document_template),
        )
        .route(
            "/api/v1/settings/channels/test",
            post(settings::test_channel),
        )
        .layer(middleware::from_fn(require_platform_admin_middleware))
        .merge(
            Router::new()
                .route(
                    "/api/v1/settings/account",
                    get(settings::get_account_settings).put(settings::update_account_settings),
                )
                .route("/api/v1/settings/roles", get(settings::get_role_catalog))
                .route(
                    "/api/v1/settings/users",
                    post(settings::create_account_user),
                )
                .route(
                    "/api/v1/settings/users/{id}",
                    put(settings::update_account_user),
                )
                .layer(middleware::from_fn(require_account_admin_middleware)),
        );

    // ── RBAC routes ───────────────────────────────────────────────────────────
    let rbac_routes = Router::new()
        .route(
            "/api/v1/platform/roles",
            get(rbac::list_roles).post(rbac::create_role),
        )
        .route(
            "/api/v1/platform/roles/{id}",
            put(rbac::update_role).delete(rbac::delete_role),
        )
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

    // ── Audit routes ──────────────────────────────────────────────────────────
    let audit_routes = Router::new()
        .route("/api/v1/audit/logs", get(audit::list_audit_logs))
        .route("/api/v1/audit/export", get(audit::export_audit_logs))
        .layer(middleware::from_fn(require_permission_middleware(
            "audit:read",
        )));

    // ── Report routes ─────────────────────────────────────────────────────────
    let report_routes = Router::new()
        .route("/api/v1/reports/summary", get(reports::report_summary))
        .route("/api/v1/reports/export", get(reports::export_report))
        .layer(middleware::from_fn(require_permission_middleware(
            "reports:read",
        )));

    // ── Platform card template routes (SaaS catalog) ──────────────────────────
    let platform_card_routes = Router::new()
        .route(
            "/api/v1/platform/card-templates",
            get(crate::cards::handlers::list_card_templates)
                .post(crate::cards::handlers::create_card_template),
        )
        .route(
            "/api/v1/platform/card-templates/{id}",
            get(crate::cards::handlers::get_card_template)
                .put(crate::cards::handlers::update_card_template)
                .delete(crate::cards::handlers::delete_card_template),
        )
        .route(
            "/api/v1/platform/card-templates/{id}/upload",
            post(crate::cards::handlers::upload_template_image),
        )
        .layer(middleware::from_fn(require_platform_admin_middleware));

    // ── ✅ Merge ALL protected routes ─────────────────────────────────────────
    let protected = auth_routes
        .merge(event_routes)
        .merge(card_routes)
        .merge(card_write_routes)
        .merge(file_routes)
        .merge(file_read_routes)
        .merge(message_template_read_routes)
        .merge(message_template_write_routes)
        .merge(log_routes)
        .merge(staff_read_routes)
        .merge(staff_write_routes)
        .merge(corporate_read_routes)
        .merge(corporate_write_routes)
        .merge(corporate_payment_routes)
        .merge(message_inspection_routes)
        .merge(guest_routes)
        .merge(invitation_routes)
        .merge(scanner_routes)
        .merge(scanner_write_routes)
        .merge(michango_routes)
        .merge(broadcast_routes)
        .merge(billing_routes)
        .merge(payment_routes)
        .merge(notification_routes)
        .merge(webhook_routes)
        .merge(platform_routes)
        .merge(platform_card_routes)
        .merge(settings_routes)
        .merge(rbac_routes)
        .merge(audit_routes)
        .merge(report_routes)
        .layer(middleware::from_fn(auth_middleware));

    public_routes.merge(protected).with_state(state)
}
