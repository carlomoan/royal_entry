//! Zebra Programming Language (ZPL) badge printer — generates raw ZPL strings
//! for thermal label printers (Zebra / Brother / TSC family).
//!
//! Activation: when the Tauri desktop Hub starts, the IPC command
//! `print_badge` accepts (badge fields) and returns a ZPL string the host
//! can pipe to a serial port via the `serialport` crate.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BadgePayload {
    pub attendee_name: String,
    pub tenant_name: String,
    pub event_title: String,
    pub qr_payload: String,
    pub table_number: Option<String>,
    pub seat_number: Option<String>,
}

/// Build a ZPL II string for a 4"×6" badge.
/// Layout (origin top-left, units in dots @ 203 dpi):
///   - 50, 50   : attendee name (44pt)
///   - 50, 110  : tenant name (28pt)
///   - 50, 160  : event title (24pt)
///   - 50, 220  : table / seat (24pt)
///   - 50, 280  : QR code (2×10 magnification)
pub fn render_zpl(badge: &BadgePayload) -> String {
    let mut zpl = String::new();
    zpl.push_str("^XA\n");
    zpl.push_str("^FX --- RoyalEntry badge ---\n");
    zpl.push_str(&format!("^FO50,50^A0N,44,40^FD{}^FS\n", sanitize(&badge.attendee_name)));
    zpl.push_str(&format!("^FO50,110^A0N,28,24^FD{}^FS\n", sanitize(&badge.tenant_name)));
    zpl.push_str(&format!("^FO50,160^A0N,24,20^FD{}^FS\n", sanitize(&badge.event_title)));

    if badge.table_number.is_some() || badge.seat_number.is_some() {
        let mut seat = String::new();
        if let Some(t) = &badge.table_number { seat.push_str(&format!("Table {} ", t)); }
        if let Some(s) = &badge.seat_number { seat.push_str(&format!("Seat {}", s)); }
        zpl.push_str(&format!("^FO50,220^A0N,24,20^FD{}^FS\n", sanitize(&seat.trim())));
    }

    zpl.push_str(&format!("^FO50,280^BZN,2,10^FD{}^FS\n", sanitize(&badge.qr_payload)));
    zpl.push_str("^XZ\n");
    zpl
}

/// ZPL field delimiter — caret is a control char; replace with safe substitute.
fn sanitize(s: &str) -> String {
    s.replace('^', " ").replace('~', " ").replace('\n', " ")
}

#[allow(dead_code)]
pub fn is_supported_printer_model(_model: &str) -> bool {
    // Phase 1: we treat all ZPL-capable thermal printers as supported.
    // Phase 2: expand to per-vendor ZPL variants (Zebra ZPL II, EPL, CPCL).
    true
}

#[allow(dead_code)]
pub fn badge_id() -> Uuid {
    Uuid::new_v4()
}
