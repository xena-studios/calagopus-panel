//! `GET /api/admin/hallow/punishments?name=`: a player's punishment history,
//! newest first, from the control plane's `/v1/punishments?name=`.
//! `POST` issues a ban, mute, kick or warning as the logged-in staff member,
//! through the same path as in-game `/ban`, so every proxy enforces it.
//!
//! - `/revoke`: lift a ban or mute.
//! - `/search`: every punishment, filtered and paged.
//! - `/templates`: reason templates.

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod revoke;
mod search;
mod templates;

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

mod post {
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
        moderation::{KINDS, check_kind, punishment_reply, staff},
        network::player_name,
    };

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        /// `ban`, `mute`, `kick` or `warn`.
        kind: String,
        /// The player's username, online or not (a kick needs them online).
        target: String,
        reason: String,
        /// Bans and mutes only; null or left out is permanent.
        #[serde(default)]
        duration_seconds: Option<u64>,
        /// The template it came from, for the activity log.
        #[serde(default)]
        template: Option<String>,
    }

    #[derive(ToSchema)]
    #[allow(dead_code)]
    struct Response {
        /// What happened, such as "Banned Steve for 30d 0h: Cheating".
        message: String,
        id: Option<i64>,
    }

    /// Issues a punishment as the logged-in staff member. The player's proxy
    /// enforces it at once and every proxy refuses a banned player's login.
    /// A refusal (already banned, not online for a kick) is a 400.
    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
        (status = SERVICE_UNAVAILABLE, body = shared::ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.punishments.manage")?;
        check_kind(&data.kind, KINDS)?;
        let target = player_name(&data.target)?;
        let reason = data.reason.trim();
        if reason.is_empty() || reason.chars().count() > 256 {
            return ApiResponse::error("reason: must be 1 to 256 characters").ok();
        }
        let lasting = matches!(data.kind.as_str(), "ban" | "mute");
        let duration_seconds = data.duration_seconds.filter(|s| lasting && *s > 0);

        let control_plane = ControlPlane::from_state(&state).await?;
        let reply = control_plane
            .send(
                control_plane
                    .request(reqwest::Method::POST, "/v1/punishments")
                    .json(&serde_json::json!({
                        "kind": data.kind,
                        "target": target,
                        "issuer": null,
                        "reason": reason,
                        "duration_seconds": duration_seconds,
                        "staff": staff(&user),
                    })),
            )
            .await?;
        let (message, id) = punishment_reply(&reply)?;

        activity_logger
            .log(
                "hallow:punishment.issue",
                serde_json::json!({
                    "id": id,
                    "kind": data.kind,
                    "target": target,
                    "reason": reason,
                    "duration_seconds": duration_seconds,
                    "template": data.template,
                }),
            )
            .await;

        ApiResponse::new_serialized(serde_json::json!({ "message": message, "id": id })).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/revoke", revoke::router(state))
        .nest("/search", search::router(state))
        .nest("/templates", templates::router(state))
        .with_state(state.clone())
}
