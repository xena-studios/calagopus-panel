//! `/api/admin/hallow/instances`: the lobby and game instances the control
//! plane runs, from its `/v1/instances`.
//!
//! - `GET /`: every instance with its state, node, address and players.
//! - `DELETE /{name}`: ends one now (its players go back through their proxy).
//! - `GET /{name}/websocket`: a console token for the instance's Wings server.
//!
//! Instances have no panel server record (the control plane drives Wings
//! directly), so the stock server pages can't open their consoles. The
//! panel still holds each node's Wings token, which is all a console needs:
//! the websocket route signs the same token the stock console gets, for the
//! instance's Wings UUID on its node.

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    use crate::{control_plane::ControlPlane, instances::InstanceInfo};

    /// Only documents the shape; the list passes through as the control plane sent it.
    #[allow(dead_code)]
    #[derive(ToSchema)]
    struct Response {
        instances: Vec<InstanceInfo>,
        /// When the panel asked, Unix milliseconds, for ages.
        fetched_at_ms: u64,
    }

    /// Every instance, by name, as the control plane sees them now.
    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_GATEWAY, body = shared::ApiError),
        (status = SERVICE_UNAVAILABLE, body = shared::ApiError),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.instances.read")?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let instances = control_plane
            .send(control_plane.request(reqwest::Method::GET, "/v1/instances"))
            .await?;
        let fetched_at_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or_default();

        ApiResponse::new_serialized(serde_json::json!({
            "instances": instances,
            "fetched_at_ms": fetched_at_ms,
        }))
        .ok()
    }
}

mod delete {
    use axum::extract::Path;
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };

    use crate::control_plane::ControlPlane;

    /// Ends an instance now. Its players are sent back by their proxy; the
    /// control plane starts another if the kind still needs one.
    #[utoipa::path(delete, path = "/{name}", responses(
        (status = OK),
        (status = NOT_FOUND, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
    ), params(("name" = String, Path, description = "The instance's name")))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        Path(name): Path<String>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.instances.manage")?;
        let name = crate::instances::checked_name(&name, 47)?;

        let control_plane = ControlPlane::from_state(&state).await?;
        control_plane
            .send(control_plane.request(reqwest::Method::DELETE, &format!("/v1/instances/{name}")))
            .await?;

        activity_logger
            .log("hallow:instance.end", serde_json::json!({ "name": name }))
            .await;

        ApiResponse::new_serialized(serde_json::json!({})).ok()
    }
}

mod websocket {
    use axum::{extract::Path, http::StatusCode};
    use compact_str::ToCompactString;
    use serde::Serialize;
    use shared::{
        GetState,
        jwt::BasePayload,
        models::{
            ByUuid,
            admin_activity::GetAdminActivityLogger,
            node::Node,
            user::{GetAuthMethod, GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    use crate::control_plane::ControlPlane;

    /// What Wings may do on an instance's socket: read its console and send
    /// commands. No power actions (the control plane owns the lifecycle; end
    /// an instance with `DELETE`), no files.
    const PERMISSIONS: &[&str] = &[
        "websocket.connect",
        "control.read-console",
        "control.console",
    ];

    #[derive(ToSchema, Serialize)]
    struct Response {
        token: String,
        /// The node's Wings websocket for the instance, at the node's public
        /// URL (normally the panel's Wings proxy).
        #[schema(format = "uri")]
        url: String,
        /// The instance's Wings server UUID.
        server_uuid: uuid::Uuid,
        node: String,
    }

    /// The Wings JWT the stock console uses (`/api/client/servers/{server}/websocket`).
    #[derive(Serialize)]
    struct WebsocketJwt<'a> {
        #[serde(flatten)]
        base: BasePayload,

        user_uuid: uuid::Uuid,
        user_name: &'a str,
        user_avatar: Option<String>,
        server_uuid: uuid::Uuid,
        permissions: &'a [&'a str],
        full_permissions: &'a [&'a str],
        ignored_files: &'a [compact_str::CompactString],
        credential: Option<uuid::Uuid>,
    }

