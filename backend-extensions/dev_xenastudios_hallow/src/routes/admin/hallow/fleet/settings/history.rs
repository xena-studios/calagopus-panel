//! `GET /api/admin/hallow/fleet/settings/history`: who changed the fleet
//! settings and how, newest first, from the control plane.

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::extract::Query;
    use serde::Deserialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::IntoParams;

    use crate::{control_plane::ControlPlane, fleet::FleetSettingsChange};

    const DEFAULT_LIMIT: u32 = 50;
    const MAX_LIMIT: u32 = 500;

    #[derive(Deserialize, IntoParams)]
    pub struct Params {
        /// How many changes to return, newest first (1 to 500, default 50).
        limit: Option<u32>,
    }

    /// Changes to the fleet manager's settings, newest first.
    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = Vec<FleetSettingsChange>),
        (status = BAD_GATEWAY, body = shared::ApiError),
        (status = SERVICE_UNAVAILABLE, body = shared::ApiError),
    ), params(Params))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.fleet.read")?;

        let limit = params.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
        let control_plane = ControlPlane::from_state(&state).await?;
        let history = control_plane
            .send(
                control_plane
                    .request(reqwest::Method::GET, "/v1/fleet/settings/history")
                    .query(&[("limit", limit)]),
            )
            .await?;

        ApiResponse::new_serialized(history).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
