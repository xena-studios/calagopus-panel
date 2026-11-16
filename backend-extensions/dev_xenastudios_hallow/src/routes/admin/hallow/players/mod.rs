//! `GET /api/admin/hallow/players?name=`: where a player is on the network
//! right now, from the control plane's `/v1/players?name=`.

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
    use utoipa::{IntoParams, ToSchema};

    use crate::{
        control_plane::ControlPlane,
        network::{PlayerLocation, player_name},
    };

    #[derive(Deserialize, IntoParams)]
    pub struct Params {
        /// The player's username, matched without case.
        name: String,
    }

    /// Only documents the shape.
    #[allow(dead_code)]
    #[derive(ToSchema)]
    struct Response {
        /// Null when the player isn't online.
        player: Option<PlayerLocation>,
    }

    /// Looks a player up by name: their proxy and server while online.
    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
        (status = SERVICE_UNAVAILABLE, body = shared::ApiError),
    ), params(Params))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.players.read")?;
        let name = player_name(&params.name)?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let player = control_plane
            .send_optional(
                control_plane
                    .request(reqwest::Method::GET, "/v1/players")
                    .query(&[("name", name)]),
            )
            .await?;

        ApiResponse::new_serialized(serde_json::json!({ "player": player })).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
