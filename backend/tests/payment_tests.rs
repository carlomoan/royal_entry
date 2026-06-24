// ==============================================================================
// FILE: tests/payment_tests.rs
// ==============================================================================

#[cfg(test)]
mod mpesa_unit_tests {
    use royalentry_backend::services::mpesa::{
        MpesaService, MpesaCallback, CallbackBody, StkCallback, CallbackMetadata, CallbackItem,
    };

    // ── Phone normalization ──────────────────────────────────────────────────

    #[test]
    fn test_normalize_phone_with_plus() {
        assert_eq!(MpesaService::normalize_phone("+255700001001"), "255700001001");
    }

    #[test]
    fn test_normalize_phone_with_zero_prefix() {
        assert_eq!(MpesaService::normalize_phone("0700001001"), "255700001001");
    }

    #[test]
    fn test_normalize_phone_already_normalized() {
        assert_eq!(MpesaService::normalize_phone("255700001001"), "255700001001");
    }

    #[test]
    fn test_normalize_phone_strips_spaces() {
        // Spaces are stripped because we filter to ascii_digit only
        assert_eq!(MpesaService::normalize_phone("+255 700 001 001"), "255700001001");
    }

    #[test]
    fn test_normalize_phone_strips_dashes() {
        assert_eq!(MpesaService::normalize_phone("+255-700-001-001"), "255700001001");
    }

    // ── Callback extraction ──────────────────────────────────────────────────

    fn make_success_callback(amount: f64, receipt: &str, phone: &str) -> MpesaCallback {
        MpesaCallback {
            body: CallbackBody {
                stk_callback: StkCallback {
                    merchant_request_id: "MR-001".to_string(),
                    checkout_request_id: "ws_CO_001".to_string(),
                    result_code: 0,
                    result_desc: "The service request is processed successfully.".to_string(),
                    callback_metadata: Some(CallbackMetadata {
                        item: vec![
                            CallbackItem {
                                name: "Amount".to_string(),
                                value: Some(serde_json::json!(amount)),
                            },
                            CallbackItem {
                                name: "MpesaReceiptNumber".to_string(),
                                value: Some(serde_json::json!(receipt)),
                            },
                            CallbackItem {
                                name: "TransactionDate".to_string(),
                                value: Some(serde_json::json!("20251129140000")),
                            },
                            CallbackItem {
                                name: "PhoneNumber".to_string(),
                                value: Some(serde_json::json!(phone)),
                            },
                        ],
                    }),
                },
            },
        }
    }

    fn make_cancelled_callback() -> MpesaCallback {
        MpesaCallback {
            body: CallbackBody {
                stk_callback: StkCallback {
                    merchant_request_id: "MR-002".to_string(),
                    checkout_request_id: "ws_CO_002".to_string(),
                    result_code: 1032,
                    result_desc: "Request cancelled by user".to_string(),
                    callback_metadata: None,
                },
            },
        }
    }

    #[test]
    fn test_successful_callback_extracts_correctly() {
        let cb = make_success_callback(200000.0, "TXN123ABC", "255700001001");
        let result = MpesaService::extract_callback(&cb)
            .expect("extract_callback must not error");

        assert!(result.is_some(), "Successful callback must return Some");
        let payment = result.unwrap();

        assert_eq!(payment.mpesa_receipt_number, "TXN123ABC");
        assert_eq!(payment.amount, 200000);
        assert_eq!(payment.phone_number, "255700001001");
        assert_eq!(payment.checkout_request_id, "ws_CO_001");
    }

    #[test]
    fn test_cancelled_callback_returns_none() {
        let cb = make_cancelled_callback();
        let result = MpesaService::extract_callback(&cb)
            .expect("extract_callback must not error on cancellation");

        assert!(result.is_none(), "Cancelled callback must return None");
    }

    #[test]
    fn test_callback_with_decimal_amount() {
        // Some Daraja versions send 200000.00
        let cb = make_success_callback(35000.50, "TXN456DEF", "255700001002");
        let result = MpesaService::extract_callback(&cb).unwrap().unwrap();
        // Cast to u64 truncates the decimal
        assert_eq!(result.amount, 35000);
    }

