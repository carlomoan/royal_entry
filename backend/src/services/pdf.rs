// ==============================================================================
// FILE: src/services/pdf.rs
// ==============================================================================
// PDF generation service for post-event reports using the `printpdf` crate.
// ==============================================================================

use std::sync::Arc;
use uuid::Uuid;
use chrono::NaiveDate;
use printpdf::*;
use crate::{error::AppError, AppResult, AppState};

/// Row type for the event report query
#[derive(sqlx::FromRow)]
struct EventReportData {
    title: String,
    event_date: NaiveDate,
    venue_name: Option<String>,
    total_guests: i64,
    guests_arrived: i64,
    guests_pending: i64,
    rsvp_confirmed: i64,
    rsvp_declined: i64,
    michango_total_pledged: i64,
    michango_collected: i64,
    michango_outstanding: i64,
    payment_summary: Option<String>,
}

pub struct PdfService {
    state: Arc<AppState>,
}

impl PdfService {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    pub async fn generate_event_report(&self, event_id: Uuid) -> AppResult<Vec<u8>> {
        let data = self.fetch_event_report_data(event_id).await?;

        let (doc, page1, layer1) = PdfDocument::new(
            &format!("Event Report - {}", data.title),
            Mm(210.0),
            Mm(297.0),
            "Layer 1",
        );

        let font = doc.add_builtin_font(BuiltinFont::Helvetica)
            .map_err(|e| AppError::GenericError(format!("PDF font error: {}", e)))?;
        let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold)
            .map_err(|e| AppError::GenericError(format!("PDF font error: {}", e)))?;

        let current_layer = doc.get_page(page1).get_layer(layer1);

        let mut y_pos: f32 = 270.0;
        let left_margin = Mm(20.0);
        let font_size_title = 20.0;
        let font_size_heading = 14.0;
        let font_size_body = 10.0;

        // Title
        current_layer.use_text(&data.title, font_size_title, left_margin, Mm(y_pos), &font_bold);
        y_pos -= 12.0;

        // Event info
        let date_str = data.event_date.format("%B %d, %Y").to_string();
        let venue = data.venue_name.as_deref().unwrap_or("N/A");
        current_layer.use_text(
            &format!("Date: {}  |  Venue: {}", date_str, venue),
            font_size_body,
            left_margin,
            Mm(y_pos),
            &font,
        );
        y_pos -= 18.0;

        // ── Attendance Section ──
        current_layer.use_text("Attendance Summary", font_size_heading, left_margin, Mm(y_pos), &font_bold);
        y_pos -= 8.0;

        let attendance_items = [
            ("Total Guests", &data.total_guests.to_string()),
            ("Arrived", &data.guests_arrived.to_string()),
            ("Pending", &data.guests_pending.to_string()),
        ];
        for (label, value) in &attendance_items {
            current_layer.use_text(
                &format!("{}: {}", label, value),
                font_size_body,
                Mm(25.0),
                Mm(y_pos),
                &font,
            );
            y_pos -= 6.0;
        }

        y_pos -= 6.0;

        // ── RSVP Section ──
        current_layer.use_text("RSVP Statistics", font_size_heading, left_margin, Mm(y_pos), &font_bold);
        y_pos -= 8.0;

        let rsvp_items = [
            ("Confirmed", &data.rsvp_confirmed.to_string()),
            ("Declined", &data.rsvp_declined.to_string()),
        ];
        for (label, value) in &rsvp_items {
            current_layer.use_text(
                &format!("{}: {}", label, value),
                font_size_body,
                Mm(25.0),
                Mm(y_pos),
                &font,
            );
            y_pos -= 6.0;
        }

        y_pos -= 6.0;

        // ── Michango Section ──
        current_layer.use_text("Michango Summary", font_size_heading, left_margin, Mm(y_pos), &font_bold);
        y_pos -= 8.0;

        let michango_items = [
            ("Total Pledged (TZS)", &format_number(data.michango_total_pledged)),
            ("Collected (TZS)", &format_number(data.michango_collected)),
            ("Outstanding (TZS)", &format_number(data.michango_outstanding)),
        ];
        for (label, value) in &michango_items {
            current_layer.use_text(
                &format!("{}: {}", label, value),
                font_size_body,
                Mm(25.0),
                Mm(y_pos),
                &font,
            );
            y_pos -= 6.0;
        }

        y_pos -= 6.0;

        // ── Payment Summary Section ──
        current_layer.use_text("Payment Summary", font_size_heading, left_margin, Mm(y_pos), &font_bold);
        y_pos -= 8.0;

        let payment_text = data.payment_summary.as_deref().unwrap_or("No payment data available.");
        current_layer.use_text(
            payment_text,
            font_size_body,
            Mm(25.0),
            Mm(y_pos),
            &font,
        );

        // Footer
        current_layer.use_text(
            "Generated by RoyalEntry",
            font_size_body,
            left_margin,
            Mm(15.0),
            &font,
        );

        let bytes = doc.save_to_bytes()
            .map_err(|e| AppError::GenericError(format!("PDF save error: {}", e)))?;
        Ok(bytes)
    }

    async fn fetch_event_report_data(&self, event_id: Uuid) -> AppResult<EventReportData> {
        let event_row = sqlx::query_as::<_, EventReportData>(
            r#"
            SELECT
                e.title,
                e.event_date,
                e.venue_name,
                COUNT(DISTINCT g.id)::BIGINT as total_guests,
                COUNT(DISTINCT es.guest_id)::BIGINT as guests_arrived,
                (COUNT(DISTINCT g.id) - COUNT(DISTINCT es.guest_id))::BIGINT as guests_pending,
                COUNT(DISTINCT CASE WHEN r.response = 'confirmed' THEN g.id END)::BIGINT as rsvp_confirmed,
                COUNT(DISTINCT CASE WHEN r.response = 'declined' THEN g.id END)::BIGINT as rsvp_declined,
                COALESCE(SUM(pt.pledged_amount)::BIGINT, 0) as michango_total_pledged,
                COALESCE(SUM(pt.amount_paid)::BIGINT, 0) as michango_collected,
                COALESCE(SUM(pt.pledged_amount - pt.amount_paid)::BIGINT, 0) as michango_outstanding,
                NULL::TEXT as payment_summary
            FROM events e
            LEFT JOIN guests g ON e.id = g.event_id
            LEFT JOIN entry_scans es ON e.id = es.event_id AND g.id = es.guest_id
            LEFT JOIN rsvp_responses r ON g.id = r.guest_id AND e.id = r.event_id
            LEFT JOIN pledge_tracker pt ON e.id = pt.event_id AND g.id = pt.guest_id
            WHERE e.id = $1
            GROUP BY e.title, e.event_date, e.venue_name
            "#,
        )
        .bind(event_id)
        .fetch_one(self.state.db.pool())
        .await?;

        Ok(event_row)
    }
}

/// Format a number with thousand separators for readability
fn format_number(n: i64) -> String {
    let num_str = n.to_string();
    let mut result = String::new();
    let len = num_str.len();
    for (i, ch) in num_str.chars().enumerate() {
        if i > 0 && (len - i) % 3 == 0 {
            result.push(',');
        }
        result.push(ch);
    }
    result
}