    fn error(status: StatusCode, message: impl Into<String>) -> ApiResponse {
        ApiResponse::error(message.into()).with_status(status)
    }

    /// A console token for an instance: Wings' websocket at its node, as the
    /// stock server console uses it (`auth`, `send logs`, `send command`).
    #[utoipa::path(get, path = "/{name}/websocket", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = shared::ApiError),
        (status = CONFLICT, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
    ), params(("name" = String, Path, description = "The instance's name")))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        request_host: shared::GetRequestHost,
        auth: GetAuthMethod,
        user: GetUser,
        activity_logger: GetAdminActivityLogger,
        Path(name): Path<String>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.instances.console")?;
        let name = crate::instances::checked_name(&name, 47)?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let instances = control_plane
            .send(control_plane.request(reqwest::Method::GET, "/v1/instances"))
            .await?;
        let Some(instance) = instances
            .as_array()
            .and_then(|all| all.iter().find(|i| i["name"] == name))
        else {
            return error(StatusCode::NOT_FOUND, "No such instance.").ok();
        };
        let node_name = instance["node"].as_str().unwrap_or_default().to_owned();
        let Some(server_uuid) = instance["uuid"]
            .as_str()
            .and_then(|uuid| uuid.parse::<uuid::Uuid>().ok())
        else {
            return error(
                StatusCode::BAD_GATEWAY,
                "The control plane sent an instance without a UUID.",
            )
            .ok();
        };

        // The node's panel UUID, from the control plane's node records.
        let nodes = control_plane
            .send(control_plane.request(reqwest::Method::GET, "/v1/nodes"))
            .await?;
        let Some(panel_uuid) = nodes
            .as_array()
            .and_then(|all| all.iter().find(|n| n["name"] == node_name.as_str()))
            .and_then(|n| n["panel_uuid"].as_str())
            .and_then(|uuid| uuid.parse::<uuid::Uuid>().ok())
        else {
            return error(
                StatusCode::CONFLICT,
                format!("The instance runs on {node_name}, which isn't a Wings node the panel manages (the dev network's Docker orchestrator has no console here)."),
            )
            .ok();
        };
        let Some(node) = Node::by_uuid_optional_cached(&state.database, panel_uuid).await? else {
            return error(
                StatusCode::CONFLICT,
                format!("The instance's node {node_name} isn't in the panel."),
            )
            .ok();
        };

        let now = chrono::Utc::now().timestamp();
        let token = node
            .create_jwt(
                &state.database,
                &state.jwt,
                &WebsocketJwt {
                    base: BasePayload {
                        scope: "websocket".into(),
                        issuer: "panel".into(),
                        subject: Some(user.uuid.to_compact_string()),
                        audience: Vec::new(),
                        expiration_time: Some(now + 600),
                        not_before: None,
                        issued_at: Some(now),
                        jwt_id: uuid::Uuid::new_v4().to_compact_string(),
                    },
                    user_uuid: user.uuid,
                    user_name: &user.username,
                    user_avatar: None,
                    server_uuid,
                    permissions: PERMISSIONS,
                    full_permissions: PERMISSIONS,
                    ignored_files: &[],
                    credential: auth.api_key_uuid(),
                },
            )
            .await?;

        let mut url = node
            .public_url(
                &state,
                request_host.as_deref(),
                &format!("/api/servers/{server_uuid}/ws"),
            )
            .await?;
        match url.scheme() {
            "http" => url.set_scheme("ws").ok(),
            "https" => url.set_scheme("wss").ok(),
            _ => None,
        };

        activity_logger
            .log(
                "hallow:instance.console",
                serde_json::json!({ "name": name, "node": node_name, "server_uuid": server_uuid }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            token,
            url: url.to_string(),
            server_uuid,
            node: node_name,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .routes(routes!(websocket::route))
        .with_state(state.clone())
}
