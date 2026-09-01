use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub fn setup_tracing() {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("royalentry=debug,sqlx=info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            fmt::layer()
                .pretty()
                .with_thread_ids(true)
                .with_file(true)
                .with_line_number(true),
        )
        .init();
}
