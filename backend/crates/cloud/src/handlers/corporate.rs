// ==============================================================================
// FILE: crates/cloud/src/handlers/corporate.rs
// ==============================================================================
// Corporate/concert event mode: package setup, company bookings, payment
// confirmation with proof, pass (guest) creation, table reservations, seating
// suggestions and the gate dashboard.
// ==============================================================================
use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    handlers::invitations::ensure_invitation,
    models::{
        corporate::{
            Booking, BookingInvoice, BookingPackageView, BookingTable, BookingView,
            ConfirmBookingRequest, CreateBookingRequest, CreateOpenTableRequest,
            CreatePackageRequest, CreateParkingVariantRequest, CreateTableRequest, EventPackage,
            OpenTable, PackageQuantity, ParkingVariant, SeatingSuggestion, UpdateBookingRequest,
            UpdatePackageRequest,
        },
        event::Event,
        user::Claims,
    },
    repository::event_repository::EventRepository,
    AppState,
};

async fn assert_event_ownership(
    state: &Arc<AppState>,
    event_id: Uuid,
    org_id: Uuid,
) -> AppResult<Event> {
    let event = EventRepository::get_by_id(state.db.pool(), event_id)
        .await?
        .ok_or(AppError::EventNotFound)?;
    if event.organization_id != org_id {
        return Err(AppError::Forbidden);
    }
    Ok(event)
}

fn org_id_from(claims: &Claims) -> AppResult<Uuid> {
    Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)
}

fn user_id_from(claims: &Claims) -> AppResult<Uuid> {
    Uuid::parse_str(&claims.sub).map_err(|_| AppError::InvalidToken)
}

// ── Packages ─────────────────────────────────────────────────────────────────

pub async fn list_packages(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let packages = sqlx::query_as::<_, EventPackage>(
        "SELECT * FROM event_packages WHERE event_id = $1 ORDER BY created_at ASC",
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": packages })))
}

pub async fn create_package(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<CreatePackageRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    if payload.name.trim().is_empty() {
        return Err(AppError::ValidationError("Package name is required".into()));
    }
    if payload.price_tsh <= 0 || payload.seats_per_table <= 0 {
        return Err(AppError::ValidationError(
            "Price and seats per table must be greater than zero".into(),
        ));
    }
    let package = sqlx::query_as::<_, EventPackage>(
        r#"
        INSERT INTO event_packages
            (id, event_id, name, description, price_tsh, seats_per_table, card_template_id, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(payload.name.trim())
    .bind(payload.description)
    .bind(payload.price_tsh)
    .bind(payload.seats_per_table)
    .bind(payload.card_template_id)
    .bind(payload.is_active.unwrap_or(true))
    .fetch_one(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": package })))
}

pub async fn update_package(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, package_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdatePackageRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let existing = sqlx::query_as::<_, EventPackage>(
        "SELECT * FROM event_packages WHERE id = $1 AND event_id = $2",
    )
    .bind(package_id)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Package not found".into()))?;

    let package = sqlx::query_as::<_, EventPackage>(
        r#"
        UPDATE event_packages SET
            name = $1, description = $2, price_tsh = $3, seats_per_table = $4,
            card_template_id = $5, is_active = $6, updated_at = NOW()
        WHERE id = $7 AND event_id = $8
        RETURNING *
        "#,
    )
    .bind(payload.name.unwrap_or(existing.name))
    .bind(payload.description.or(existing.description))
    .bind(payload.price_tsh.unwrap_or(existing.price_tsh))
    .bind(payload.seats_per_table.unwrap_or(existing.seats_per_table))
    .bind(payload.card_template_id.or(existing.card_template_id))
    .bind(payload.is_active.unwrap_or(existing.is_active))
    .bind(package_id)
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": package })))
}

pub async fn delete_package(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, package_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let in_use: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM booking_packages WHERE package_id = $1",
    )
    .bind(package_id)
    .fetch_one(state.db.pool())
    .await?;
    if in_use > 0 {
        return Err(AppError::BadRequest(
            "This package is used by one or more bookings. Deactivate it instead.".into(),
        ));
    }
    sqlx::query("DELETE FROM event_packages WHERE id = $1 AND event_id = $2")
        .bind(package_id)
        .bind(event_id)
        .execute(state.db.pool())
        .await?;
    Ok(Json(json!({ "success": true })))
}

// ── Bookings ─────────────────────────────────────────────────────────────────

async fn load_booking_view(pool: &sqlx::PgPool, booking: Booking) -> AppResult<BookingView> {
    let packages = sqlx::query_as::<_, BookingPackageView>(
        r#"
        SELECT bp.package_id, p.name, bp.quantity, p.price_tsh, p.seats_per_table
        FROM booking_packages bp
        JOIN event_packages p ON p.id = bp.package_id
        WHERE bp.booking_id = $1
        ORDER BY p.name
        "#,
    )
    .bind(booking.id)
    .fetch_all(pool)
    .await?;

    let tables = sqlx::query_as::<_, BookingTable>(
        "SELECT * FROM booking_tables WHERE booking_id = $1 ORDER BY table_number",
    )
    .bind(booking.id)
    .fetch_all(pool)
    .await?;

    let total_amount: i64 = packages
        .iter()
        .map(|p| p.price_tsh.saturating_mul(i64::from(p.quantity)))
        .sum();
    let balance = (total_amount - booking.amount_paid).max(0);
    let passes_created: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM guests WHERE booking_id = $1",
    )
    .bind(booking.id)
    .fetch_one(pool)
    .await?;

    Ok(BookingView {
        booking,
        total_amount,
        balance,
        passes_created: passes_created as i32,
        packages,
        tables,
    })
}

async fn validate_packages(
    pool: &sqlx::PgPool,
    event_id: Uuid,
    items: &[PackageQuantity],
) -> AppResult<()> {
    if items.is_empty() {
        return Err(AppError::ValidationError(
            "At least one package is required".into(),
        ));
    }
    for item in items {
        if item.quantity <= 0 {
            return Err(AppError::ValidationError(
                "Package quantity must be greater than zero".into(),
            ));
        }
        let valid: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM event_packages WHERE id = $1 AND event_id = $2 AND is_active = TRUE)",
        )
        .bind(item.package_id)
        .bind(event_id)
        .fetch_one(pool)
        .await?;
        if !valid {
            return Err(AppError::ValidationError(
                "One or more packages do not belong to this event".into(),
            ));
        }
    }
    Ok(())
}

