// ==============================================================================
// FILE: src/services/tabular_import.rs
// ==============================================================================
// Read CSV or XLSX/XLS/ODS uploads into a common row matrix so the same import
// logic works for both formats.
// ==============================================================================
use std::io::Cursor;
use crate::error::{AppError, AppResult};

/// Returns rows including the header row. Cells are trimmed strings.
pub fn read_table(bytes: &[u8], file_name: &str) -> AppResult<Vec<Vec<String>>> {
    let lower = file_name.to_ascii_lowercase();
    if lower.ends_with(".csv") || lower.ends_with(".txt") || !lower.contains(".xls") && !lower.ends_with(".ods") {
        return read_csv(bytes);
    }
    read_spreadsheet(bytes)
}

fn read_csv(bytes: &[u8]) -> AppResult<Vec<Vec<String>>> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(bytes);
    let mut rows = Vec::new();
    for result in rdr.records() {
        let record = result.map_err(|e| AppError::BadRequest(format!("CSV parse error: {}", e)))?;
        rows.push(record.iter().map(|v| v.trim().to_string()).collect());
    }
    Ok(rows)
}

fn read_spreadsheet(bytes: &[u8]) -> AppResult<Vec<Vec<String>>> {
    use calamine::{open_workbook_auto_from_rs, Data, Reader};
    let mut workbook = open_workbook_auto_from_rs(Cursor::new(bytes.to_vec()))
        .map_err(|e| AppError::BadRequest(format!("Could not open spreadsheet: {}", e)))?;
    let names = workbook.sheet_names();
    let first = names.first().ok_or_else(|| AppError::BadRequest("Spreadsheet has no sheets".to_string()))?;
    let range = workbook
        .worksheet_range(first)
        .map_err(|e| AppError::BadRequest(format!("Could not read sheet '{}': {}", first, e)))?;
    let cell = |v: &Data| -> String {
        match v {
            Data::String(s) => s.trim().to_string(),
            Data::Float(f) => {
                if f.fract() == 0.0 { format!("{}", *f as i64) } else { format!("{}", f) }
            }
            Data::Int(i) => i.to_string(),
            Data::Bool(b) => b.to_string(),
            Data::Empty => String::new(),
            Data::DateTime(dt) => dt.to_string(),
            Data::DateTimeIso(s) => s.clone(),
            Data::DurationIso(s) => s.clone(),
            Data::Error(e) => format!("{:?}", e),
        }
    };
    Ok(range.rows().map(|row| row.iter().map(cell).collect()).collect())
}
