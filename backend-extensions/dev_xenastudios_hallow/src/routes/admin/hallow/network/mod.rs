//! `GET /api/admin/hallow/network`: the live network for the Overview page,
//! from the control plane's `/v1/proxies`, `/v1/servers` and
//! `/v1/presence/count`, fetched together.

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {

    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    use crate::{
        control_plane::ControlPlane,
        network::{NetworkCount, ProxyInfo, ServerInfo},
    };

    /// Only documents the shape; the lists pass through as the control plane sent them.
    #[allow(dead_code)]
    #[derive(ToSchema)]
    struct Response {
        proxies: Vec<ProxyInfo>,
        servers: Vec<ServerInfo>,
        count: NetworkCount,
        /// When the panel asked, Unix milliseconds.
        fetched_at_ms: u64,
    }

    /// Proxies, servers and the player count, as the control plane sees them now.
    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_GATEWAY, body = shared::ApiError),
        (status = SERVICE_UNAVAILABLE, body = shared::ApiError),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.network.read")?;

        let control_plane = ControlPlane::from_state(&state).await?;
        // `GET /v1/servers` is a long poll; a `since` no revision can equal
        // with `wait=0` makes it answer the full list at once.
        let (proxies, servers, count) = tokio::try_join!(
            control_plane.send(control_plane.request(reqwest::Method::GET, "/v1/proxies")),
            control_plane.send(
                control_plane
                    .request(reqwest::Method::GET, "/v1/servers")
                    .query(&[("since", u64::MAX), ("wait", 0)]),
            ),
            control_plane.send(control_plane.request(reqwest::Method::GET, "/v1/presence/count")),
        )?;

        let servers = match servers.get("status").and_then(|s| s.as_str()) {
            Some("changed") => servers.get("data").cloned().unwrap_or_default(),
            _ => serde_json::Value::Array(vec![]),
        };
        let fetched_at_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or_default();

        ApiResponse::new_serialized(serde_json::json!({
            "proxies": proxies,
            "servers": servers,
            "count": count,
            "fetched_at_ms": fetched_at_ms,
        }))
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