async fn replace_booking_packages(
    pool: &sqlx::PgPool,
    booking_id: Uuid,
    items: &[PackageQuantity],
) -> AppResult<()> {
    sqlx::query("DELETE FROM booking_packages WHERE booking_id = $1")
        .bind(booking_id)
        .execute(pool)
        .await?;
    for item in items {
        sqlx::query(
            "INSERT INTO booking_packages (booking_id, package_id, quantity) VALUES ($1, $2, $3)",
        )
        .bind(booking_id)
        .bind(item.package_id)
        .bind(item.quantity)
        .execute(pool)
        .await?;
    }
    Ok(())
}

pub async fn list_bookings(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let bookings = sqlx::query_as::<_, Booking>(
        "SELECT * FROM bookings WHERE event_id = $1 ORDER BY created_at DESC",
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;
    let mut views = Vec::with_capacity(bookings.len());
    for booking in bookings {
        views.push(load_booking_view(state.db.pool(), booking).await?);
    }
    Ok(Json(json!({ "success": true, "data": views })))
}

pub async fn get_booking(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, booking_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let booking = sqlx::query_as::<_, Booking>(
        "SELECT * FROM bookings WHERE id = $1 AND event_id = $2",
    )
    .bind(booking_id)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Booking not found".into()))?;
    let view = load_booking_view(state.db.pool(), booking).await?;
    Ok(Json(json!({ "success": true, "data": view })))
}

pub async fn create_booking(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<CreateBookingRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    let user_id = user_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    validate_packages(state.db.pool(), event_id, &payload.packages).await?;
    if payload.company_name.trim().is_empty()
        || payload.contact_person.trim().is_empty()
        || payload.contact_phone.trim().is_empty()
    {
        return Err(AppError::ValidationError(
            "Company, contact person and phone are required".into(),
        ));
    }

    let booking = sqlx::query_as::<_, Booking>(
        r#"
        INSERT INTO bookings
            (id, event_id, company_name, contact_person, contact_phone, contact_email,
             payment_reference, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(payload.company_name.trim())
    .bind(payload.contact_person.trim())
    .bind(payload.contact_phone.trim())
    .bind(payload.contact_email)
    .bind(payload.payment_reference)
    .bind(payload.notes)
    .bind(user_id)
    .fetch_one(state.db.pool())
    .await?;

    replace_booking_packages(state.db.pool(), booking.id, &payload.packages).await?;
    let view = load_booking_view(state.db.pool(), booking).await?;
    Ok(Json(json!({ "success": true, "data": view })))
}

pub async fn update_booking(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, booking_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateBookingRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let existing = sqlx::query_as::<_, Booking>(
        "SELECT * FROM bookings WHERE id = $1 AND event_id = $2",
    )
    .bind(booking_id)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Booking not found".into()))?;
    if existing.confirmed_at.is_some() {
        return Err(AppError::BadRequest(
            "A confirmed booking cannot be edited. Withdraw the confirmation first.".into(),
        ));
    }
    if let Some(ref items) = payload.packages {
        validate_packages(state.db.pool(), event_id, items).await?;
        replace_booking_packages(state.db.pool(), booking_id, items).await?;
    }
    let booking = sqlx::query_as::<_, Booking>(
        r#"
        UPDATE bookings SET
            company_name = $1, contact_person = $2, contact_phone = $3,
            contact_email = $4, notes = $5, updated_at = NOW()
        WHERE id = $6 AND event_id = $7
        RETURNING *
        "#,
    )
    .bind(payload.company_name.unwrap_or(existing.company_name))
    .bind(payload.contact_person.unwrap_or(existing.contact_person))
    .bind(payload.contact_phone.unwrap_or(existing.contact_phone))
    .bind(payload.contact_email.or(existing.contact_email))
    .bind(payload.notes.or(existing.notes))
    .bind(booking_id)
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;
    let view = load_booking_view(state.db.pool(), booking).await?;
    Ok(Json(json!({ "success": true, "data": view })))
}

/// Create one pass per seat for a confirmed booking. Idempotent: it only
/// creates passes that do not exist yet, so repeated confirmation calls
/// (installment top-ups) never duplicate tickets.
async fn create_passes(
    state: &Arc<AppState>,
    event: &Event,
    booking: &Booking,
) -> AppResult<(i32, Vec<String>)> {
    let rows = sqlx::query(
        r#"
        SELECT bp.package_id, bp.quantity, p.name, p.seats_per_table
        FROM booking_packages bp
        JOIN event_packages p ON p.id = bp.package_id
        WHERE bp.booking_id = $1
        ORDER BY p.name
        "#,
    )
    .bind(booking.id)
    .fetch_all(state.db.pool())
    .await?;

    let mut created = 0;
    let mut links = Vec::new();

    for row in &rows {
        let package_id: Uuid = row.try_get("package_id")?;
        let quantity: i32 = row.try_get("quantity")?;
        let package_name: String = row.try_get("name")?;
        let seats_per_table: i32 = row.try_get("seats_per_table")?;
        let expected = quantity.saturating_mul(seats_per_table);

        let existing: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM guests WHERE booking_id = $1 AND package_id = $2",
        )
        .bind(booking.id)
        .bind(package_id)
        .fetch_one(state.db.pool())
        .await?;

        let tables: Vec<String> = sqlx::query_scalar(
            "SELECT table_number FROM booking_tables WHERE booking_id = $1 AND (package_id = $2 OR package_id IS NULL) ORDER BY table_number",
        )
        .bind(booking.id)
        .bind(package_id)
        .fetch_all(state.db.pool())
        .await?;

        for seat in (existing + 1)..=i64::from(expected) {
            let guest_id = Uuid::new_v4();
            let table_number = if tables.is_empty() {
                None
            } else {
                Some(tables[(seat as usize - 1) % tables.len()].clone())
            };
            let full_name = format!("{} — {} seat {}", booking.company_name, package_name, seat);
            let contact_method = if booking.contact_email.is_some() { "email" } else { "sms" };

            sqlx::query(
                r#"
                INSERT INTO guests
                    (id, event_id, full_name, phone, email, table_number, guest_category,
                     device_type, contact_method, party_size, booking_id, package_id,
                     card_issued_at, notes)
                VALUES ($1, $2, $3, $4, $5, $6, 'VIP', 'smartphone', $7, 1, $8, $9, NOW(), $10)
                "#,
            )
            .bind(guest_id)
            .bind(event.id)
            .bind(&full_name)
            .bind(&booking.contact_phone)
            .bind(&booking.contact_email)
            .bind(&table_number)
            .bind(contact_method)
            .bind(booking.id)
            .bind(package_id)
            .bind(format!("Corporate pass: {}", package_name))
            .execute(state.db.pool())
            .await?;

            let invitation = ensure_invitation(state.db.pool(), guest_id).await?;
            links.push(invitation.short_link);
            created += 1;
        }
    }

    Ok((created, links))
}

async fn notify_contact(
    state: &Arc<AppState>,
    event: &Event,
    booking: &Booking,
    passes: i32,
    links: &[String],
) {
    let base_url = state.config.app.frontend_url.trim_end_matches('/');
    let listed = links
        .iter()
        .take(5)
        .map(|l| format!("{}/g/{}", base_url, l))
        .collect::<Vec<_>>()
        .join("\n");
    let more = if links.len() > 5 {
        format!("\n…and {} more cards in the event dashboard.", links.len() - 5)
    } else {
        String::new()
    };
    let text = format!(
        "Your {} booking for {} is confirmed. {} check-in cards are ready:\n{}{}\nShow the QR code or link at the gate.",
        event.title, booking.company_name, passes, listed, more
    );

    if let Some(email) = booking.contact_email.as_deref().filter(|e| !e.is_empty()) {
        let html = crate::services::channels::html_wrap(&text.replace('\n', "<br>"));
        if let Err(e) = state
            .channels
            .email(email, &format!("{} — check-in passes", event.title), &html)
            .await
        {
            tracing::warn!(booking_id = %booking.id, error = %e, "Failed to email booking passes");
        }
    } else if let Err(e) = state
        .channels
        .sms(&[booking.contact_phone.clone()], &text)
        .await
    {
        tracing::warn!(booking_id = %booking.id, error = %e, "Failed to SMS booking passes");
    }
}

pub async fn confirm_booking(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, booking_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<ConfirmBookingRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    let event = assert_event_ownership(&state, event_id, org_id).await?;
    let booking = sqlx::query_as::<_, Booking>(
        "SELECT * FROM bookings WHERE id = $1 AND event_id = $2",
    )
    .bind(booking_id)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Booking not found".into()))?;

    let amount_paid = payload.amount_paid.unwrap_or(booking.amount_paid);
    if amount_paid < 0 {
        return Err(AppError::ValidationError(
            "Amount paid cannot be negative".into(),
        ));
    }
    let was_confirmed = booking.confirmed_at.is_some();

    let booking = sqlx::query_as::<_, Booking>(
        r#"
        UPDATE bookings SET
            payment_reference = COALESCE($1, payment_reference),
            amount_paid = $2,
            proof_file_id = COALESCE($3, proof_file_id),
            notes = COALESCE($4, notes),
            confirmed_at = COALESCE(confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = $5 AND event_id = $6
        RETURNING *
        "#,
    )
    .bind(payload.payment_reference)
    .bind(amount_paid)
    .bind(payload.proof_file_id)
    .bind(payload.notes)
    .bind(booking_id)
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;

    let (passes_created, links) = if was_confirmed {
        (0, Vec::new())
    } else {
        create_passes(&state, &event, &booking).await?
    };
    if passes_created > 0 {
        // Email/SMS delivery can be slow or unavailable. Never hold the API
        // response open for it — the passes are already committed.
        let notify_state = state.clone();
        let notify_event = event.clone();
        let notify_booking = booking.clone();
        let notify_links = links.clone();
        tokio::spawn(async move {
            notify_contact(
                &notify_state,
                &notify_event,
                &notify_booking,
                passes_created,
                &notify_links,
            )
            .await;
        });
    }

    let view = load_booking_view(state.db.pool(), booking).await?;
    let _ = crate::services::NotificationService::create_org(
        state.db.pool(),
        org_id,
        "booking.confirmed",
        "Booking confirmed",
        Some(&format!(
            "{} — {} pass(es) issued, balance TZS {}",
            view.booking.company_name, view.passes_created, view.balance
        )),
        Some(&format!("/events/{event_id}")),
        Some(json!({"event_id": event_id, "booking_id": booking_id})),
    )
    .await;

    Ok(Json(json!({
        "success": true,
        "data": {
            "confirmed_at": view.booking.confirmed_at,
            "passes_created": passes_created,
            "balance": view.balance,
            "total_amount": view.total_amount,
        }
    })))
}

// ── Tables & seating ─────────────────────────────────────────────────────────

pub async fn add_table(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, booking_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<CreateTableRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let booking_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM bookings WHERE id = $1 AND event_id = $2)",
    )
    .bind(booking_id)
    .bind(event_id)
    .fetch_one(state.db.pool())
    .await?;
    if !booking_exists {
        return Err(AppError::NotFound("Booking not found".into()));
    }
    if payload.table_number.trim().is_empty() {
        return Err(AppError::ValidationError("Table number is required".into()));
    }
    let table = sqlx::query_as::<_, BookingTable>(
        r#"
        INSERT INTO booking_tables (id, booking_id, package_id, table_number)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (booking_id, table_number) DO UPDATE SET package_id = EXCLUDED.package_id
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(booking_id)
    .bind(payload.package_id)
    .bind(payload.table_number.trim())
    .fetch_one(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": table })))
}

pub async fn remove_table(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, booking_id, table_id)): Path<(Uuid, Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    sqlx::query(
        "DELETE FROM booking_tables WHERE id = $1 AND booking_id = $2 AND booking_id IN (SELECT id FROM bookings WHERE event_id = $3)",
    )
    .bind(table_id)
    .bind(booking_id)
    .bind(event_id)
    .execute(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true })))
}

