//! `/api/admin/hallow/ranks/players`: a player's ranks (`GET ?name=`), and
//! giving (`POST`) or taking (`POST /revoke`) one, through the control
//! plane's `/v1/rank-grants`. Nodes reach the proxy with the login, so a
//! change applies at the player's next join.

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

    use crate::{control_plane::ControlPlane, moderation::PlayerRanks, network::player_name};

    #[derive(Deserialize, IntoParams)]
    pub struct Params {
        name: String,
    }

    #[derive(ToSchema)]
    #[allow(dead_code)]
    struct Response {
        /// Null when nobody by that name has joined.
        player: Option<PlayerRanks>,
    }

    /// A player's ranks, grants and the nodes they hold together.
    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
    ), params(Params))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.ranks.read")?;
        let name = player_name(&params.name)?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let player = control_plane
            .send_optional(
                control_plane
                    .request(reqwest::Method::GET, "/v1/rank-grants")
                    .query(&[("name", name)]),
            )
            .await?;

        ApiResponse::new_serialized(serde_json::json!({ "player": player })).ok()
    }
}

#[derive(utoipa::ToSchema, serde::Deserialize)]
pub struct GrantPayload {
    player: String,
    rank: String,
    /// Grants only; null or left out is permanent.
    #[serde(default)]
    duration_seconds: Option<u64>,
}

mod post {
    use shared::{
        GetState,
        models::{
            admin_activity::GetAdminActivityLogger,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };

    use super::GrantPayload;
    use crate::{
        control_plane::ControlPlane,
        moderation::{PlayerRanks, staff},
        network::player_name,
    };

    /// Gives a player a rank; giving one they hold replaces its expiry.
    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = PlayerRanks),
        (status = BAD_REQUEST, body = shared::ApiError),
        (status = NOT_FOUND, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
    ), request_body = GrantPayload)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<GrantPayload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.ranks.manage")?;
        let player = player_name(&data.player)?;
        let duration_seconds = data.duration_seconds.filter(|s| *s > 0);

        let control_plane = ControlPlane::from_state(&state).await?;
        let ranks = control_plane
            .send(
                control_plane
                    .request(reqwest::Method::POST, "/v1/rank-grants")
                    .json(&serde_json::json!({
                        "player": player,
                        "rank": data.rank,
                        "duration_seconds": duration_seconds,
                        "staff": staff(&user),
                    })),
            )
            .await?;

        activity_logger
            .log(
                "hallow:rank.grant",
                serde_json::json!({
                    "player": player,
                    "rank": data.rank,
                    "duration_seconds": duration_seconds,
                }),
            )
            .await;

        ApiResponse::new_serialized(ranks).ok()
    }
}

mod revoke {
    use serde::Deserialize;
    use shared::{
        GetState,
        models::{
            admin_activity::GetAdminActivityLogger,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    use crate::{
        control_plane::ControlPlane,
        moderation::{PlayerRanks, staff},
        network::player_name,
    };

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        player: String,
        rank: String,
    }

    /// Takes a rank from a player.
    #[utoipa::path(post, path = "/revoke", responses(
        (status = OK, body = PlayerRanks),
        (status = NOT_FOUND, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.ranks.manage")?;
        let player = player_name(&data.player)?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let ranks = control_plane
            .send(
                control_plane
                    .request(reqwest::Method::POST, "/v1/rank-grants/revoke")
                    .json(&serde_json::json!({
                        "player": player,
                        "rank": data.rank,
                        "staff": staff(&user),
                    })),
            )
            .await?;

        activity_logger
            .log(
                "hallow:rank.revoke",
                serde_json::json!({ "player": player, "rank": data.rank }),
            )
            .await;

        ApiResponse::new_serialized(ranks).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .routes(routes!(revoke::route))
        .with_state(state.clone())
}
