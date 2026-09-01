use std::path::Path;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{SqlitePool, Pool, Sqlite};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::models::{QueuedOperation, LocalScan};

pub type DbPool = Pool<Sqlite>;

/// Open (or create) the local SQLite cache file with the right pragmas.
/// File location per platform (handled by Tauri):
///   Windows: %APPDATA%\com.royalentry.desktop\edge.db
///   Linux:   ~/.config/royalentry/edge.db
///   macOS:   ~/Library/Application Support/com.royalentry.desktop/edge.db
pub async fn open_cache(path: &Path) -> Result<DbPool, sqlx::Error> {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let opts = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
        .busy_timeout(std::time::Duration::from_secs(5));
    SqlitePoolOptions::new()
        .max_connections(4)
        .connect_with(opts)
        .await
}

/// Idempotent schema — safe to call on every startup.
pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS queued_operations (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            op_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            retries INTEGER NOT NULL DEFAULT 0,
            last_error TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_queued_ops_tenant ON queued_operations(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_queued_ops_created ON queued_operations(created_at);
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS local_scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            short_link TEXT NOT NULL UNIQUE,
            event_id TEXT NOT NULL,
            guest_id TEXT NOT NULL,
            invitation_id TEXT NOT NULL,
            scanned_at TEXT NOT NULL,
            scanned_by_user_id TEXT NOT NULL,
            scan_source TEXT NOT NULL,
            notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_local_scans_event ON local_scans(event_id);
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tenant_meta (
            tenant_id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            last_sync_at TEXT,
            last_wipe_at TEXT
        );
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Enqueue a single operation for later sync.
pub async fn enqueue(pool: &DbPool, op: &QueuedOperation) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO queued_operations (id, tenant_id, op_type, payload, created_at, retries, last_error) VALUES (?,?,?,?,?,?,?)"
    )
    .bind(op.id.to_string())
    .bind(op.tenant_id.to_string())
    .bind(&op.op_type)
    .bind(serde_json::to_string(&op.payload).unwrap_or_default())
    .bind(op.created_at.to_rfc3339())
    .bind(op.retries)
    .bind(op.last_error.as_deref())
    .execute(pool)
    .await?;
    Ok(())
}

/// List pending ops (oldest first) up to `limit`.
pub async fn list_pending(pool: &DbPool, tenant_id: Uuid, limit: i64) -> Result<Vec<QueuedOperation>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, String, String, String, String, i32, Option<String>)>(
        "SELECT id, tenant_id, op_type, payload, created_at, retries, last_error FROM queued_operations WHERE tenant_id = ? ORDER BY created_at ASC LIMIT ?"
    )
    .bind(tenant_id.to_string())
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let mut ops = Vec::new();
    for (id, tenant_id, op_type, payload, created_at, retries, last_error) in rows {
        let parsed_id = Uuid::parse_str(&id).unwrap_or_else(|_| Uuid::nil());
        let parsed_tenant = Uuid::parse_str(&tenant_id).unwrap_or_else(|_| Uuid::nil());
        let created_at: DateTime<Utc> = DateTime::parse_from_rfc3339(&created_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        let payload: serde_json::Value = serde_json::from_str(&payload).unwrap_or(serde_json::Value::Null);
        ops.push(QueuedOperation {
            id: parsed_id,
            tenant_id: parsed_tenant,
            op_type,
            payload,
            created_at,
            retries,
            last_error,
        });
    }
    Ok(ops)
}

/// Count of pending ops for a tenant (used for the dashboard badge).
pub async fn pending_count(pool: &DbPool, tenant_id: Uuid) -> Result<i64, sqlx::Error> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM queued_operations WHERE tenant_id = ?"
    )
    .bind(tenant_id.to_string())
    .fetch_one(pool)
    .await?;
    Ok(n)
}

/// Mark an op as failed (increment retries + record error).
pub async fn mark_failed(pool: &DbPool, id: Uuid, err: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE queued_operations SET retries = retries + 1, last_error = ? WHERE id = ?"
    )
    .bind(err)
    .bind(id.to_string())
    .execute(pool)
    .await?;
    Ok(())
}

/// Delete an op once successfully replayed.
pub async fn drop_op(pool: &DbPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM queued_operations WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await?;
    Ok(())
}

/// Persist a local scan (idempotent on short_link).
pub async fn record_local_scan(pool: &DbPool, s: &LocalScan) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR REPLACE INTO local_scans (short_link, event_id, guest_id, invitation_id, scanned_at, scanned_by_user_id, scan_source, notes) VALUES (?,?,?,?,?,?,?,?)"
    )
    .bind(&s.short_link)
    .bind(s.event_id.to_string())
    .bind(s.guest_id.to_string())
    .bind(s.invitation_id.to_string())
    .bind(s.scanned_at.to_rfc3339())
    .bind(s.scanned_by_user_id.to_string())
    .bind(&s.scan_source)
    .bind(s.notes.as_deref())
    .execute(pool)
    .await?;
    Ok(())
}

/// Lookup a local scan by its short_link.
pub async fn lookup_local_scan(pool: &DbPool, short_link: &str) -> Result<Option<LocalScan>, sqlx::Error> {
    let row = sqlx::query_as::<_, (String, String, String, String, String, String, String, Option<String>)>(
        "SELECT short_link, event_id, guest_id, invitation_id, scanned_at, scanned_by_user_id, scan_source, notes FROM local_scans WHERE short_link = ?"
    )
    .bind(short_link)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(short_link, event_id, guest_id, invitation_id, scanned_at, scanned_by_user_id, scan_source, notes)| {
        let parsed_event = Uuid::parse_str(&event_id).unwrap_or_else(|_| Uuid::nil());
        let parsed_guest = Uuid::parse_str(&guest_id).unwrap_or_else(|_| Uuid::nil());
        let parsed_inv = Uuid::parse_str(&invitation_id).unwrap_or_else(|_| Uuid::nil());
        let scanned_at: DateTime<Utc> = DateTime::parse_from_rfc3339(&scanned_at)
            .map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now());
        let parsed_user = Uuid::parse_str(&scanned_by_user_id).unwrap_or_else(|_| Uuid::nil());
        LocalScan {
            short_link,
            event_id: parsed_event,
            guest_id: parsed_guest,
            invitation_id: parsed_inv,
            scanned_at,
            scanned_by_user_id: parsed_user,
            scan_source,
            notes,
        }
    }))
}

/// Record a tenant's display name + last sync time.
pub async fn record_tenant(pool: &DbPool, tenant_id: Uuid, display_name: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO tenant_meta (tenant_id, display_name, last_sync_at) VALUES (?, ?, ?) ON CONFLICT(tenant_id) DO UPDATE SET display_name = excluded.display_name, last_sync_at = excluded.last_sync_at"
    )
    .bind(tenant_id.to_string())
    .bind(display_name)
    .bind(Utc::now().to_rfc3339())
    .execute(pool)
    .await?;
    Ok(())
}

/// Destructive workspace wipe — called on logout.
pub async fn wipe_tenant(pool: &DbPool, tenant_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM queued_operations WHERE tenant_id = ?")
        .bind(tenant_id.to_string())
        .execute(pool).await?;
    sqlx::query("DELETE FROM local_scans WHERE event_id IN (SELECT event_id FROM local_scans WHERE event_id = ?)").bind(tenant_id.to_string()).execute(pool).await.ok();
    sqlx::query("UPDATE tenant_meta SET last_wipe_at = ? WHERE tenant_id = ?")
        .bind(Utc::now().to_rfc3339())
        .bind(tenant_id.to_string())
        .execute(pool).await.ok();
    Ok(())
}
