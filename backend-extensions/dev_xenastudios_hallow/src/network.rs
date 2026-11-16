//! Shapes of the control plane's network endpoints (`crates/proto` in the
//! Hallow repo), for the OpenAPI docs only: the routes pass the JSON through
//! untouched so fields a newer control plane adds still reach the frontend.
#![allow(dead_code)]

use std::collections::BTreeMap;
use utoipa::ToSchema;

/// One entry of `GET /v1/proxies`.
#[derive(ToSchema)]
pub struct ProxyInfo {
    pub id: String,
    pub address: String,
    pub version: String,
    pub players: u32,
    pub draining: bool,
    pub last_heartbeat_ms: u64,
}

/// One entry of `GET /v1/servers`.
#[derive(ToSchema)]
pub struct ServerInfo {
    pub name: String,
    pub kind: String,
    pub version: String,
    /// `lobby` or `game`.
    pub role: String,
    pub address: String,
    pub max_players: u32,
    pub players: u32,
    /// `ready`, `in_game` or `draining`.
    pub state: String,
    pub tick_ms: Option<f32>,
}

/// `GET /v1/presence/count`.
#[derive(ToSchema)]
pub struct NetworkCount {
    pub online: u32,
    pub max: u32,
}

/// `GET /v1/players?name=`.
#[derive(ToSchema)]
pub struct PlayerLocation {
    pub uuid: String,
    pub username: String,
    pub proxy: String,
    /// Null while the player is between servers.
    pub server: Option<String>,
}

/// One line of `GET /v1/punishments?name=`, newest first.
#[derive(ToSchema)]
pub struct PunishmentRecord {
    pub id: i64,
    /// `ban`, `mute`, `kick` or `warn`.
    pub kind: String,
    pub reason: String,
    /// The issuer's username, or `console`, `system` or `anticheat`.
    pub issuer: String,
    pub created_ms: u64,
    pub expires_ms: Option<u64>,
    pub active: bool,
}

/// One sample of `GET /v1/signals?name=`, newest first.
#[derive(ToSchema)]
pub struct SignalRecord {
    pub source: String,
    pub at_ms: u64,
    pub window_ms: u32,
    pub protocol: Option<i32>,
    pub metrics: BTreeMap<String, f64>,
}

/// Checks a player name from a query string: 1 to 32 characters once trimmed
/// (Bedrock names through Geyser carry a prefix and may hold spaces).
pub fn player_name(name: &str) -> Result<&str, shared::response::ApiResponse> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 32 {
        return Err(shared::response::ApiResponse::error(
            "name: must be 1 to 32 characters",
        ));
    }
    Ok(name)
}
