use std::net::SocketAddr;
use std::path::Path;
use std::sync::Arc;

use axum::extract::{Path as AxPath, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::{LocalScan, QueuedOperation};
use crate::storage::{self, DbPool};

/// Shared state for the embedded edge server.
pub struct EdgeState {
    pub db: DbPool,
    pub tenant_id: Uuid,
    pub cloud_base: String, // e.g. http://127.0.0.1:3000
}

pub type Shared = Arc<EdgeState>;

#[derive(Debug, Serialize)]
struct Health {
    status: &'static str,
    tenant_id: Uuid,
    pending_ops: i64,
    last_sync_at: Option<String>,
}

async fn health(State(s): State<Shared>) -> Json<Health> {
    let pending = storage::pending_count(&s.db, s.tenant_id).await.unwrap_or(0);
    Json(Health {
        status: "ok",
        tenant_id: s.tenant_id,
        pending_ops: pending,
        last_sync_at: None,
    })
}

#[derive(Debug, Deserialize)]
struct ScanReq {
    short_link: String,
    event_id: Uuid,
    guest_id: Uuid,
    invitation_id: Uuid,
    scanned_by_user_id: Uuid,
    scan_source: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Serialize)]
struct ScanResp {
    accepted: bool,
    queued: bool,
    short_link: String,
}

/// Offline-first scan endpoint — always succeeds locally and queues for cloud sync.
async fn post_scan(
    State(s): State<Shared>,
    Json(req): Json<ScanReq>,
) -> Result<Json<ScanResp>, String> {
    let now = chrono::Utc::now();
    let scan = LocalScan {
        short_link: req.short_link.clone(),
        event_id: req.event_id,
        guest_id: req.guest_id,
        invitation_id: req.invitation_id,
        scanned_at: now,
        scanned_by_user_id: req.scanned_by_user_id,
        scan_source: req.scan_source.clone().unwrap_or_else(|| "offline".to_string()),
        notes: req.notes.clone(),
    };

    // 1) Persist locally (instant ACK, even if WAN is down)
    storage::record_local_scan(&s.db, &scan)
        .await
        .map_err(|e| e.to_string())?;

    // 2) Queue for cloud replay
    let op = QueuedOperation::new(
        s.tenant_id,
        "scan",
        serde_json::to_value(&scan).unwrap_or(serde_json::Value::Null),
    );
    storage::enqueue(&s.db, &op)
        .await
        .map_err(|e| e.to_string())?;

    Ok(Json(ScanResp {
        accepted: true,
        queued: true,
        short_link: scan.short_link,
    }))
}

#[derive(Debug, Deserialize)]
struct PledgeReq {
    guest_id: Uuid,
    event_id: Uuid,
    amount_tsh: i64,
    payment_method: String,
    payer_phone: Option<String>,
    notes: Option<String>,
}

/// Offline pledge payment — queues the payment for replay when WAN returns.
async fn post_pledge(
    State(s): State<Shared>,
    Json(req): Json<PledgeReq>,
) -> Result<Json<QueuedOperation>, String> {
    let payload = serde_json::json!({
        "guest_id": req.guest_id,
        "event_id": req.event_id,
        "amount_tsh": req.amount_tsh,
        "payment_method": req.payment_method,
        "payer_phone": req.payer_phone,
        "notes": req.notes,
    });
    let op = QueuedOperation::new(s.tenant_id, "pledge_payment", payload);
    storage::enqueue(&s.db, &op).await.map_err(|e| e.to_string())?;
    Ok(Json(op))
}

#[derive(Debug, Serialize)]
struct PendingResp {
    pending: Vec<QueuedOperation>,
}

async fn get_pending(State(s): State<Shared>) -> Json<PendingResp> {
    let pending = storage::list_pending(&s.db, s.tenant_id, 500)
        .await
        .unwrap_or_default();
    Json(PendingResp { pending })
}

#[derive(Debug, Deserialize)]
struct SyncResult {
    id: Uuid,
    ok: bool,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SyncReport {
    results: Vec<SyncResult>,
}

/// Drain the queue — called when WAN comes back. Frontend (or a background
/// task) is responsible for POSTing each op to the cloud and reporting results.
async fn post_sync(
    State(s): State<Shared>,
    Json(report): Json<SyncReport>,
) -> Result<Json<serde_json::Value>, String> {
    for r in report.results {
        if r.ok {
            storage::drop_op(&s.db, r.id).await.ok();
        } else {
            storage::mark_failed(&s.db, r.id, r.error.as_deref().unwrap_or("unknown"))
                .await
                .ok();
        }
    }
    let remaining = storage::pending_count(&s.db, s.tenant_id)
        .await
        .unwrap_or(0);
    Ok(Json(serde_json::json!({ "remaining": remaining })))
}

#[derive(Debug, Serialize)]
struct LookupResp {
    found: bool,
    scan: Option<LocalScan>,
}

async fn get_scan(
    State(s): State<Shared>,
    AxPath(short_link): AxPath<String>,
) -> Json<LookupResp> {
    let res = storage::lookup_local_scan(&s.db, &short_link)
        .await
        .unwrap_or(None);
    Json(LookupResp {
        found: res.is_some(),
        scan: res,
    })
}

#[derive(Debug, Deserialize)]
struct WipeReq {
    confirm: bool,
}

/// Destructive workspace wipe — called on logout to comply with multi-tenant
/// device hardening (deletes all cached data for this tenant).
async fn post_wipe(
    State(s): State<Shared>,
    Json(req): Json<WipeReq>,
) -> Result<Json<serde_json::Value>, String> {
    if !req.confirm {
        return Err("Confirmation required: { confirm: true }".to_string());
    }
    storage::wipe_tenant(&s.db, s.tenant_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(Json(serde_json::json!({ "wiped": true, "tenant_id": s.tenant_id })))
}

/// Build the embedded Axum router.
pub fn router(state: Shared) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/scan", post(post_scan))
        .route("/scan/:short_link", get(get_scan))
        .route("/pledge", post(post_pledge))
        .route("/pending", get(get_pending))
        .route("/sync", post(post_sync))
        .route("/wipe", post(post_wipe))
        .with_state(state)
}

/// Spawn the embedded edge server in the background. Returns the bound local
/// address so the Tauri host can advertise it via MDNS.
pub async fn spawn(
    db_path: &Path,
    tenant_id: Uuid,
    cloud_base: String,
    bind: SocketAddr,
) -> Result<SocketAddr, String> {
    let pool = storage::open_cache(db_path).await.map_err(|e| e.to_string())?;
    storage::run_migrations(&pool).await.map_err(|e| e.to_string())?;
    let state = Arc::new(EdgeState {
        db: pool,
        tenant_id,
        cloud_base,
    });
    let app = router(state);

    let listener = tokio::net::TcpListener::bind(bind)
        .await
        .map_err(|e| e.to_string())?;
    let local_addr = listener.local_addr().map_err(|e| e.to_string())?;
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            tracing::error!(error = %e, "edge server crashed");
        }
    });
    Ok(local_addr)
}
