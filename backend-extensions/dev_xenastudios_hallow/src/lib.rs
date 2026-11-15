//! Hallow's extension for the Calagopus Panel. Every Hallow feature lives
//! here, not in core files (see `panel/HALLOW-CHANGES.md` in the Hallow repo).

use shared::{
    State,
    extensions::{Extension, ExtensionRouteBuilder},
};

mod routes;

/// Package name, also the namespace for this extension's settings and calls.
pub const PACKAGE_NAME: &str = "dev.xenastudios.hallow";

#[derive(Default)]
pub struct ExtensionStruct;

#[async_trait::async_trait]
impl Extension for ExtensionStruct {
    async fn initialize(&mut self, _state: State) {
        tracing::info!("hallow extension loaded");
    }

    async fn initialize_router(
        &mut self,
        state: State,
        builder: ExtensionRouteBuilder,
    ) -> ExtensionRouteBuilder {
        builder.add_global_router(|router| router.nest("/api/hallow", routes::router(&state)))
    }
}
