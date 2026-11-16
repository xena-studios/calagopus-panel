//! `GET /api/admin/hallow/punishments/search`: every punishment on the
//! network, newest first, filtered and paged, from the control plane's
//! `/v1/punishments/search`.

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
        moderation::{KINDS, PunishmentPage, check_kind},
        network::player_name,
    };

    #[derive(Deserialize, IntoParams)]
    pub struct Params {
        /// Only this player's, by username.
        player: Option<String>,
        /// `ban`, `mute`, `kick` or `warn`.
        kind: Option<String>,
        /// Only those in force (`true`) or not (`false`).
        active: Option<bool>,
        /// 1-based.
        #[serde(default = "first_page")]
        page: u32,
        /// 1 to 100; 25 if left out.
        #[serde(default = "default_per_page")]
        per_page: u32,
    }

    fn first_page() -> u32 {
        1
    }

    fn default_per_page() -> u32 {
        25
    }

    #[derive(ToSchema)]
    #[allow(dead_code)]
    struct Response {
        /// False when `player` names nobody who has joined.
        known: bool,
        page: u32,
        per_page: u32,
        punishments: PunishmentPage,
    }

    /// Every punishment, newest first, with its target, issuer and whether
    /// and by whom it was lifted.
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
        let player = match params.player.as_deref().map(str::trim) {
            Some(name) if !name.is_empty() => Some(player_name(name)?),
            _ => None,
        };
        if let Some(kind) = &params.kind {
            check_kind(kind, KINDS)?;
        }
        let page = params.page.max(1);
        let per_page = params.per_page.clamp(1, 100);

        let mut query: Vec<(&str, String)> = vec![
            ("limit", per_page.to_string()),
            ("offset", ((page - 1).saturating_mul(per_page)).to_string()),
        ];
        if let Some(player) = player {
            query.push(("player", player.to_string()));
        }
        if let Some(kind) = &params.kind {
            query.push(("kind", kind.clone()));
        }
        if let Some(active) = params.active {
            query.push(("active", active.to_string()));
        }

        let control_plane = ControlPlane::from_state(&state).await?;
        let found = control_plane
            .send_optional(
                control_plane
                    .request(reqwest::Method::GET, "/v1/punishments/search")
                    .query(&query),
            )
            .await?;

        ApiResponse::new_serialized(serde_json::json!({
            "known": found.is_some(),
            "page": page,
            "per_page": per_page,
            "punishments": found.unwrap_or_else(|| serde_json::json!({ "total": 0, "entries": [] })),
        }))
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
