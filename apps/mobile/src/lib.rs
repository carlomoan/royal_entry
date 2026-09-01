//! Mobile scanner companion — high-mobility check-in station.
//!
//! Uses native camera engine (via Tauri plugin-barcode-scanner) and
//! pushes scan results to the desktop Edge Hub over local Wi-Fi mesh.

pub fn app_name() -> &'static str {
    "RoyalEntry Mobile Scanner"
}
