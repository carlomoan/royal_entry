// ==============================================================================
// FILE: src/middleware/rbac.rs
// ==============================================================================
// Route-level RBAC middleware. Apply to route groups that need permission checks.
//
// Usage in routes.rs:
//   .route("/api/v1/events", get(event::list_events))
//       .layer(rbac_layer("events:read"))
//
// The middleware reads `Claims` from the request Extension (set by auth_middleware)
// and checks if the user's role has the required permission.

// src/middleware/rbac.rs
use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::{
    models::user::Claims,
    utils::rbac::can,
};
// ... rest of the file remains the same

/// Middleware factory — creates a middleware that enforces a specific permission.
pub fn require_permission_middleware(
    permission: &'static str,
) -> impl Fn(Request, Next) -> std::pin::Pin<Box<dyn std::future::Future<Output = Response> + Send>> + Clone
{
    move |req: Request, next: Next| {
        let perm = permission;
        Box::pin(async move {
            // Extract claims from Extension (set by auth_middleware earlier)
            let claims = match req.extensions().get::<Claims>() {
                Some(c) => c.clone(),
                None => {
                    tracing::error!("RBAC middleware: no Claims in request extensions");
                    return Response::builder()
                        .status(StatusCode::UNAUTHORIZED)
                        .body(axum::body::Body::from("Unauthorized"))
                        .unwrap();
                }
            };

            // Check permission
            if !can(&claims.role, perm) {
                tracing::warn!(
                    user_id = %claims.sub,
                    role = %claims.role,
                    permission = %perm,
                    path = %req.uri().path(),
                    "RBAC: permission denied"
                );
                return Response::builder()
                    .status(StatusCode::FORBIDDEN)
                    .body(axum::body::Body::from(
                        r#"{"success":false,"error":{"message":"You do not have permission to access this resource"}}"#,
                    ))
                    .unwrap();
            }

            next.run(req).await
        })
    }
}

/// Convenience: middleware for platform-admin-only routes
pub fn require_platform_admin_middleware(
    req: Request,
    next: Next,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Response> + Send>> {
    Box::pin(async move {
        let claims = match req.extensions().get::<Claims>() {
            Some(c) => c.clone(),
            None => {
                return Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .body(axum::body::Body::from("Unauthorized"))
                    .unwrap();
            }
        };

        if !crate::utils::rbac::is_platform_role(&claims.role) {
            return Response::builder()
                .status(StatusCode::FORBIDDEN)
                .body(axum::body::Body::from(
                    r#"{"success":false,"error":{"message":"Platform admin access required"}}"#,
                ))
                .unwrap();
        }

        next.run(req).await
    })
}

/// Convenience: middleware for account-admin-only routes
pub fn require_account_admin_middleware(
    req: Request,
    next: Next,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Response> + Send>> {
    Box::pin(async move {
        let claims = match req.extensions().get::<Claims>() {
            Some(c) => c.clone(),
            None => {
                return Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .body(axum::body::Body::from("Unauthorized"))
                    .unwrap();
            }
        };

        if !crate::utils::rbac::is_account_admin(&claims.role) {
            return Response::builder()
                .status(StatusCode::FORBIDDEN)
                .body(axum::body::Body::from(
                    r#"{"success":false,"error":{"message":"Account admin access required"}}"#,
                ))
                .unwrap();
        }

        next.run(req).await
    })
}
