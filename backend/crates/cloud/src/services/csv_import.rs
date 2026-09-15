// ==============================================================================
// FILE: src/services/csv_import.rs
// ==============================================================================
// Server-side CSV parsing and validation for guest bulk imports
// ==============================================================================
use csv::ReaderBuilder;
use serde::{Deserialize, Serialize};
use crate::{
    error::{AppError, AppResult},
    models::guest::CreateGuestRequest,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvImportResult {
    pub total_rows: usize,
    pub successful: usize,
    pub failed: usize,
    pub guests: Vec<CreateGuestRequest>,
    pub errors: Vec<CsvRowError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvRowError {
    pub row_number: usize,
    pub field: Option<String>,
    pub message: String,
    pub raw_data: Option<String>,
}

pub struct CsvImportService;

impl CsvImportService {
    /// Parse CSV bytes and validate each row
    pub fn parse_guests_csv(csv_data: &[u8]) -> AppResult<CsvImportResult> {
        let mut rdr = ReaderBuilder::new()
            .has_headers(true)
            .flexible(true)
            .trim(csv::Trim::All)
            .from_reader(csv_data);

        // Validate headers
        let headers = rdr.headers().map_err(|e| {
            AppError::BadRequest(format!("Failed to read CSV headers: {}", e))
        })?;

        let required_headers = ["full_name", "phone"];
        let header_names: Vec<String> = headers.iter().map(|h| h.trim().to_lowercase()).collect();

        for required in &required_headers {
            if !header_names.iter().any(|h| h == required) {
                return Err(AppError::BadRequest(format!(
                    "Missing required column '{}'. Found columns: {:?}",
                    required, header_names
                )));
            }
        }

        let name_idx = header_names.iter().position(|h| h == "full_name").unwrap();
        let phone_idx = header_names.iter().position(|h| h == "phone").unwrap();
        let email_idx = header_names.iter().position(|h| h == "email");
        let whatsapp_idx = header_names.iter().position(|h| h == "whatsapp_phone" || h == "whatsapp");
        let device_idx = header_names.iter().position(|h| h == "device_type" || h == "device");
        let table_idx = header_names.iter().position(|h| h == "table_number");
        let category_idx = header_names.iter().position(|h| h == "guest_category" || h == "category");
        let plus_one_idx = header_names.iter().position(|h| h == "plus_one_allowed" || h == "plus_one");
        let contact_idx = header_names.iter().position(|h| h == "contact_method" || h == "contact");

        let mut guests = Vec::new();
        let mut errors = Vec::new();
        let mut row_number = 1; // 1 = first data row (after header)

        for result in rdr.records() {
            row_number += 0; // we'll increment below
            let record = match result {
                Ok(r) => r,
                Err(e) => {
                    errors.push(CsvRowError {
                        row_number,
                        field: None,
                        message: format!("CSV parse error: {}", e),
                        raw_data: None,
                    });
                    row_number += 1;
                    continue;
                }
            };

            let raw_line = record.iter().collect::<Vec<_>>().join(",");

            // Extract required fields
            let full_name = match record.get(name_idx) {
                Some(v) => v.trim().to_string(),
                None => {
                    errors.push(CsvRowError {
                        row_number,
                        field: Some("full_name".to_string()),
                        message: "Missing full_name".to_string(),
                        raw_data: Some(raw_line.clone()),
                    });
                    row_number += 1;
                    continue;
                }
            };

            let phone = match record.get(phone_idx) {
                Some(v) => v.trim().to_string(),
                None => {
                    errors.push(CsvRowError {
                        row_number,
                        field: Some("phone".to_string()),
                        message: "Missing phone".to_string(),
                        raw_data: Some(raw_line.clone()),
                    });
                    row_number += 1;
                    continue;
                }
            };

            // Validate full_name
            if full_name.len() < 2 || full_name.len() > 255 {
                errors.push(CsvRowError {
                    row_number,
                    field: Some("full_name".to_string()),
                    message: "Name must be between 2 and 255 characters".to_string(),
                    raw_data: Some(raw_line.clone()),
                });
                row_number += 1;
                continue;
            }

            // Validate phone (10-15 digits)
            let phone_digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
            if phone_digits.len() < 10 || phone_digits.len() > 15 {
                errors.push(CsvRowError {
                    row_number,
                    field: Some("phone".to_string()),
                    message: format!("Invalid phone number '{}' (must be 10-15 digits)", phone),
                    raw_data: Some(raw_line.clone()),
                });
                row_number += 1;
                continue;
            }

            // Extract optional fields
            let email = email_idx.and_then(|i| record.get(i)).map(|v| v.trim().to_string()).filter(|s| !s.is_empty());
            let whatsapp_phone = whatsapp_idx.and_then(|i| record.get(i)).map(|v| v.trim().to_string()).filter(|s| !s.is_empty());
            let device_type = device_idx.and_then(|i| record.get(i)).map(|v| v.trim().to_lowercase()).filter(|s| !s.is_empty());
            let table_number = table_idx.and_then(|i| record.get(i)).map(|v| v.trim().to_string()).filter(|s| !s.is_empty());
            let guest_category = category_idx.and_then(|i| record.get(i)).map(|v| v.trim().to_string()).filter(|s| !s.is_empty());
            let contact_method = contact_idx.and_then(|i| record.get(i)).map(|v| v.trim().to_string()).filter(|s| !s.is_empty());

            // Validate email if provided
            if let Some(ref e) = email {
                if !e.contains('@') || !e.contains('.') {
                    errors.push(CsvRowError {
                        row_number,
                        field: Some("email".to_string()),
                        message: format!("Invalid email format: {}", e),
                        raw_data: Some(raw_line.clone()),
                    });
                    row_number += 1;
                    continue;
                }
            }

            // Validate category if provided
            let valid_categories = ["VVIP", "VIP", "Normal", "Premium", "Staff", "Family", "Friend", "Service Provider", "Special Guest", "Regular"];
            if let Some(ref cat) = guest_category {
                if !valid_categories.iter().any(|c| c.eq_ignore_ascii_case(cat)) {
                    errors.push(CsvRowError {
                        row_number,
                        field: Some("guest_category".to_string()),
                        message: format!("Invalid category '{}'. Must be one of: {:?}", cat, valid_categories),
                        raw_data: Some(raw_line.clone()),
                    });
                    row_number += 1;
                    continue;
                }
            }

            // Validate device type if provided
            if let Some(ref dt) = device_type {
                if dt != "smartphone" && dt != "feature_phone" {
                    errors.push(CsvRowError {
                        row_number,
                        field: Some("device_type".to_string()),
                        message: format!("Invalid device_type '{}'. Must be 'smartphone' or 'feature_phone'", dt),
                        raw_data: Some(raw_line.clone()),
                    });
                    row_number += 1;
                    continue;
                }
            }

            // Validate contact method if provided
            let valid_contacts = ["whatsapp", "sms", "email", "telegram"];
            if let Some(ref cm) = contact_method {
                if !valid_contacts.iter().any(|c| c.eq_ignore_ascii_case(cm)) {
                    errors.push(CsvRowError {
                        row_number,
                        field: Some("contact_method".to_string()),
                        message: format!("Invalid contact method '{}'. Must be one of: {:?}", cm, valid_contacts),
                        raw_data: Some(raw_line.clone()),
                    });
                    row_number += 1;
                    continue;
                }
            }

            // Parse plus_one
            let plus_one_allowed = plus_one_idx.and_then(|i| record.get(i)).and_then(|v| {
                let v = v.trim().to_lowercase();
                match v.as_str() {
                    "true" | "yes" | "1" | "y" => Some(true),
                    "false" | "no" | "0" | "n" | "" => Some(false),
                    _ => None,
                }
            });

            // Normalize category to title case
            let normalized_category = guest_category.map(|c| {
                let lower = c.to_lowercase();
                match lower.as_str() {
                    "vip" => "VIP".to_string(),
                    "vvip" => "VVIP".to_string(),
                    "regular" => "Regular".to_string(),
                    "staff" => "Staff".to_string(),
                    "family" => "Family".to_string(),
                    "friend" => "Friend".to_string(),
                    "service provider" => "Service Provider".to_string(),
                    "special guest" => "Special Guest".to_string(),
                    _ => c,
                }
            });

            // Normalize contact method to lowercase
            let normalized_contact = contact_method.map(|c| c.to_lowercase());

            guests.push(CreateGuestRequest {
                full_name,
                phone: phone_digits,
                email,
                whatsapp_phone,
                device_type,
                table_number,
                guest_category: normalized_category,
                plus_one_allowed,
                contact_method: normalized_contact,
            });

            row_number += 1;
        }

        let total_rows = guests.len() + errors.len();
        let successful = guests.len();
        let failed = errors.len();

        Ok(CsvImportResult {
            total_rows,
            successful,
            failed,
            guests,
            errors,
        })
    }

    /// Generate a sample CSV template
    pub fn generate_template() -> Vec<u8> {
        let mut wtr = csv::Writer::from_writer(Vec::new());

        // Write headers
        wtr.write_record(&[
            "full_name",
            "phone",
            "email",
            "table_number",
            "guest_category",
            "plus_one_allowed",
            "contact_method",
        ]).unwrap();

        // Write example rows
        wtr.write_record(&[
            "Hassan Mohammed",
            "+255700001001",
            "hassan@example.com",
            "5",
            "VIP",
            "yes",
            "whatsapp",
        ]).unwrap();

        wtr.write_record(&[
            "Amina Juma",
            "+255712345678",
            "",
            "3",
            "Family",
            "no",
            "sms",
        ]).unwrap();

        wtr.write_record(&[
            "John Smith",
            "255787654321",
            "john@example.com",
            "7",
            "Friend",
            "yes",
            "whatsapp",
        ]).unwrap();

        wtr.flush().unwrap();
        wtr.into_inner().unwrap()
    }
}
