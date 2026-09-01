//! Multicast DNS (mDNS) service advertisement — let mobile clients
//! auto-discover the desktop edge hub on the local venue Wi-Fi without
//! manual IP configuration.
//!
//! The desktop app boots and registers an MDNS service entry:
//!   _eventcheckin._tcp.local  (port = edge server)
//!
//! Mobile clients listen for that service name and override their API base
//! URL to the discovered local IPv4.

use mdns_sd::{Daemon, ServiceDaemon, ServiceInfo};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Holds the running MDNS daemon. Drop the service to stop advertising.
pub struct MdnsAdvertiser {
    daemon: Arc<ServiceDaemon>,
    service_fullname: String,
}

impl MdnsAdvertiser {
    pub fn fullname(&self) -> &str {
        &self.service_fullname
    }
}

/// Start advertising `_eventcheckin._tcp.local` on the given port.
/// Returns a handle that keeps the daemon alive for the lifetime of the app.
pub fn advertise_service(
    instance_name: &str,
    port: u16,
    tenant_id: uuid::Uuid,
) -> Result<MdnsAdvertiser, String> {
    let daemon = Daemon::new().map_err(|e| format!("mdns daemon: {e}"))?;
    let service_type = "_eventcheckin._tcp.local.";
    let host_name = format!("royalentry-edge-{}.local.", short_id(&tenant_id));
    let properties: &[(&str, &str)] = &[
        ("tenant_id", &tenant_id.to_string()),
        ("version", env!("CARGO_PKG_VERSION")),
        ("api", "/api/v1"),
    ];

    let service = ServiceInfo::new(
        service_type,
        instance_name,
        &host_name,
        "",
        port,
        properties,
    )
    .map_err(|e| format!("mdns service: {e}"))?;

    let fullname = service.get_fullname().to_string();
    daemon
        .register(service)
        .map_err(|e| format!("mdns register: {e}"))?;

    tracing::info!(fullname = %fullname, port, "MDNS service registered");

    Ok(MdnsAdvertiser {
        daemon: Arc::new(daemon),
        service_fullname: fullname,
    })
}

fn short_id(id: &uuid::Uuid) -> String {
    id.simple().to_string()[..8].to_string()
}

/// Background discovery loop — mobile clients call this to find the desktop hub.
/// Exposed for completeness; the actual discovery happens in the mobile app.
pub async fn discover_services(instance_filter: Option<&str>) -> Result<Vec<String>, String> {
    let daemon = Daemon::new().map_err(|e| format!("mdns daemon: {e}"))?;
    let receiver = daemon
        .browse("_eventcheckin._tcp.local.")
        .map_err(|e| format!("mdns browse: {e}"))?;

    let mut found = Vec::new();
    let timeout = std::time::Duration::from_secs(3);
    let start = std::time::Instant::now();
    while start.elapsed() < timeout {
        if let Ok(event) = tokio::time::timeout(timeout - start.elapsed(), receiver.recv_async()).await {
            if let Ok(mdns_sd::ServiceEvent::ServiceResolved(info)) = event {
                let name = info.get_fullname().to_string();
                if let Some(filter) = instance_filter {
                    if !name.contains(filter) { continue; }
                }
                found.push(name);
            }
        } else {
            break;
        }
    }
    Ok(found)
}

// Quiet the unused-Mutex import warning for future use (state-bridge pattern).
#[allow(dead_code)]
type _ReservedMutex<T> = Mutex<T>;
