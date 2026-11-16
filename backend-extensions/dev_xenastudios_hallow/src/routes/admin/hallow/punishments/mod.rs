//! `GET /api/admin/hallow/punishments?name=`: a player's punishment history,
//! newest first, from the control plane's `/v1/punishments?name=`.

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
        network::{PunishmentRecord, player_name},
    };

    #[derive(Deserialize, IntoParams)]
    pub struct Params {
        /// The player's username, matched without case; the most recently seen account wins.
        name: String,
    }

    /// Only documents the shape.
    #[allow(dead_code)]
    #[derive(ToSchema)]
    struct Response {
        /// False when nobody by that name has joined the network.
        known: bool,
        punishments: Vec<PunishmentRecord>,
    }

    /// A player's bans, mutes, kicks and warnings, newest first.
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
        permissions.has_admin_permission("hallow.punishments.read")?;
        let name = player_name(&params.name)?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let punishments = control_plane
            .send_optional(
                control_plane
                    .request(reqwest::Method::GET, "/v1/punishments")
                    .query(&[("name", name)]),
            )
            .await?;

        ApiResponse::new_serialized(serde_json::json!({
            "known": punishments.is_some(),
            "punishments": punishments.unwrap_or_else(|| serde_json::json!([])),
        }))
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
