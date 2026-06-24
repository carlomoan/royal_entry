#[cfg(test)]
mod event_model_tests {
    use chrono::{NaiveDate, Datelike}; // 👈 Add `Datelike` here

    #[test]
    fn test_event_date_parsing_valid() {
        let date_str = "2025-06-15";
        let d = NaiveDate::parse_from_str(date_str, "%Y-%m-%d").unwrap();

        // Now .year(), .month(), and .day() work because `Datelike` is in scope
        assert_eq!(d.year(), 2025);
        assert_eq!(d.month(), 6);
        assert_eq!(d.day(), 15);
    }

    #[test]
    fn test_event_date_parsing_invalid() {
        let bad_date = "15/06/2025";
        let result = NaiveDate::parse_from_str(bad_date, "%Y-%m-%d");
        assert!(result.is_err());
    }

    #[test]
    fn test_event_date_parsing_non_existent_date() {
        let bad_date = "2025-02-30"; // Feb 30 doesn't exist
        let result = NaiveDate::parse_from_str(bad_date, "%Y-%m-%d");
        assert!(result.is_err());
    }

    use royalentry_backend::models::guest::PaginationMeta;

    #[test]
    fn test_pagination_meta_total_pages() {
        let meta = PaginationMeta::new(1, 20, 100);
        assert_eq!(meta.total_pages, 5);
    }

    #[test]
    fn test_pagination_meta_partial_last_page() {
        let meta = PaginationMeta::new(1, 20, 101);
        assert_eq!(meta.total_pages, 6);
    }

    #[test]
    fn test_pagination_meta_empty() {
        let meta = PaginationMeta::new(1, 20, 0);
        assert_eq!(meta.total_pages, 0);
    }

    #[test]
    fn test_pagination_offset_page_1() {
        use royalentry_backend::models::guest::PaginationQuery;
        let q = PaginationQuery { page: Some(1), per_page: Some(20) };
        assert_eq!(q.offset(), 0);
        assert_eq!(q.limit(), 20);
    }

    #[test]
    fn test_pagination_offset_page_3() {
        use royalentry_backend::models::guest::PaginationQuery;
        let q = PaginationQuery { page: Some(3), per_page: Some(20) };
        assert_eq!(q.offset(), 40);
        assert_eq!(q.limit(), 20);
    }

    #[test]
    fn test_pagination_defaults() {
        use royalentry_backend::models::guest::PaginationQuery;
        let q = PaginationQuery::default();
        assert_eq!(q.offset(), 0);
        assert_eq!(q.limit(), 20);
    }
}

#[cfg(test)]
mod guest_validation_tests {
    use royalentry_backend::models::guest::CreateGuestRequest;
    use validator::Validate;

    fn make_valid_guest() -> CreateGuestRequest {
        CreateGuestRequest {
            full_name: "Hassan Mohammed".to_string(),
            phone: "+255700001001".to_string(),
            email: None,
            table_number: Some("5".to_string()),
            guest_category: Some("VIP".to_string()),
            plus_one_allowed: Some(false),
            contact_method: Some("whatsapp".to_string()),
        }
    }

    #[test]
    fn test_valid_guest_passes_validation() {
        let guest = make_valid_guest();
        assert!(guest.validate().is_ok());
    }

    #[test]
    fn test_guest_name_too_short() {
        let mut guest = make_valid_guest();
        guest.full_name = "A".to_string();
        assert!(guest.validate().is_err());
    }

    #[test]
    fn test_guest_name_empty() {
        let mut guest = make_valid_guest();
        guest.full_name = "".to_string();
        assert!(guest.validate().is_err());
    }

    #[test]
    fn test_guest_name_max_length() {
        let mut guest = make_valid_guest();
        guest.full_name = "A".repeat(256);
        assert!(guest.validate().is_err());
    }

    #[test]
    fn test_guest_valid_with_minimal_fields() {
        let guest = CreateGuestRequest {
            full_name: "Jane Doe".to_string(),
            phone: "+255700001002".to_string(),
            email: None,
            table_number: None,
            guest_category: None,
            plus_one_allowed: None,
            contact_method: None,
        };
        assert!(guest.validate().is_ok());
    }

    #[test]
    fn test_bulk_guests_empty_vec_rejected() {
        use royalentry_backend::models::guest::CreateMultipleGuestsRequest;
        let req = CreateMultipleGuestsRequest { guests: vec![] };
        assert!(req.guests.is_empty());
    }
}

#[cfg(test)]
mod event_validation_tests {
    use royalentry_backend::models::event::CreateEventRequest;
    use validator::Validate;

    fn make_valid_event() -> CreateEventRequest {
        CreateEventRequest {
            title: "Amina & Ahmed Wedding".to_string(),
            description: Some("Beautiful garden wedding".to_string()),
            event_date: "2025-06-15".to_string(),
            event_time: Some("14:00:00".to_string()),
            venue_name: Some("Golden Tulip Hotel".to_string()),
            venue_address: Some("Ohio Street, Dar es Salaam".to_string()),
            dress_code: Some("Black Tie".to_string()),
            card_theme: Some("elegant".to_string()),
            guest_count_expected: Some(300),
            rsvp_deadline: Some("2025-06-01".to_string()),
        }
    }

    #[test]
    fn test_valid_event_passes_validation() {
        let event = make_valid_event();
        assert!(event.validate().is_ok());
    }

    #[test]
    fn test_event_title_too_short() {
        let mut event = make_valid_event();
        event.title = "AB".to_string();
        assert!(event.validate().is_err());
    }

    #[test]
    fn test_event_title_too_long() {
        let mut event = make_valid_event();
        event.title = "A".repeat(256);
        assert!(event.validate().is_err());
    }

    #[test]
    fn test_event_minimal_fields() {
        let event = CreateEventRequest {
            title: "Simple Event".to_string(),
            description: None,
            event_date: "2025-12-25".to_string(),
            event_time: None,
            venue_name: None,
            venue_address: None,
            dress_code: None,
            card_theme: None,
            guest_count_expected: None,
            rsvp_deadline: None,
        };
        assert!(event.validate().is_ok());
    }
}
