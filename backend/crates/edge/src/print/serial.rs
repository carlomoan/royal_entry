//! Silent badge printing via the `serialport` crate.
//!
//! Only compiled when the `serial` cargo feature is enabled (requires
//! libudev on Linux). The ZPL string generation in `super::zpl` always works.

#[cfg(feature = "serial")]
use serde::{Deserialize, Serialize};

/// Result of a print attempt.
#[cfg(feature = "serial")]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrintResult {
    pub port: String,
    pub bytes_written: usize,
    pub success: bool,
    pub error: Option<String>,
}

/// List all serial ports visible to the OS.
#[cfg(feature = "serial")]
pub fn list_ports() -> Vec<String> {
    serialport::available_ports()
        .map(|ports| ports.into_iter().map(|p| p.port_name).collect())
        .unwrap_or_default()
}

/// Send a ZPL string to a named serial port (e.g. `/dev/ttyUSB0` or `COM3`).
#[cfg(feature = "serial")]
pub fn print_zpl(port_name: &str, zpl: &str) -> PrintResult {
    let result = (|| -> Result<usize, String> {
        let mut port = serialport::new(port_name, 9600)
            .map_err(|e| format!("open port: {e}"))?;
        port.set_data_bits(serialport::DataBits::Eight)
            .map_err(|e| format!("data bits: {e}"))?;
        port.set_stop_bits(serialport::StopBits::One)
            .map_err(|e| format!("stop bits: {e}"))?;
        port.set_parity(serialport::Parity::None)
            .map_err(|e| format!("parity: {e}"))?;
        let bytes = zpl.as_bytes();
        port.write_all(bytes).map_err(|e| format!("write: {e}"))?;
        port.flush().map_err(|e| format!("flush: {e}"))?;
        Ok(bytes.len())
    })();

    match result {
        Ok(n) => PrintResult { port: port_name.to_string(), bytes_written: n, success: true, error: None },
        Err(e) => PrintResult { port: port_name.to_string(), bytes_written: 0, success: false, error: Some(e) },
    }
}

/// Auto-detect and print to the first available thermal printer.
#[cfg(feature = "serial")]
pub fn auto_print(zpl: &str) -> PrintResult {
    for port in list_ports() {
        if let Some(info) = serialport::available_ports().ok().and_then(|p| {
            p.into_iter().find(|x| x.port_name == port)
        }) {
            if is_supported_printer_model(&info.port_name) {
                return print_zpl(&port, zpl);
            }
        }
    }
    if let Some(first) = list_ports().first() {
        return print_zpl(first, zpl);
    }
    PrintResult {
        port: "".to_string(),
        bytes_written: 0,
        success: false,
        error: Some("No serial ports found".to_string()),
    }
}

/// Stub for vendor matching — Phase 1: pass-through.
#[cfg(feature = "serial")]
pub fn is_supported_printer_model(_port: &str) -> bool {
    true
}
