pub use royalentry_core::*;

pub mod cards;
pub mod channels;
pub mod config;
pub mod db;
pub mod error;
pub mod files;
pub mod handlers;
pub mod logs;
pub mod middleware;
pub mod models;
pub mod qr;
pub mod repository;
pub mod retry;
pub mod routes;
pub mod services;
pub mod templates;
pub mod utils;

pub use error::{AppError, AppResult};

use config::Config;
use db::Database;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub db: Database,
}
