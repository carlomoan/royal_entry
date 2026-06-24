#[cfg(test)]
mod auth_tests {
    use royalentry_backend::services::auth::AuthService;
    use uuid::Uuid;

    // ========================================================================
    // Password Hashing Tests (Synchronous)
    // ========================================================================

    #[test]
    fn test_hash_password_creates_valid_hash() {
        let password = "secure_password_123";
        let hash = AuthService::hash_password(password).expect("Password hashing failed");

        assert!(!hash.is_empty());
        assert!(hash.contains("$argon2"));
    }

    #[test]
    fn test_hash_same_password_produces_different_hashes() {
        let password = "same_password_123";
        let hash1 = AuthService::hash_password(password).expect("Hashing failed");
        let hash2 = AuthService::hash_password(password).expect("Hashing failed");

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_verify_password_correct_password() {
        let password = "correct_password_123";
        let hash = AuthService::hash_password(password).expect("Hashing failed");
        let is_valid = AuthService::verify_password(password, &hash).expect("Verification failed");

        assert!(is_valid);
    }

    #[test]
    fn test_verify_password_incorrect_password() {
        let correct_password = "correct_password_123";
        let wrong_password = "wrong_password_456";
        let hash = AuthService::hash_password(correct_password).expect("Hashing failed");
        let is_valid = AuthService::verify_password(wrong_password, &hash).expect("Verification failed");

        assert!(!is_valid);
    }

    #[test]
    fn test_verify_password_empty_password() {
        let password = "password_123";
        let empty_password = "";
        let hash = AuthService::hash_password(password).expect("Hashing failed");
        let is_valid = AuthService::verify_password(empty_password, &hash).expect("Verification failed");

        assert!(!is_valid);
    }

    // ========================================================================
    // JWT Token Generation Tests
    // ========================================================================

    #[test]
    fn test_generate_access_token() {
        let user_id = Uuid::new_v4();
        let org_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let role = "mc".to_string();

        std::env::set_var("JWT_SECRET", "test_secret_key_at_least_32_characters_long!!!");
        std::env::set_var("JWT_EXPIRY_HOURS", "24");

        let token = AuthService::generate_access_token(user_id, org_id, email.clone(), role.clone());
        assert!(token.is_ok());

        let token_str = token.unwrap();
        assert!(!token_str.is_empty());
        let parts: Vec<&str> = token_str.split('.').collect();
        assert_eq!(parts.len(), 3);
    }

    #[test]
    fn test_generate_refresh_token() {
        let user_id = Uuid::new_v4();
        let org_id = Uuid::new_v4();
        let email = "test@example.com".to_string();

        std::env::set_var("JWT_SECRET", "test_secret_key_at_least_32_characters_long!!!");
        std::env::set_var("JWT_REFRESH_EXPIRY_DAYS", "30");

        let token = AuthService::generate_refresh_token(user_id, org_id, email);
        assert!(token.is_ok());

        let token_str = token.unwrap();
        assert!(!token_str.is_empty());
        let parts: Vec<&str> = token_str.split('.').collect();
        assert_eq!(parts.len(), 3);
    }

    #[test]
    fn test_verify_valid_token() {
        let user_id = Uuid::new_v4();
        let org_id = Uuid::new_v4();
        let email = "test@example.com".to_string();
        let role = "mc".to_string();

        std::env::set_var("JWT_SECRET", "test_secret_key_at_least_32_characters_long!!!");
        std::env::set_var("JWT_EXPIRY_HOURS", "24");

        let token = AuthService::generate_access_token(user_id, org_id, email.clone(), role.clone())
            .expect("Token generation failed");

        let claims = AuthService::verify_token(&token).unwrap();
        assert_eq!(claims.sub, user_id.to_string());
        assert_eq!(claims.org_id, org_id.to_string());
    }

    #[test]
    fn test_verify_invalid_token() {
        std::env::set_var("JWT_SECRET", "test_secret_key_at_least_32_characters_long!!!");
        let invalid_token = "invalid.token.here";
        let result = AuthService::verify_token(invalid_token);
        assert!(result.is_err());
    }

    #[test]
    fn test_hash_very_long_password() {
        let long_password = "a".repeat(1000);
        let hash = AuthService::hash_password(&long_password).expect("Hashing failed");
        assert!(!hash.is_empty());

        let is_valid = AuthService::verify_password(&long_password, &hash).expect("Verification failed");
        assert!(is_valid);
    }
}
