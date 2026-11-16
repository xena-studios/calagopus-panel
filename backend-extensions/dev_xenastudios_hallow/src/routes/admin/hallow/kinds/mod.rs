//! `/api/admin/hallow/kinds`: the server kinds the control plane may start
//! (an image plus the scaling part of its `hallow.toml`), kept by the control
//! plane at `/v1/kinds`.
//!
//! - `GET /`: every kind. `PUT`/`DELETE /{name}`: register or replace one, or
//!   remove it (running games finish; no new instances start).

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

/// Kind names are up to 40 characters, as the control plane checks.
const KIND_NAME_MAX: usize = 40;

mod get {
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };

    use crate::{control_plane::ControlPlane, instances::KindInfo};

    /// Every kind, by name.
    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = Vec<KindInfo>),
        (status = BAD_GATEWAY, body = shared::ApiError),
        (status = SERVICE_UNAVAILABLE, body = shared::ApiError),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.kinds.read")?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let kinds = control_plane
            .send(control_plane.request(reqwest::Method::GET, "/v1/kinds"))
            .await?;

        ApiResponse::new_serialized(kinds).ok()
    }
}

mod put {
    use axum::extract::Path;
    use shared::{
        GetState,
        models::{
            admin_activity::GetAdminActivityLogger,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };

    use crate::{
        control_plane::ControlPlane,
        instances::{KindInfo, KindSpec},
    };

    /// Registers the kind or replaces it, as the logged-in admin. New
    /// instances use the new image; running ones keep theirs. A 400 carries
    /// `fields`, a message per invalid field (`players.max`, `env.NAME`, ...).
    #[utoipa::path(put, path = "/{name}", responses(
        (status = OK, body = KindInfo),
        (status = BAD_REQUEST, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
        (status = SERVICE_UNAVAILABLE, body = shared::ApiError),
    ), params(("name" = String, Path, description = "The kind's name")), request_body = KindSpec)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetAdminActivityLogger,
        Path(name): Path<String>,
        shared::Payload(data): shared::Payload<KindSpec>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.kinds.manage")?;
        let name = crate::instances::checked_name(&name, super::KIND_NAME_MAX)?;

        let mut body = serde_json::to_value(&data)?;
        // The control plane takes 1 to 64 characters.
        let updated_by: String = user.username.chars().take(64).collect();
        body["updated_by"] = updated_by.into();

        let control_plane = ControlPlane::from_state(&state).await?;
        let saved = control_plane
            .send(
                control_plane
                    .request(reqwest::Method::PUT, &format!("/v1/kinds/{name}"))
                    .json(&body),
            )
            .await?;

        activity_logger
            .log("hallow:kind.update", saved.clone())
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

    /// Removes a kind: no new instances start, its unused ones end and games
    /// already running finish.
    #[utoipa::path(delete, path = "/{name}", responses(
        (status = OK),
        (status = NOT_FOUND, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
    ), params(("name" = String, Path, description = "The kind's name")))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        Path(name): Path<String>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.kinds.manage")?;
        let name = crate::instances::checked_name(&name, super::KIND_NAME_MAX)?;

        let control_plane = ControlPlane::from_state(&state).await?;
        control_plane
            .send(control_plane.request(reqwest::Method::DELETE, &format!("/v1/kinds/{name}")))
            .await?;

        activity_logger
            .log("hallow:kind.delete", serde_json::json!({ "name": name }))
            .await;

        ApiResponse::new_serialized(serde_json::json!({})).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(put::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
