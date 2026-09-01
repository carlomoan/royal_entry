use std::sync::Arc;

use axum::{
    extract::{Request, State},
    http::header::{AUTHORIZATION, USER_AGENT},
    middleware::Next,
    response::Response,
};
use serde_json::json;
use uuid::Uuid;

use crate::{models::user::Claims, services::AuthService, AppState};

fn action_from_method_path(method: &str, path: &str) -> String {
    let clean_path = path.trim_matches('/').replace('/', ".");
    match method {
        "POST" => format!("create.{clean_path}"),
        "PUT" | "PATCH" => format!("update.{clean_path}"),
        "DELETE" => format!("delete.{clean_path}"),
        _ => format!("view.{clean_path}"),
    }
}

fn resource_from_path(path: &str) -> (Option<String>, Option<String>) {
    let segments: Vec<&str> = path.trim_matches('/').split('/').collect();
    for pair in segments.windows(2).rev() {
        if pair[1].len() >= 8 {
            return (Some(pair[0].to_string()), Some(pair[1].to_string()));
        }
    }
    (segments.last().map(|s| s.to_string()), None)
}

fn extract_claims(req: &Request) -> Option<Claims> {
    if let Some(claims) = req.extensions().get::<Claims>().cloned() {
        return Some(claims);
    }

    let token = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))?;

    AuthService::verify_token(token)
        .ok()
        .filter(|claims| claims.token_type == "access")
}

fn skip_audit(path: &str) -> bool {
    path == "/health"
}

pub async fn audit_middleware(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Response {
    let method = req.method().to_string();
    let path = req.uri().path().to_string();
    if skip_audit(&path) {
        return next.run(req).await;
    }

    let query = req.uri().query().map(str::to_string);
    let user_agent = req
        .headers()
        .get(USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let forwarded_for = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let claims = extract_claims(&req);

    let response = next.run(req).await;
    let status_code = response.status().as_u16() as i32;
    let (resource_type, resource_id) = resource_from_path(&path);
    let action = action_from_method_path(&method, &path);

    let user_id = claims
        .as_ref()
        .and_then(|claims| Uuid::parse_str(&claims.sub).ok());
    let organization_id = claims
        .as_ref()
        .and_then(|claims| Uuid::parse_str(&claims.org_id).ok());
    let user_email = claims.as_ref().map(|claims| claims.email.clone());
    let role = claims.as_ref().map(|claims| claims.role.clone());

    if let Err(error) = sqlx::query(
        r#"
        INSERT INTO audit_logs (
            id,
            occurred_at,
            user_id,
            organization_id,
            user_email,
            role,
            method,
            path,
            action,
            status_code,
            ip_address,
            user_agent,
            request_query,
            target_resource_type,
            target_resource_id,
            details
        )
        VALUES (
            $1,
            NOW(),
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15
        )
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(organization_id)
    .bind(user_email)
    .bind(role)
    .bind(&method)
    .bind(&path)
    .bind(action)
    .bind(status_code)
    .bind(forwarded_for)
    .bind(user_agent)
    .bind(query)
    .bind(resource_type)
    .bind(resource_id)
    .bind(json!({ "status_family": status_code / 100 }))
    .execute(state.db.pool())
    .await
    {
        tracing::warn!(error = %error, path = %path, method = %method, "Failed to write audit log");
    }

    response
}
