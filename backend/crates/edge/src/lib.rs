//! Edge runtime — embedded Axum micro-server + local SQLite cache + offline queue.
//!
//! Triggered only when the offline scanner / Desktop Hub milestone starts.
//! (See AGENTS.md migration notes.)
//!
//! Current status (Phase 1):
//!  - SQLite cache (tenant-keyed via `tenant_id` column on every row)
//!  - Offline queue (`queued_operations` table) with retry/error tracking
//!  - Embedded Axum server exposing `/health`, `/scan`, `/pledge`,
//!    `/pending`, `/sync`, `/wipe`
//!  - Storage primitives for local-scan cache + tenant metadata wipe

pub mod models;
pub mod print;
pub mod server;
pub mod storage;

pub use models::{LocalScan, QueuedOperation};
pub use print::zpl::{render_zpl, BadgePayload};
pub use server::{router, spawn, EdgeState, Shared};
pub use storage::DbPool;
