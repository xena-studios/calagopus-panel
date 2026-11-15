use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::response::{ApiResponse, ApiResponseResult};
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        status: &'static str,
        extension: &'static str,
        version: &'static str,
    }

    /// Answers when the Hallow extension is loaded.
    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route() -> ApiResponseResult {
        ApiResponse::new_serialized(Response {
            status: "ok",
            extension: crate::PACKAGE_NAME,
            version: env!("CARGO_PKG_VERSION"),
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