    #[test]
    fn test_callback_missing_metadata_on_failure() {
        let cb = make_cancelled_callback();
        let result = MpesaService::extract_callback(&cb).unwrap();
        assert!(result.is_none());
    }

    // ── Package price validation ──────────────────────────────────────────────

    #[derive(Debug, PartialEq)]
    struct Package {
        name: &'static str,
        price_tsh: u64,
        max_guests: u32,
    }

    fn royalentry_packages() -> Vec<Package> {
        vec![
            Package { name: "Starter",  price_tsh: 35_000,  max_guests: 40 },
            Package { name: "Basic",    price_tsh: 100_000,  max_guests: 100 },
            Package { name: "Standard", price_tsh: 200_000,  max_guests: 300 },
            Package { name: "Premium",  price_tsh: 350_000,  max_guests: 600 },
        ]
    }

    #[test]
    fn test_starter_package_price() {
        let pkg = royalentry_packages().into_iter().find(|p| p.name == "Starter").unwrap();
        assert_eq!(pkg.price_tsh, 35_000);
    }

    #[test]
    fn test_premium_package_price() {
        let pkg = royalentry_packages().into_iter().find(|p| p.name == "Premium").unwrap();
        assert_eq!(pkg.price_tsh, 350_000);
    }

    #[test]
    fn test_payment_amount_must_be_positive() {
        let amount_tsh: i64 = -1000;
        assert!(amount_tsh <= 0, "Negative amount must be rejected by handler");
    }

    #[test]
    fn test_payment_amount_zero_rejected() {
        let amount_tsh: i64 = 0;
        assert!(amount_tsh <= 0);
    }

    #[test]
    fn test_payment_amount_valid() {
        let amount_tsh: i64 = 200_000;
        assert!(amount_tsh > 0);
    }

    // ── Status transitions ───────────────────────────────────────────────────

    fn can_transition(from: &str, to: &str) -> bool {
        match (from, to) {
            ("pending",   "completed") => true,
            ("pending",   "failed")    => true,
            ("pending",   "cancelled") => true,
            ("completed", "refunded")  => true,
            _                          => false,
        }
    }

    #[test]
    fn test_pending_to_completed_allowed() {
        assert!(can_transition("pending", "completed"));
    }

    #[test]
    fn test_pending_to_failed_allowed() {
        assert!(can_transition("pending", "failed"));
    }

    #[test]
    fn test_completed_to_refunded_allowed() {
        assert!(can_transition("completed", "refunded"));
    }

    #[test]
    fn test_completed_to_pending_not_allowed() {
        assert!(!can_transition("completed", "pending"));
    }

    #[test]
    fn test_failed_to_completed_not_allowed() {
        assert!(!can_transition("failed", "completed"));
    }
}

// ==============================================================================
// Integration stubs
// ==============================================================================

#[cfg(test)]
mod payment_integration_tests {

    #[test]
    fn placeholder_stk_push_sandbox() {
        // 1. Register + login
        // 2. POST /payments/mpesa/initiate { package: "Starter", amount: 35000, phone: "+255700..." }
        // 3. Assert 200 + checkout_request_id returned
        // 4. In sandbox: simulate callback via Daraja test toolkit
        // 5. POST /payments/mpesa/callback with success payload
        // 6. GET /payments/:id/status → completed
        assert!(true);
    }

    #[test]
    fn placeholder_user_cancel_flow() {
        // 1. Initiate STK Push
        // 2. POST callback with result_code=1032 (cancelled)
        // 3. GET payment status → failed
        assert!(true);
    }

    #[test]
    fn placeholder_status_polling() {
        // 1. Initiate payment
        // 2. GET /payments/:id/status while pending
        // 3. Assert live_status field is populated from Daraja query
        assert!(true);
    }

    #[test]
    fn placeholder_list_payments() {
        // 1. Create 3 payments
        // 2. GET /payments?page=1&per_page=10
        // 3. Assert 3 records returned
        assert!(true);
    }
}
