// ==============================================================================
// FILE: src/handlers/mod.rs
// ==============================================================================
// NOTE: only `pub mod` declarations. The previous `pub use xxx::*;` globs were
// removed because they cause ambiguous re-export errors (e.g. Payment clash).
// ==============================================================================
// FILE: src/handlers/mod.rs
// ==============================================================================
pub mod audit;
pub mod auth;
pub mod billing;
pub mod broadcast;
pub mod card_templates;
pub mod event;
pub mod event_assignment;
pub mod guest;
pub mod invitations;
pub mod michango;
pub mod notifications; // ✅ ADD THIS
pub mod payment;
pub mod platform;
pub mod public_invitation;
pub mod rbac;
pub mod reports;
pub mod scanner;
pub mod settings;
pub mod webhooks;      // ✅ ADD THIS   // uncomment only if handlers/templates.rs exists

pub use audit::*;
pub use auth::*;
pub use broadcast::*;
pub use card_templates::*;
pub use event::*;
pub use guest::*;
pub use invitations::*;
pub use michango::*;
pub use payment::*;
pub use platform::*;
pub use public_invitation::*;
pub use rbac::*;
pub use reports::*;
pub use scanner::*;
pub use settings::*;
