use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::CorsLayer,
    trace::{DefaultMakeSpan, DefaultOnResponse, TraceLayer},
};
use tracing::Level;

use royalentry_backend::{
    config::Config,
    db::Database,
    routes,
    services::BootstrapService,
    utils,
    AppState,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Use dotenvy instead of dotenv
    dotenvy::dotenv().ok();

    utils::logging::setup_tracing();
    tracing::info!("Starting RoyalEntry Backend");

    let config = Config::from_env();
    tracing::info!(
        "Configuration loaded: {} in {} mode",
        config.app.name,
        config.app.environment
    );

    tracing::info!("Connecting to PostgreSQL database...");
    let db = Database::new(&config.database).await?;
    db.run_migrations().await?;
    BootstrapService::bootstrap_auth(db.pool()).await?;
    tracing::info!("Database connected, migrations applied, and auth bootstrap completed");

    let app_state = Arc::new(AppState {
        config: config.clone(),
        db,
    });

    let cors = CorsLayer::permissive();
    let trace_layer = TraceLayer::new_for_http()
        .make_span_with(DefaultMakeSpan::new().level(Level::INFO))
        .on_response(DefaultOnResponse::new().level(Level::INFO));

    let middleware = ServiceBuilder::new()
        .layer(CompressionLayer::new())
        .layer(trace_layer)
        .layer(cors);

    let app = routes::create_router(app_state).layer(middleware);

    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("Server listening on http://{}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}
