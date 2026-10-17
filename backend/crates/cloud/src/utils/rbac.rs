// ==============================================================================
// FILE: src/utils/rbac.rs
// ==============================================================================
// Role-Based Access Control helpers — single source of truth for permissions.
// Mirrors the frontend `src/utils/roles.ts` ROLE_PERMISSIONS matrix.

use crate::{error::AppError, models::user::Claims};
use uuid::Uuid;

// ── Role categories ───────────────────────────────────────────────────────────
pub const PLATFORM_ROLES: &[&str] = &["superadmin", "platform_admin", "system_admin"];

pub const ACCOUNT_ROLES: &[&str] = &[
    "account_admin",
    "event_manager",
    "event_accountant",
    "secretary",
    "scanner_attendant",
    "viewer",
];

// ── Permission catalog ────────────────────────────────────────────────────────
// All available permissions across every object in the system.
pub const ALL_PERMISSIONS: &[&str] = &[
    "events:read",
    "events:write",
    "events:delete",
    "events:activate",
    "events:approve",
    "events:reject",
    "events:complete",
    "guests:read",
    "guests:write",
    "guests:delete",
    "guests:import",
    "guests:csv",
    "invitations:read",
    "invitations:write",
    "invitations:generate",
    "invitations:send",
    "scanner:read",
    "scanner:write",
    "scanner:otp",
    "michango:read",
    "michango:write",
    "michango:payment",
    "michango:remind",
    "broadcast:read",
    "broadcast:write",
    "broadcast:sms",
    "broadcast:whatsapp",
    "broadcast:email",
    "broadcast:telegram",
    "payments:read",
    "payments:write",
    "payments:receipt",
    "payments:invoice",
    "reports:read",
    "reports:export",
    "audit:read",
    "audit:export",
    "team:read",
    "team:write",
    "settings:read",
    "settings:write",
    "platform:read",
    "platform:write",
    "platform:manage_users",
    "platform:manage_plans",
    "platform:manage_templates",
    "platform:manage_global_variables",
    "webhooks:read",
    "webhooks:write",
    "cards:read",
    "cards:write",
    "cards:design",
    "cards:checkin",
    "otp:send",
    "otp:verify",
    "roles:read",
    "roles:write",
    "roles:assign",
    "invoices:read",
    "invoices:write",
];

pub const PLATFORM_ROLES_ALL: &[&str] = ALL_PERMISSIONS;

// ── Permission matrix ─────────────────────────────────────────────────────────
// Format: "resource:action" — e.g. "events:read", "guests:write"
// Wildcard "*" means "all actions on this resource"
//
// Resources: events, guests, invitations, scanner, michango, broadcast,
//            payments, reports, audit, team, settings, platform
//
// Platform roles (superadmin, platform_admin, system_admin) bypass all checks
// via is_platform_role() — they have implicit "*:*" on everything.
//
// Mirrors the frontend `src/utils/roles.ts` ROLE_PERMISSIONS matrix.
pub const ROLE_PERMISSIONS: &[(&str, &[&str])] = &[
    (
        "account_admin",
        &[
            "events:*",
            "guests:*",
            "invitations:*",
            "scanner:*",
            "michango:*",
            "broadcast:*",
            "payments:*",
            "reports:*",
            "audit:*",
            "team:*",
            "settings:*",
            "cards:*",
        ],
    ),
    (
        "event_manager",
        &[
            "events:read",
            "events:write",
            "guests:*",
            "invitations:*",
            "scanner:*",
            "broadcast:*",
            "cards:*",
        ],
    ),
    (
        "event_accountant",
        &["events:read", "michango:*", "payments:*"],
    ),
    (
        "secretary",
        &["events:read", "guests:*", "broadcast:read", "invitations:*"],
    ),
    ("scanner_attendant", &["events:read", "scanner:*"]),
    ("viewer", &["events:read", "reports:read"]),
];

// ── Helpers ───────────────────────────────────────────────────────────────────
pub fn is_platform_role(role: &str) -> bool {
    PLATFORM_ROLES.contains(&role)
}

pub fn is_account_admin(role: &str) -> bool {
    role == "account_admin" || is_platform_role(role)
}

pub fn can(role: &str, permission: &str) -> bool {
    if is_platform_role(role) {
        return true;
    }

    let allowed = ROLE_PERMISSIONS
        .iter()
        .find(|(r, _)| *r == role)
        .map(|(_, perms)| *perms)
        .unwrap_or(&[]);

    let (resource, _action) = permission.split_once(':').unwrap_or((permission, ""));

    allowed
        .iter()
        .any(|p| *p == permission || *p == &format!("{}:*", resource))
}

// ── Guard functions (used inside handlers) ────────────────────────────────────
pub fn require_platform_admin(claims: &Claims) -> Result<(), AppError> {
    if is_platform_role(&claims.role) {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

pub fn require_account_admin(claims: &Claims) -> Result<(), AppError> {
    if is_account_admin(&claims.role) {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

pub fn require_user_manager(claims: &Claims) -> Result<(), AppError> {
    // Only account admins and platform admins can manage users
    require_account_admin(claims)
}

pub fn require_permission(claims: &Claims, permission: &str) -> Result<(), AppError> {
    if can(&claims.role, permission) {
        Ok(())
    } else {
        tracing::warn!(
            user_id = %claims.sub,
            role = %claims.role,
            permission = %permission,
            "Permission denied"
        );
        Err(AppError::Forbidden)
    }
}

// ── Organization scoping ──────────────────────────────────────────────────────
pub fn claims_org_id(claims: &Claims) -> Result<Uuid, AppError> {
    Uuid::parse_str(&claims.org_id).map_err(|_| AppError::InvalidToken)
}

pub fn assert_same_organization(claims: &Claims, target_org: Uuid) -> Result<(), AppError> {
    let org_id = claims_org_id(claims)?;
    if org_id == target_org {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

// ── Role assignment validation ────────────────────────────────────────────────
pub fn ensure_role_assignable(claims: &Claims, target_role: &str) -> Result<String, AppError> {
    // Platform admins can assign any role
    if is_platform_role(&claims.role) {
        return Ok(target_role.to_string());
    }

    // Account admins can assign any account role (but not platform roles)
    if is_account_admin(&claims.role) {
        if ACCOUNT_ROLES.contains(&target_role) {
            return Ok(target_role.to_string());
        }
        return Err(AppError::Forbidden);
    }

    Err(AppError::Forbidden)
}
