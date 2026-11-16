//! `/api/admin/hallow/ranks`: Hallow ranks, where in-game staff power comes
//! from (permission nodes sent with each login), kept by the control plane at
//! `/v1/ranks`. Panel permissions come from panel roles instead.
//!
//! - `GET /`: every rank. `PUT`/`DELETE /{name}`: save or delete one.
//! - `/players`: a player's ranks; give or take one.

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod players;

/// Rank names: 1 to 32 of `a-z 0-9 _ -`, as the control plane checks.
fn rank_name(name: &str) -> Result<&str, shared::response::ApiResponse> {
    let ok = (1..=32).contains(&name.len())
        && name
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'_' | b'-'));
    if ok {
        Ok(name)
    } else {
        Err(shared::response::ApiResponse::error(
            "name: must be 1 to 32 lowercase letters, digits, '_' or '-'",
        ))
    }
}

mod get {
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };

    use crate::{control_plane::ControlPlane, moderation::RankInfo};

    /// Every rank, highest weight first, with how many players hold it.
    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = Vec<RankInfo>),
        (status = BAD_GATEWAY, body = shared::ApiError),
        (status = SERVICE_UNAVAILABLE, body = shared::ApiError),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.ranks.read")?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let ranks = control_plane
            .send(control_plane.request(reqwest::Method::GET, "/v1/ranks"))
            .await?;

        ApiResponse::new_serialized(ranks).ok()
    }
}

mod put {
    use axum::extract::Path;
    use serde::{Deserialize, Serialize};
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    use crate::{control_plane::ControlPlane, moderation::RankInfo};

    #[derive(ToSchema, Deserialize, Serialize)]
    pub struct Payload {
        /// Shown before the player's name, with `&` colour codes.
        #[serde(default)]
        display_prefix: String,
        /// Higher wins, for display order and the primary rank.
        #[serde(default)]
        weight: i32,
        /// Nodes such as `hallow.staff.ban`, `hallow.staff.*` or `-hallow.staff.alert`.
        #[serde(default)]
        permissions: Vec<String>,
        /// Held by every player without a grant; takes the flag off the old default.
        #[serde(default)]
        is_default: bool,
    }

    /// Creates the rank or replaces it. Bad nodes are a 400 naming the field.
    #[utoipa::path(put, path = "/{name}", responses(
        (status = OK, body = RankInfo),
        (status = BAD_REQUEST, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
    ), params(("name" = String, Path, description = "The rank's name")), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        Path(name): Path<String>,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.ranks.manage")?;
        let name = super::rank_name(&name)?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let saved = control_plane
            .send(
                control_plane
                    .request(reqwest::Method::PUT, &format!("/v1/ranks/{name}"))
                    .json(&data),
            )
            .await?;

        activity_logger
            .log("hallow:rank.update", saved.clone())
            .await;

        ApiResponse::new_serialized(saved).ok()
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

    /// Deletes a rank and takes it from everyone. The default rank can't be
    /// deleted (409).
    #[utoipa::path(delete, path = "/{name}", responses(
        (status = OK),
        (status = NOT_FOUND, body = shared::ApiError),
        (status = CONFLICT, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
    ), params(("name" = String, Path, description = "The rank's name")))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        Path(name): Path<String>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.ranks.manage")?;
        let name = super::rank_name(&name)?;

        let control_plane = ControlPlane::from_state(&state).await?;
        control_plane
            .send(control_plane.request(reqwest::Method::DELETE, &format!("/v1/ranks/{name}")))
            .await?;

        activity_logger
            .log("hallow:rank.delete", serde_json::json!({ "name": name }))
            .await;

        ApiResponse::new_serialized(serde_json::json!({})).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(put::route))
        .routes(routes!(delete::route))
        .nest("/players", players::router(state))
        .with_state(state.clone())
}
