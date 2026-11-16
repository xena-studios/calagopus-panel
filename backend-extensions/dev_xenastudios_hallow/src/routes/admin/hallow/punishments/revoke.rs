//! `POST /api/admin/hallow/punishments/revoke`: lift a player's active ban or
//! mute as the logged-in staff member.

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

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
        moderation::{check_kind, punishment_reply, staff},
        network::player_name,
    };

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        /// `ban` or `mute`.
        kind: String,
        target: String,
        /// Why it was lifted; optional.
        #[serde(default)]
        reason: Option<String>,
    }

    #[derive(ToSchema)]
    #[allow(dead_code)]
    struct Response {
        message: String,
        /// The punishment lifted.
        id: Option<i64>,
    }

    /// Lifts the player's active ban or mute. A muted player is told on
    /// their proxy straight away. Nothing to lift is a 400.
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
        check_kind(&data.kind, &["ban", "mute"])?;
        let target = player_name(&data.target)?;
        let reason = data
            .reason
            .as_deref()
            .map(str::trim)
            .filter(|r| !r.is_empty());
        if reason.is_some_and(|r| r.chars().count() > 256) {
            return ApiResponse::error("reason: must be at most 256 characters").ok();
        }

        let control_plane = ControlPlane::from_state(&state).await?;
        let reply = control_plane
            .send(
                control_plane
                    .request(reqwest::Method::POST, "/v1/punishments/revoke")
                    .json(&serde_json::json!({
                        "kind": data.kind,
                        "target": target,
                        "issuer": null,
                        "reason": reason,
                        "staff": staff(&user),
                    })),
            )
            .await?;
        let (message, id) = punishment_reply(&reply)?;

        activity_logger
            .log(
                "hallow:punishment.revoke",
                serde_json::json!({
                    "id": id,
                    "kind": data.kind,
                    "target": target,
                    "reason": reason,
                }),
            )
            .await;

        ApiResponse::new_serialized(serde_json::json!({ "message": message, "id": id })).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
