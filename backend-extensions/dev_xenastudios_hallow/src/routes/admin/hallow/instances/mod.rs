//! `/api/admin/hallow/instances`: the lobby and game instances the control
//! plane runs, from its `/v1/instances`.
//!
//! - `GET /`: every instance with its state, node, address and players.
//! - `DELETE /{name}`: ends one now (its players go back through their proxy).

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

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
