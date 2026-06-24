use axum::{
    extract::Request,
    http::{header::AUTHORIZATION},
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::user::Claims; // Adjust path if your Claims struct is elsewhere

/// JWT Authentication Middleware (Axum 0.8 compatible)
pub async fn auth_middleware(
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    // 1. Extract the Authorization header directly from the request
    let auth_header = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing authorization header".to_string()))?;

    // 2. Ensure it starts with "Bearer " and extract the token
    let _token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("Invalid authorization header format".to_string()))?;

    // TODO: Verify the JWT token here using your AuthService
    // let claims = AuthService::verify_token(token)?;

    // 3. For now, inject a dummy Claims struct so the server can compile and run
    // (Make sure these fields exactly match your actual `Claims` struct definition)
    let dummy_claims = Claims {
        sub: Uuid::nil().to_string(),
        org_id: Uuid::nil().to_string(),
        email: "dummy@test.com".to_string(),
        role: "mc".to_string(),
        exp: 9999999999,
        iat: 0,
        token_type: "access".to_string(),
    };

    // 4. Insert claims into request extensions so handlers can read them
    req.extensions_mut().insert(dummy_claims);

    // 5. Call the next handler in the chain
    Ok(next.run(req).await)
}
