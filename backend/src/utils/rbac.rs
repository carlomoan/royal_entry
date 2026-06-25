use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::user::Claims,
};

pub fn role_key(role: &str) -> String {
    role.trim().to_ascii_lowercase()
}

pub fn is_platform_role(role: &str) -> bool {
    matches!(
        role_key(role).as_str(),
        "admin" | "superadmin" | "system_admin"
    )
}

pub fn is_account_admin_role(role: &str) -> bool {
    matches!(
        role_key(role).as_str(),
        "account_admin" | "organizer" | "admin" | "superadmin" | "system_admin"
    )
}

pub fn can_manage_users(role: &str) -> bool {
    matches!(
        role_key(role).as_str(),
        "account_admin" | "admin" | "superadmin" | "system_admin"
    )
}

pub fn require_platform_admin(claims: &Claims) -> AppResult<()> {
    if is_platform_role(&claims.role) {
        Ok(())
    } else {
        Err(AppError::AccessDenied(
            "Only system administrators can access this area".to_string(),
        ))
    }
}

pub fn require_account_admin(claims: &Claims) -> AppResult<()> {
    if is_account_admin_role(&claims.role) {
        Ok(())
    } else {
        Err(AppError::AccessDenied(
            "Only account administrators can perform this action".to_string(),
        ))
    }
}

pub fn require_user_manager(claims: &Claims) -> AppResult<()> {
    if can_manage_users(&claims.role) {
        Ok(())
    } else {
        Err(AppError::AccessDenied(
            "You do not have permission to manage roles or team members".to_string(),
        ))
    }
}

pub fn claims_org_id(claims: &Claims) -> AppResult<Uuid> {
    Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)
}

pub fn assert_same_organization(claims: &Claims, organization_id: Uuid) -> AppResult<()> {
    if is_platform_role(&claims.role) || claims_org_id(claims)? == organization_id {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

pub fn allowed_assignable_roles(claims: &Claims) -> &'static [&'static str] {
    if is_platform_role(&claims.role) {
        &[
            "system_admin",
            "superadmin",
            "account_admin",
            "organizer",
            "mc",
            "door_staff",
            "viewer",
        ]
    } else {
        &["account_admin", "organizer", "mc", "door_staff", "viewer"]
    }
}

pub fn ensure_role_assignable(claims: &Claims, role: &str) -> AppResult<String> {
    let normalized = role_key(role);
    if allowed_assignable_roles(claims)
        .iter()
        .any(|allowed| *allowed == normalized)
    {
        Ok(normalized)
    } else {
        Err(AppError::AccessDenied(format!(
            "You cannot assign the role '{}'",
            role
        )))
    }
}
