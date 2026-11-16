//! `GET`/`PUT /api/admin/hallow/fleet/settings`: the fleet manager's settings,
//! proxied to the control plane's `/v1/fleet/settings`.

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod history;

mod get {
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };

    use crate::{control_plane::ControlPlane, fleet::FleetSettingsResponse};

    /// The fleet manager's settings, from the control plane.
    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = FleetSettingsResponse),
        (status = BAD_GATEWAY, body = shared::ApiError),
        (status = SERVICE_UNAVAILABLE, body = shared::ApiError),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.fleet.read")?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let settings = control_plane
            .send(control_plane.request(reqwest::Method::GET, "/v1/fleet/settings"))
            .await?;

        ApiResponse::new_serialized(settings).ok()
    }
}

mod put {
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
        fleet::{FleetSettings, FleetSettingsResponse},
    };

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        settings: FleetSettings,
    }

    /// Saves the fleet manager's settings on the control plane, as the
    /// logged-in admin. A 400 carries `fields`, a message per invalid field.
    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = FleetSettingsResponse),
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
        permissions.has_admin_permission("hallow.fleet.manage")?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let body = serde_json::json!({
            "settings": data.settings,
            "updated_by": user.username,
        });
        let saved = control_plane
            .send(
                control_plane
                    .request(reqwest::Method::PUT, "/v1/fleet/settings")
                    .json(&body),
            )
            .await?;

        activity_logger
            .log(
                "settings:hallow:fleet.update",
                serde_json::json!({ "settings": body["settings"] }),
            )
            .await;

        ApiResponse::new_serialized(saved).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(put::route))
        .nest("/history", history::router(state))
        .with_state(state.clone())
}
