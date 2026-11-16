//! Hallow's extension for the Calagopus Panel. Every Hallow feature lives
//! here, not in core files (see `panel/HALLOW-CHANGES.md` in the Hallow repo).

use indexmap::IndexMap;
use shared::{
    State,
    extensions::{
        Extension, ExtensionPermissionsBuilder, ExtensionRouteBuilder,
        settings::ExtensionSettingsDeserializer,
    },
    permissions::PermissionGroup,
};
use std::sync::Arc;

mod control_plane;
mod fleet;
mod moderation;
mod network;
mod routes;
mod settings;

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
        builder
            .add_global_router(|router| router.nest("/api/hallow", routes::router(&state)))
            .add_admin_api_router(|router| router.merge(routes::admin::router(&state)))
    }

    /// Admin permissions, all in one `hallow` group, so they read as
    /// `hallow.<area>.<action>`.
    async fn initialize_permissions(
        &mut self,
        _state: State,
        builder: ExtensionPermissionsBuilder,
    ) -> ExtensionPermissionsBuilder {
        builder.add_admin_permission_group(
            "hallow",
            PermissionGroup {
                description: "Hallow network features: the network overview, players, punishments, ranks, anticheat and the fleet manager.",
                permissions: IndexMap::from([
                    (
                        "network.read",
                        "Allows viewing the network overview: proxies, servers and the player count.",
                    ),
                    ("players.read", "Allows looking players up by name and seeing where they are."),
                    (
                        "punishments.read",
                        "Allows viewing punishments: players' history, the network-wide list and the reason templates.",
                    ),
                    (
                        "punishments.manage",
                        "Allows banning, muting, kicking and warning players, lifting bans and mutes, and editing reason templates.",
                    ),
                    ("ranks.read", "Allows viewing Hallow ranks, their permission nodes and players' ranks."),
                    (
                        "ranks.manage",
                        "Allows creating, editing and deleting Hallow ranks, and giving or taking them from players.",
                    ),
                    ("anticheat.read", "Allows viewing players' anticheat signals."),
                    ("fleet.read", "Allows viewing the fleet manager's settings and their history."),
                    (
                        "fleet.manage",
                        "Allows changing the fleet manager's settings: dry run, pause, budgets, capacity, timing and providers.",
                    ),
                ]),
            },
        )
    }

    async fn settings_deserializer(&self, _state: State) -> ExtensionSettingsDeserializer {
        Arc::new(settings::HallowSettingsDeserializer)
    }
}
