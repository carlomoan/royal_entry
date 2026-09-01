// ==============================================================================
// FILE: src/services/scheduler.rs
// ==============================================================================
// Background job scheduler using tokio-cron-scheduler
// ==============================================================================
use std::sync::Arc;
use tokio::signal;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{error, info};

use crate::{services::BillingService, AppState};

// ✅ FIX: Corrected invalid Arc syntax
pub async fn start_scheduler(state: Arc<AppState>) -> Result<(), Box<dyn std::error::Error>> {
    let billing = BillingService::new(state.clone());
    let mut sched = JobScheduler::new().await?;

    // Generate recurring invoices - daily at 00:05
    let billing_clone = billing.clone();
    let job = Job::new_async("0 5 0 * * *", move |_uuid, _l| {
        let billing = billing_clone.clone();
        Box::pin(async move {
            info!("Running recurring invoice generation");
            if let Err(e) = billing.generate_recurring_invoices().await {
                error!(error = %e, "Failed to generate recurring invoices");
            }
        })
    })?;
    sched.add(job).await?;

    // Process due invoices - every hour at minute 10
    let billing_clone = billing.clone();
    let job = Job::new_async("0 10 * * * *", move |_uuid, _l| {
        let billing = billing_clone.clone();
        Box::pin(async move {
            info!("Processing due invoices");
            if let Err(e) = billing.process_due_invoices().await {
                error!(error = %e, "Failed to process due invoices");
            }
        })
    })?;
    sched.add(job).await?;

    // Retry failed payments - every 6 hours at minute 20
    let billing_clone = billing.clone();
    let job = Job::new_async("0 20 */6 * * *", move |_uuid, _l| {
        let billing = billing_clone.clone();
        Box::pin(async move {
            info!("Retrying failed payments");
            if let Err(e) = billing.retry_failed_payments().await {
                error!(error = %e, "Failed to retry payments");
            }
        })
    })?;
    sched.add(job).await?;

    // Send dunning notices - daily at 09:00
    let billing_clone = billing.clone();
    let job = Job::new_async("0 0 9 * * *", move |_uuid, _l| {
        let billing = billing_clone.clone();
        Box::pin(async move {
            info!("Sending dunning notices");
            if let Err(e) = billing.send_dunning_notices().await {
                error!(error = %e, "Failed to send dunning notices");
            }
        })
    })?;
    sched.add(job).await?;

    // Convert trials - daily at 00:10
    let billing_clone = billing.clone();
    let job = Job::new_async("0 10 0 * * *", move |_uuid, _l| {
        let billing = billing_clone.clone();
        Box::pin(async move {
            info!("Converting trials");
            if let Err(e) = billing.convert_trials().await {
                error!(error = %e, "Failed to convert trials");
            }
        })
    })?;
    sched.add(job).await?;

    // Handle grace periods - daily at 00:15
    let billing_clone = billing.clone();
    let job = Job::new_async("0 15 0 * * *", move |_uuid, _l| {
        let billing = billing_clone.clone();
        Box::pin(async move {
            info!("Handling grace periods");
            if let Err(e) = billing.handle_grace_periods().await {
                error!(error = %e, "Failed to handle grace periods");
            }
        })
    })?;
    sched.add(job).await?;

    sched.start().await?;
    info!("Billing scheduler started with 6 jobs");

    // Wait for shutdown signal
    signal::ctrl_c().await?;
    info!("Shutdown signal received, stopping scheduler");
    sched.shutdown().await?;
    info!("Scheduler stopped");

    Ok(())
}
