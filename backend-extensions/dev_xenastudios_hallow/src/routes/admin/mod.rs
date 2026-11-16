//! Routes under `/api/admin`, mounted with `builder.add_admin_api_router`.
//!
//! - `/api/admin/hallow/...`: Hallow pages (Fleet settings; the Network page's
//!   proxies, servers and player count come here too, #24).
//! - `/api/admin/extensions/dev.xenastudios.hallow/...`: the extension's own
//!   configuration page.

use shared::State;
use utoipa_axum::router::OpenApiRouter;

mod extensions;
mod hallow;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/hallow", hallow::router(state))
        .nest("/extensions", extensions::router(state))
        .with_state(state.clone())
}
