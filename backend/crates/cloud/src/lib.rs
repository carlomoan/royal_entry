pub use royalentry_core::*;

pub mod config;
pub mod db;
pub mod error;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod repository;
pub mod routes;
pub mod services;
pub mod utils;

pub use error::{AppError, AppResult};

use config::Config;
use db::Database;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub db: Database,
}
