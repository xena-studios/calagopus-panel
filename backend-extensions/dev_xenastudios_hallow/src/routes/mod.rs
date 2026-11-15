//! Routes under `/api/hallow`, unauthenticated. The file tree mirrors the URL
//! tree, as in the core panel.
//!
//! Staff-only routes (the Network page's proxies, servers and player count from
//! the control plane, #24) belong under `/api/admin/hallow` instead: add them
//! with `builder.add_admin_api_router` in `lib.rs`, so the panel's admin
//! authentication runs first.

use shared::State;
use utoipa_axum::router::OpenApiRouter;

mod health;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/health", health::router(state))
        .with_state(state.clone())
}