pub async fn list_open_tables(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let tables = sqlx::query_as::<_, OpenTable>(
        "SELECT * FROM event_open_tables WHERE event_id = $1 ORDER BY table_number",
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": tables })))
}

pub async fn create_open_table(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<CreateOpenTableRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    if payload.table_number.trim().is_empty() || payload.capacity <= 0 {
        return Err(AppError::ValidationError(
            "Table number and a positive capacity are required".into(),
        ));
    }
    let table = sqlx::query_as::<_, OpenTable>(
        r#"
        INSERT INTO event_open_tables (id, event_id, table_number, capacity, label)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (event_id, table_number) DO UPDATE SET capacity = EXCLUDED.capacity, label = EXCLUDED.label
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(payload.table_number.trim())
    .bind(payload.capacity)
    .bind(payload.label)
    .fetch_one(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": table })))
}

#[derive(Debug, Deserialize)]
pub struct SuggestQuery {
    pub booking_id: Uuid,
}

async fn seated_at(pool: &sqlx::PgPool, event_id: Uuid, table: &str) -> i32 {
    let count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(DISTINCT es.guest_id)
        FROM entry_scans es
        JOIN guests g ON g.id = es.guest_id
        WHERE es.event_id = $1 AND g.table_number = $2
        "#,
    )
    .bind(event_id)
    .bind(table)
    .fetch_one(pool)
    .await
    .unwrap_or(0);
    count as i32
}

/// Suggest the next table for overflow guests, in the organizer's priority
/// order: the booking's own tables, open/shared tables, then a new table that
/// the usher must confirm.
pub async fn suggest_seating(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Query(query): Query<SuggestQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let booking = sqlx::query_as::<_, Booking>(
        "SELECT * FROM bookings WHERE id = $1 AND event_id = $2",
    )
    .bind(query.booking_id)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Booking not found".into()))?;

    let own = sqlx::query(
        r#"
        SELECT bt.table_number, COALESCE(p.seats_per_table, 5) AS capacity
        FROM booking_tables bt
        LEFT JOIN event_packages p ON p.id = bt.package_id
        WHERE bt.booking_id = $1
        ORDER BY bt.table_number
        "#,
    )
    .bind(booking.id)
    .fetch_all(state.db.pool())
    .await?;
    for row in &own {
        let table: String = row.try_get("table_number")?;
        let capacity: i32 = row.try_get("capacity").unwrap_or(5);
        let seated = seated_at(state.db.pool(), event_id, &table).await;
        if seated < capacity {
            return Ok(Json(json!({ "success": true, "data": SeatingSuggestion {
                table_number: table,
                reason: "Reserved table for this company has free seats".into(),
                seated,
                capacity,
            }})));
        }
    }

    let open = sqlx::query_as::<_, OpenTable>(
        "SELECT * FROM event_open_tables WHERE event_id = $1 ORDER BY table_number",
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;
    for table in open {
        let seated = seated_at(state.db.pool(), event_id, &table.table_number).await;
        if seated < table.capacity {
            return Ok(Json(json!({ "success": true, "data": SeatingSuggestion {
                table_number: table.table_number,
                reason: "Open/shared table".into(),
                seated,
                capacity: table.capacity,
            }})));
        }
    }

    let max_capacity: i32 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(MAX(p.seats_per_table), 5)::INT
        FROM booking_packages bp
        JOIN event_packages p ON p.id = bp.package_id
        WHERE bp.booking_id = $1
        "#,
    )
    .bind(booking.id)
    .fetch_one(state.db.pool())
    .await?;

    let mut highest = 0;
    for row in &own {
        if let Ok(n) = row.try_get::<String, _>("table_number")?.parse::<i32>() {
            highest = highest.max(n);
        }
    }
    for table in sqlx::query_scalar::<_, String>(
        "SELECT table_number FROM event_open_tables WHERE event_id = $1",
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?
    {
        if let Ok(n) = table.parse::<i32>() {
            highest = highest.max(n);
        }
    }

    Ok(Json(json!({ "success": true, "data": SeatingSuggestion {
        table_number: (highest + 1).to_string(),
        reason: "Next free table — usher to confirm and invoice an extra seat".into(),
        seated: 0,
        capacity: max_capacity,
    }})))
}

// ── Gate dashboard ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct GateGuest {
    guest_id: Uuid,
    full_name: String,
    phone: String,
    table_number: Option<String>,
    seat_number: Option<String>,
    guest_category: Option<String>,
    party_size: i32,
    entries_used: i32,
    arrived: bool,
    company_name: Option<String>,
    package_name: Option<String>,
}

#[derive(Debug, Serialize)]
struct GateTable {
    table_number: String,
    capacity: i32,
    seated: i32,
    company_name: Option<String>,
}

#[derive(Debug, Serialize)]
struct GateDashboard {
    expected_count: usize,
    arrived_count: usize,
    tables: Vec<GateTable>,
    guests: Vec<GateGuest>,
}

pub async fn gate_dashboard(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let rows = sqlx::query(
        r#"
        SELECT g.id AS guest_id, g.full_name, g.phone, g.table_number, g.seat_number,
               g.guest_category, g.party_size,
               (SELECT COUNT(*) FROM entry_scans es WHERE es.guest_id = g.id)::BIGINT AS entries_used,
               b.company_name, p.name AS package_name
        FROM guests g
        LEFT JOIN bookings b ON b.id = g.booking_id
        LEFT JOIN event_packages p ON p.id = g.package_id
        WHERE g.event_id = $1
        ORDER BY g.table_number NULLS LAST, g.full_name
        "#,
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;

    let mut guests = Vec::with_capacity(rows.len());
    let mut seated_by_table: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
    let mut arrived_count = 0usize;
    for row in &rows {
        let entries_used: i64 = row.try_get("entries_used").unwrap_or(0);
        let arrived = entries_used > 0;
        if arrived {
            arrived_count += 1;
        }
        let table_number: Option<String> = row.try_get("table_number").ok();
        if arrived {
            if let Some(ref table) = table_number {
                *seated_by_table.entry(table.clone()).or_insert(0) += 1;
            }
        }
        guests.push(GateGuest {
            guest_id: row.try_get("guest_id")?,
            full_name: row.try_get("full_name").unwrap_or_default(),
            phone: row.try_get("phone").unwrap_or_default(),
            table_number,
            seat_number: row.try_get("seat_number").ok(),
            guest_category: row.try_get("guest_category").ok(),
            party_size: row.try_get("party_size").unwrap_or(1),
            entries_used: entries_used as i32,
            arrived,
            company_name: row.try_get("company_name").ok(),
            package_name: row.try_get("package_name").ok(),
        });
    }

    let table_rows = sqlx::query(
        r#"
        SELECT bt.table_number, COALESCE(p.seats_per_table, 5) AS capacity, b.company_name
        FROM booking_tables bt
        JOIN bookings b ON b.id = bt.booking_id
        LEFT JOIN event_packages p ON p.id = bt.package_id
        WHERE b.event_id = $1
        UNION ALL
        SELECT ot.table_number, ot.capacity, NULL::TEXT AS company_name
        FROM event_open_tables ot WHERE ot.event_id = $1
        ORDER BY 1
        "#,
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;
    let tables = table_rows
        .into_iter()
        .map(|row| {
            let table_number: String = row.try_get("table_number").unwrap_or_default();
            let capacity: i32 = row.try_get("capacity").unwrap_or(5);
            GateTable {
                seated: seated_by_table.get(&table_number).copied().unwrap_or(0).min(capacity),
                table_number,
                capacity,
                company_name: row.try_get("company_name").ok(),
            }
        })
        .collect();

    Ok(Json(json!({
        "success": true,
        "data": GateDashboard {
            expected_count: guests.len(),
            arrived_count,
            tables,
            guests,
        }
    })))
}

// ── Parking variants ─────────────────────────────────────────────────────────

pub async fn list_parking_variants(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let variants = sqlx::query_as::<_, ParkingVariant>(
        "SELECT * FROM event_parking_variants WHERE event_id = $1 ORDER BY class_name",
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": variants })))
}

pub async fn create_parking_variant(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
    Json(payload): Json<CreateParkingVariantRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    if payload.class_name.trim().is_empty() || payload.instructions.trim().is_empty() {
        return Err(AppError::ValidationError(
            "Class name and instructions are required".into(),
        ));
    }
    let variant = sqlx::query_as::<_, ParkingVariant>(
        r#"
        INSERT INTO event_parking_variants (id, event_id, class_name, instructions)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (event_id, class_name) DO UPDATE SET instructions = EXCLUDED.instructions
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(payload.class_name.trim())
    .bind(payload.instructions.trim())
    .fetch_one(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": variant })))
}

pub async fn delete_parking_variant(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, variant_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    sqlx::query("DELETE FROM event_parking_variants WHERE id = $1 AND event_id = $2")
        .bind(variant_id)
        .bind(event_id)
        .execute(state.db.pool())
        .await?;
    Ok(Json(json!({ "success": true })))
}

// ── Booking invoices ─────────────────────────────────────────────────────────

pub async fn get_booking_invoice(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, booking_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;
    let invoice = sqlx::query_as::<_, BookingInvoice>(
        "SELECT * FROM booking_invoices WHERE booking_id = $1 AND event_id = $2 ORDER BY issued_at DESC LIMIT 1",
    )
    .bind(booking_id)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?;
    Ok(Json(json!({ "success": true, "data": invoice })))
}

/// Generate (or return the existing) invoice for a booking. Tax is taken from
/// the account's system settings; the organizer TIN is included when set.
pub async fn generate_booking_invoice(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path((event_id, booking_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    let event = assert_event_ownership(&state, event_id, org_id).await?;
    let booking = sqlx::query_as::<_, Booking>(
        "SELECT * FROM bookings WHERE id = $1 AND event_id = $2",
    )
    .bind(booking_id)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    .ok_or(AppError::NotFound("Booking not found".into()))?;

    if let Some(existing) = sqlx::query_as::<_, BookingInvoice>(
        "SELECT * FROM booking_invoices WHERE booking_id = $1 AND event_id = $2 ORDER BY issued_at DESC LIMIT 1",
    )
    .bind(booking_id)
    .bind(event_id)
    .fetch_optional(state.db.pool())
    .await?
    {
        return Ok(Json(json!({ "success": true, "data": existing })));
    }

    let view = load_booking_view(state.db.pool(), booking.clone()).await?;
    if view.total_amount <= 0 {
        return Err(AppError::BadRequest("Booking has no priced packages".into()));
    }

    let settings: Vec<(String, serde_json::Value)> = sqlx::query_as(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN \
         ('tax_enabled','tax_vat_rate_percent','tax_inclusive','tax_tin','tax_tra_tin')",
    )
    .fetch_all(state.db.pool())
    .await
    .unwrap_or_default();
    let mut tax_enabled = false;
    let mut rate = 0.0f64;
    let mut inclusive = false;
    let mut tin: Option<String> = None;
    for (key, value) in settings {
        match key.as_str() {
            "tax_enabled" => tax_enabled = value.as_bool().unwrap_or(false),
            "tax_vat_rate_percent" => rate = value.as_f64().unwrap_or(0.0),
            "tax_inclusive" => inclusive = value.as_bool().unwrap_or(false),
            "tax_tin" | "tax_tra_tin" => {
                tin = value.as_str().map(str::to_string).filter(|s| !s.is_empty())
            }
            _ => {}
        }
    }
    let rate = if tax_enabled { rate.max(0.0) } else { 0.0 };
    let (total, tax_amount) = if rate == 0.0 {
        (view.total_amount, 0)
    } else if inclusive {
        let tax = ((view.total_amount as f64) * rate / (100.0 + rate)).round() as i64;
        (view.total_amount, tax)
    } else {
        let tax = ((view.total_amount as f64) * rate / 100.0).round() as i64;
        (view.total_amount + tax, tax)
    };

    let invoice_number = format!(
        "INV-{}-{}",
        Utc::now().format("%Y%m%d"),
        Uuid::new_v4().simple().to_string().chars().take(8).collect::<String>().to_uppercase()
    );
    let invoice = sqlx::query_as::<_, BookingInvoice>(
        r#"
        INSERT INTO booking_invoices
            (id, organization_id, event_id, booking_id, invoice_number, amount_tsh,
             tax_rate_percent, tax_amount_tsh, tax_inclusive, tin, status, issued_at, due_at, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open', NOW(), NOW() + INTERVAL '14 days', $11)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(org_id)
    .bind(event_id)
    .bind(booking_id)
    .bind(&invoice_number)
    .bind(total)
    .bind(rate)
    .bind(tax_amount)
    .bind(inclusive)
    .bind(&tin)
    .bind(format!("{} — {} booking", event.title, booking.company_name))
    .fetch_one(state.db.pool())
    .await?;

    Ok(Json(json!({ "success": true, "data": invoice })))
}

// ── Corporate report ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct PackageReport {
    package_id: Uuid,
    name: String,
    bookings: i32,
    seats: i32,
    passes: i32,
    arrived: i32,
    revenue: i64,
    paid: i64,
    balance: i64,
}

#[derive(Debug, Serialize)]
struct CompanyReport {
    booking_id: Uuid,
    company_name: String,
    contact_person: String,
    confirmed: bool,
    total: i64,
    paid: i64,
    balance: i64,
    passes: i32,
    arrived: i32,
}

#[derive(Debug, Serialize)]
struct TableReport {
    table_number: String,
    company_name: Option<String>,
    capacity: i32,
    passes: i32,
    seated: i32,
}

#[derive(Debug, Serialize)]
struct CorporateReport {
    total_bookings: usize,
    confirmed_bookings: usize,
    total_revenue: i64,
    total_paid: i64,
    total_balance: i64,
    total_passes: i32,
    passes_arrived: i32,
    by_package: Vec<PackageReport>,
    by_company: Vec<CompanyReport>,
    by_table: Vec<TableReport>,
}

pub async fn corporate_report(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(event_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let org_id = org_id_from(&claims)?;
    assert_event_ownership(&state, event_id, org_id).await?;

    let bookings = sqlx::query_as::<_, Booking>(
        "SELECT * FROM bookings WHERE event_id = $1 ORDER BY created_at DESC",
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;

    let mut by_package: std::collections::HashMap<Uuid, PackageReport> = std::collections::HashMap::new();
    let mut by_company = Vec::with_capacity(bookings.len());
    let mut total_revenue = 0i64;
    let mut total_paid = 0i64;
    let mut total_balance = 0i64;
    let mut total_passes = 0i32;
    let mut passes_arrived = 0i32;
    let mut confirmed_bookings = 0usize;

    for booking in bookings {
        let view = load_booking_view(state.db.pool(), booking).await?;
        let confirmed = view.booking.confirmed_at.is_some();
        if confirmed {
            confirmed_bookings += 1;
        }
        total_revenue += view.total_amount;
        total_paid += view.booking.amount_paid;
        total_balance += view.balance;

        let arrived: i32 = sqlx::query_scalar(
            r#"
            SELECT COUNT(DISTINCT g.id)::INT
            FROM guests g
            JOIN entry_scans es ON es.guest_id = g.id
            WHERE g.booking_id = $1
            "#,
        )
        .bind(view.booking.id)
        .fetch_one(state.db.pool())
        .await
        .unwrap_or(0);
        total_passes += view.passes_created;
        passes_arrived += arrived;

        for pkg in &view.packages {
            let entry = by_package.entry(pkg.package_id).or_insert_with(|| PackageReport {
                package_id: pkg.package_id,
                name: pkg.name.clone(),
                bookings: 0,
                seats: 0,
                passes: 0,
                arrived: 0,
                revenue: 0,
                paid: 0,
                balance: 0,
            });
            entry.bookings += 1;
            entry.seats += pkg.quantity * pkg.seats_per_table;
            entry.revenue += pkg.price_tsh * i64::from(pkg.quantity);
            entry.paid += view.booking.amount_paid;
            entry.balance += view.balance;
        }

        by_company.push(CompanyReport {
            booking_id: view.booking.id,
            company_name: view.booking.company_name,
            contact_person: view.booking.contact_person,
            confirmed,
            total: view.total_amount,
            paid: view.booking.amount_paid,
            balance: view.balance,
            passes: view.passes_created,
            arrived,
        });
    }

    let table_rows = sqlx::query(
        r#"
        SELECT bt.table_number, COALESCE(p.seats_per_table, 5) AS capacity, b.company_name
        FROM booking_tables bt
        JOIN bookings b ON b.id = bt.booking_id
        LEFT JOIN event_packages p ON p.id = bt.package_id
        WHERE b.event_id = $1
        UNION ALL
        SELECT ot.table_number, ot.capacity, NULL::TEXT AS company_name
        FROM event_open_tables ot WHERE ot.event_id = $1
        ORDER BY 1
        "#,
    )
    .bind(event_id)
    .fetch_all(state.db.pool())
    .await?;
    let mut by_table = Vec::with_capacity(table_rows.len());
    for row in &table_rows {
        let table: String = row.try_get("table_number").unwrap_or_default();
        let (passes, seated): (i32, i32) = sqlx::query_as(
            r#"
            SELECT COUNT(*)::INT, COUNT(es.id)::INT
            FROM guests g
            LEFT JOIN entry_scans es ON es.guest_id = g.id
            WHERE g.event_id = $1 AND g.table_number = $2
            "#,
        )
        .bind(event_id)
        .bind(&table)
        .fetch_one(state.db.pool())
        .await
        .unwrap_or((0, 0));
        by_table.push(TableReport {
            table_number: table,
            company_name: row.try_get("company_name").ok(),
            capacity: row.try_get("capacity").unwrap_or(5),
            passes,
            seated,
        });
    }

    let report = CorporateReport {
        total_bookings: by_company.len(),
        confirmed_bookings,
        total_revenue,
        total_paid,
        total_balance,
        total_passes,
        passes_arrived,
        by_package: by_package.into_values().collect(),
        by_company,
        by_table,
    };
    Ok(Json(json!({ "success": true, "data": report })))
}
