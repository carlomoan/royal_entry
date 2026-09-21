use tokio_cron_scheduler::{Job, JobScheduler};
use std::time::Duration;

pub async fn start_scheduler() -> Result<(), Box<dyn std::error::Error>> {
    let sched = JobScheduler::new();
    sched.add(Job::new_async("0 */5 * * * *", |_uuid, _l| {
        Box::pin(async {
            // Placeholder: poll queued broadcasts and trigger dispatcher
        })
    })?);
    sched.start();
    tokio::signal::ctrl_c().await?;
    sched.shutdown();
    Ok(())
}
