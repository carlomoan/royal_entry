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
    middleware::audit::audit_middleware,
    routes,
    services::{BillingService, BootstrapService},
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
        db: db.clone(),
    });

    let billing = BillingService::new(app_state.clone());
    let scheduler = tokio_cron_scheduler::JobScheduler::new().await.unwrap();

    // Generate invoices daily at midnight
    {
        let billing = billing.clone();
        scheduler
            .add(tokio_cron_scheduler::Job::new_async("0 0 0 * * *", move |_uuid, _l| {
                let billing = billing.clone();
                Box::pin(async move {
                    if let Err(e) = billing.generate_recurring_invoices().await {
                        tracing::error!(error = %e, "Failed to generate recurring invoices");
                    }
                    if let Err(e) = billing.convert_trials().await {
                        tracing::error!(error = %e, "Failed to convert trials");
                    }
                    if let Err(e) = billing.handle_grace_periods().await {
                        tracing::error!(error = %e, "Failed to handle grace periods");
                    }
                    if let Err(e) = billing.send_dunning_notices().await {
                        tracing::error!(error = %e, "Failed to send dunning notices");
                    }
                })
            })
            .unwrap())
            .await
            .unwrap();
    }

    // Process due invoices every hour
    {
        let billing = billing.clone();
        scheduler
            .add(tokio_cron_scheduler::Job::new_async("0 0 * * * *", move |_uuid, _l| {
                let billing = billing.clone();
                Box::pin(async move {
                    if let Err(e) = billing.process_due_invoices().await {
                        tracing::error!(error = %e, "Failed to process due invoices");
                    }
                })
            })
            .unwrap())
            .await
            .unwrap();
    }

    // Deliver webhooks every minute
    {
        let state = app_state.clone();
        scheduler
            .add(tokio_cron_scheduler::Job::new_async("0 * * * * *", move |_uuid, _l| {
                let state = state.clone();
                Box::pin(async move {
                    let svc = royalentry_backend::services::WebhookService::new(state);
                    if let Err(e) = svc.process_deliveries().await {
                        tracing::error!(error = %e, "Webhook delivery processing failed");
                    }
                })
            })?)
            .await?;
    }

    // Retry failed payments every 6 hours
    {
        let billing = billing.clone();
        scheduler
            .add(tokio_cron_scheduler::Job::new_async("0 0 */6 * * *", move |_uuid, _l| {
                let billing = billing.clone();
                Box::pin(async move {
                    if let Err(e) = billing.retry_failed_payments().await {
                        tracing::error!(error = %e, "Failed to retry failed payments");
                    }
                })
            })
            .unwrap())
            .await
            .unwrap();
    }

    scheduler.start().await.unwrap();
    tracing::info!("Billing scheduler started");

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

    let app = routes::create_router(app_state.clone())
        .layer(axum::middleware::from_fn_with_state(app_state.clone(), audit_middleware))
        .layer(middleware);

    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("Server listening on http://{}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}
