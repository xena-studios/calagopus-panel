//! `/api/admin/hallow/reports`: player reports made in game with `/report`,
//! kept by the control plane at `/v1/reports`.
//!
//! - `GET /?status=&target=&page=&per_page=`: the queue, newest first.
//! - `GET /{id}`: one report.
//! - `POST /{id}/claim`, `/{id}/unclaim`: take a report, or hand it back.
//! - `POST /{id}/resolve` (`note`, `punishment_id`), `/{id}/dismiss` (`note`):
//!   close it, as the logged-in staff member.

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

/// `open`, `claimed`, `resolved`, `dismissed`, or `active` (open or claimed).
const STATUSES: &[&str] = &["open", "claimed", "resolved", "dismissed", "active"];

mod get {
    use axum::extract::Query;
    use serde::Deserialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::IntoParams;

    use crate::{control_plane::ControlPlane, moderation::check_kind, network::player_name};

    #[derive(Deserialize, IntoParams)]
    pub struct Params {
        /// `open`, `claimed`, `resolved`, `dismissed` or `active`; every report if left out.
        status: Option<String>,
        /// Only reports against this player, by username.
        target: Option<String>,
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

    /// Reports, newest first, with `total` for paging.
    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = serde_json::Value),
        (status = BAD_REQUEST, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
        (status = SERVICE_UNAVAILABLE, body = shared::ApiError),
    ), params(Params))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.reports.read")?;
        if let Some(status) = &params.status {
            check_kind(status, super::STATUSES)?;
        }
        let target = match params.target.as_deref().map(str::trim) {
            Some(name) if !name.is_empty() => Some(player_name(name)?),
            _ => None,
        };
        let page = params.page.max(1);
        let per_page = params.per_page.clamp(1, 100);

        let mut query: Vec<(&str, String)> = vec![
            ("limit", per_page.to_string()),
            ("offset", ((page - 1).saturating_mul(per_page)).to_string()),
        ];
        if let Some(status) = &params.status {
            query.push(("status", status.clone()));
        }
        if let Some(target) = target {
            query.push(("target", target.to_string()));
        }

        let control_plane = ControlPlane::from_state(&state).await?;
        let found = control_plane
            .send_optional(
                control_plane
                    .request(reqwest::Method::GET, "/v1/reports")
                    .query(&query),
            )
            .await?;

        // A 404 here means the target never joined.
        let (known, reports) = match found {
            Some(reports) => (true, reports),
            None => (false, serde_json::json!({ "reports": [], "total": 0 })),
        };

        ApiResponse::new_serialized(serde_json::json!({
            "known": known,
            "page": page,
            "per_page": per_page,
            "reports": reports.get("reports").cloned().unwrap_or_else(|| serde_json::json!([])),
            "total": reports.get("total").cloned().unwrap_or_else(|| 0.into()),
        }))
        .ok()
    }
}

mod get_one {
    use axum::extract::Path;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };

    use crate::control_plane::ControlPlane;

    /// One report.
    #[utoipa::path(get, path = "/{id}", responses(
        (status = OK, body = serde_json::Value),
        (status = NOT_FOUND, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
    ), params(("id" = i64, Path, description = "The report's id")))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Path(id): Path<i64>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.reports.read")?;

        let control_plane = ControlPlane::from_state(&state).await?;
        let report = control_plane
            .send(control_plane.request(reqwest::Method::GET, &format!("/v1/reports/{id}")))
            .await?;

        ApiResponse::new_serialized(report).ok()
    }
}

mod action {
    use axum::extract::Path;
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

    use crate::{control_plane::ControlPlane, moderation::staff};

    #[derive(Deserialize, ToSchema)]
    pub struct Payload {
        /// What staff found or did; shown in the report's history. Up to 256 characters.
        #[serde(default)]
        note: Option<String>,
        /// Resolve only: the punishment given for it, which must target the reported player.
        #[serde(default)]
        punishment_id: Option<i64>,
    }

    const ACTIONS: &[&str] = &["claim", "unclaim", "resolve", "dismiss"];

    /// Claims, unclaims, resolves or dismisses a report as the logged-in
    /// staff member. A closed report answers 409.
    #[utoipa::path(post, path = "/{id}/{action}", responses(
        (status = OK, body = serde_json::Value),
        (status = BAD_REQUEST, body = shared::ApiError),
        (status = NOT_FOUND, body = shared::ApiError),
        (status = CONFLICT, body = shared::ApiError),
        (status = BAD_GATEWAY, body = shared::ApiError),
    ), params(
        ("id" = i64, Path, description = "The report's id"),
        ("action" = String, Path, description = "`claim`, `unclaim`, `resolve` or `dismiss`"),
    ), request_body = Payload)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetAdminActivityLogger,
        Path((id, action)): Path<(i64, String)>,
        shared::Payload(payload): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.reports.manage")?;
        if !ACTIONS.contains(&action.as_str()) {
            return ApiResponse::error("action: must be claim, unclaim, resolve or dismiss")
                .with_status(axum::http::StatusCode::NOT_FOUND)
                .ok();
        }
        let note = payload
            .note
            .as_deref()
            .map(str::trim)
            .filter(|n| !n.is_empty());
        if note.is_some_and(|n| n.chars().count() > 256) {
            return ApiResponse::error("note: at most 256 characters").ok();
        }

        let mut body = serde_json::json!({ "staff": staff(&user) });
        if let Some(note) = note {
            body["note"] = note.into();
        }
        if action == "resolve"
            && let Some(punishment_id) = payload.punishment_id
        {
            body["punishment_id"] = punishment_id.into();
        }

        let control_plane = ControlPlane::from_state(&state).await?;
        let report = control_plane
            .send(
                control_plane
                    .request(reqwest::Method::POST, &format!("/v1/reports/{id}/{action}"))
                    .json(&body),
            )
            .await?;

        activity_logger
            .log(
                format!("hallow:report.{action}"),
                serde_json::json!({ "id": id, "note": note, "punishment_id": payload.punishment_id }),
            )
            .await;

        ApiResponse::new_serialized(report).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(get_one::route))
        .routes(routes!(action::route))
        .with_state(state.clone())
}
