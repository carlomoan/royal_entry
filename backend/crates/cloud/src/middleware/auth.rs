use axum::{
    extract::Request,
    http::header::AUTHORIZATION,
    middleware::Next,
    response::Response,
};

use crate::{
    error::AppError,
    services::AuthService,
};

/// JWT Authentication Middleware (Axum 0.8 compatible)
pub async fn auth_middleware(
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing authorization header".to_string()))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("Invalid authorization header format".to_string()))?;

    let claims = AuthService::verify_token(token)?;
    AuthService::verify_token_type(&claims, "access")?;

    req.extensions_mut().insert(claims);

    Ok(next.run(req).await)
}
