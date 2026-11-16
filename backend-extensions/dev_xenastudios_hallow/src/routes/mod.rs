//! Routes. The file tree mirrors the URL tree, as in the core panel.
//!
//! - `/api/hallow` (this module): public, unauthenticated.
//! - `/api/admin/...` ([`admin`]): staff only. The panel's admin
//!   authentication runs first; each handler checks its own permission.

use shared::State;
use utoipa_axum::router::OpenApiRouter;

pub mod admin;
mod health;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/health", health::router(state))
        .with_state(state.clone())
}
