//! `GET`/`PUT /api/admin/extensions/dev.xenastudios.hallow/settings`: the
//! control plane URL and token, edited on the extension's configuration page.
//! The token is never sent back, only whether one is set.

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    use crate::settings::HallowSettings;

    #[derive(ToSchema, Serialize)]
    struct Settings {
        control_plane_url: compact_str::CompactString,
        control_plane_token_set: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        settings: Settings,
    }

    /// The Hallow extension's settings.
    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("extensions.read")?;

        let settings = state.settings.get().await?;
        let hallow: &HallowSettings = settings.find_extension_settings()?;

        ApiResponse::new_serialized(Response {
            settings: Settings {
                control_plane_url: hallow.control_plane_url.clone(),
                control_plane_token_set: !hallow.control_plane_token.is_empty(),
            },
        })
        .ok()
    }
}

mod put {
    use serde::{Deserialize, Serialize};
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    use crate::settings::HallowSettings;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        /// Base URL of the control plane (http or https). Empty clears it.
        #[schema(max_length = 255)]
        control_plane_url: Option<compact_str::CompactString>,
        /// New bearer token. Leave out to keep the current one; empty clears it.
        #[schema(max_length = 1024)]
        control_plane_token: Option<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    /// Updates the Hallow extension's settings.
    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = shared::ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        let url = data
            .control_plane_url
            .map(|url| compact_str::CompactString::from(url.trim().trim_end_matches('/')));

        if let Some(url) = url.as_deref().filter(|url| !url.is_empty()) {
            if url.len() > 255 {
                return ApiResponse::error("control_plane_url: must be at most 255 characters")
                    .ok();
            }
            match reqwest::Url::parse(url) {
                Ok(parsed) if matches!(parsed.scheme(), "http" | "https") => {}
                _ => {
                    return ApiResponse::error(
                        "control_plane_url: must be an http:// or https:// URL",
                    )
                    .ok();
                }
            }
        }
        if data
            .control_plane_token
            .as_ref()
            .is_some_and(|token| token.len() > 1024)
        {
            return ApiResponse::error("control_plane_token: must be at most 1024 characters").ok();
        }

        permissions.has_admin_permission("extensions.manage")?;

        let token_changed = data.control_plane_token.is_some();
        let saved_url = {
            let mut settings = state.settings.get_mut().await?;
            let hallow: &mut HallowSettings = settings.find_mut_extension_settings()?;

            if let Some(url) = url {
                hallow.control_plane_url = url;
            }
            if let Some(token) = data.control_plane_token {
                hallow.control_plane_token = token.trim().into();
            }
            let saved_url = hallow.control_plane_url.clone();

            settings.save().await?;
            saved_url
        };

        activity_logger
            .log(
                "settings:extensions:update",
                serde_json::json!({
                    "extension": crate::PACKAGE_NAME,
                    "control_plane_url": saved_url,
                    "control_plane_token_changed": token_changed,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(put::route))
        .with_state(state.clone())
}
