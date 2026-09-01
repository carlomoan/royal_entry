//! Silent badge & receipt printing.
//!
//! Phase 1: ZPL string generation (see `zpl`).
//! Phase 2: integrate with `serialport` (Windows / Linux) and `cups` (Linux / macOS)
//!   to pipe the raw bytes directly to the hardware spooler / serial port.

pub mod serial;
pub mod zpl;
