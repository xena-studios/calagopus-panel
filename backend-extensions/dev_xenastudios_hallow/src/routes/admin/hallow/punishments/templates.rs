//! `/api/admin/hallow/punishments/templates`: reason templates staff pick
//! from when punishing (such as "Cheating", a 30-day ban), kept by the
//! control plane at `/v1/punishments/templates`.

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::moderation::{KINDS, check_kind};

/// The body of a create or update; checked by the control plane too, whose
/// 400 names each bad field.
#[derive(utoipa::ToSchema, serde::Deserialize, serde::Serialize)]
pub struct TemplatePayload {
    name: String,
    /// `ban`, `mute`, `kick` or `warn`.
    kind: String,
    /// Bans and mutes only; null is permanent.
    #[serde(default)]
    duration_seconds: Option<u64>,
    reason: String,
}

impl TemplatePayload {
    fn check(&self) -> Result<(), shared::response::ApiResponse> {
        check_kind(&self.kind, KINDS)
    }
}

mod get {
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };

    use crate::{control_plane::ControlPlane, moderation::PunishmentTemplate};

    /// Every template, by name.
    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = Vec<PunishmentTemplate>),
        (status = BAD_GATEWAY, body = shared::ApiError),
        (status = SERVICE_UNAVAILABLE, body = shared::ApiError),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.punishments.read")?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let templates = control_plane
            .send(control_plane.request(reqwest::Method::GET, "/v1/punishments/templates"))
            .await?;

        ApiResponse::new_serialized(templates).ok()
    }
}

mod post {
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };

    use super::TemplatePayload;
    use crate::{control_plane::ControlPlane, moderation::PunishmentTemplate};

    /// Creates a template.
    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = PunishmentTemplate),
        (status = BAD_REQUEST, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
    ), request_body = TemplatePayload)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<TemplatePayload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.punishments.manage")?;
        data.check()?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let saved = control_plane
            .send(
                control_plane
                    .request(reqwest::Method::POST, "/v1/punishments/templates")
                    .json(&data),
            )
            .await?;

        activity_logger
            .log("hallow:punishment-template.create", saved.clone())
            .await;

        ApiResponse::new_serialized(saved).ok()
    }
}

mod put {
    use axum::extract::Path;
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };

    use super::TemplatePayload;
    use crate::{control_plane::ControlPlane, moderation::PunishmentTemplate};

    /// Replaces a template.
    #[utoipa::path(put, path = "/{id}", responses(
        (status = OK, body = PunishmentTemplate),
        (status = BAD_REQUEST, body = shared::ApiError),
        (status = NOT_FOUND, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
    ), params(("id" = i64, Path, description = "The template's id")), request_body = TemplatePayload)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        Path(id): Path<i64>,
        shared::Payload(data): shared::Payload<TemplatePayload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.punishments.manage")?;
        data.check()?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let saved = control_plane
            .send(
                control_plane
                    .request(
                        reqwest::Method::PUT,
                        &format!("/v1/punishments/templates/{id}"),
                    )
                    .json(&data),
            )
            .await?;

        activity_logger
            .log("hallow:punishment-template.update", saved.clone())
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

    /// Deletes a template. Punishments issued from it keep their reason.
    #[utoipa::path(delete, path = "/{id}", responses(
        (status = OK),
        (status = NOT_FOUND, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
    ), params(("id" = i64, Path, description = "The template's id")))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        Path(id): Path<i64>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.punishments.manage")?;

        let control_plane = ControlPlane::from_state(&state).await?;
        control_plane
            .send(control_plane.request(
                reqwest::Method::DELETE,
                &format!("/v1/punishments/templates/{id}"),
            ))
            .await?;

        activity_logger
            .log(
                "hallow:punishment-template.delete",
                serde_json::json!({ "id": id }),
            )
            .await;

        ApiResponse::new_serialized(serde_json::json!({})).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .routes(routes!(put::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
