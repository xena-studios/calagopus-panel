//! Server kinds and the instances the control plane runs of them
//! (`crates/proto/src/instance.rs` and docs/INSTANCES.md in the Hallow repo).
//! The routes pass the control plane's JSON through untouched; these shapes
//! document it, and [`KindSpec`] is what the panel sends on a save.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use utoipa::ToSchema;

type Extra = serde_json::Map<String, serde_json::Value>;

/// `hallow.toml`'s `[players]`.
#[derive(ToSchema, Serialize, Deserialize)]
pub struct KindPlayers {
    /// Players needed to start a match. Default 1.
    #[serde(default = "one")]
    pub min: u32,
    /// Players per instance.
    pub max: u32,
}

/// `hallow.toml`'s `[scaling]`.
#[derive(ToSchema, Serialize, Deserialize, Default)]
pub struct KindScaling {
    /// Unused instances kept ready while players are online.
    #[serde(default)]
    pub warm: u32,
    /// The most instances of the kind at once; null means no limit.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_instances: Option<u32>,
}

fn one() -> u32 {
    1
}

/// `PUT /v1/kinds/{name}`: the kind's image and how it scales. Fields the
/// panel doesn't know about are kept in `extra` and sent on.
#[derive(ToSchema, Serialize, Deserialize)]
pub struct KindSpec {
    /// The image new instances run, such as `ghcr.io/xena-studios/skywars:1.4.0`.
    pub image: String,
    /// `hub`, `lobby` or `game`.
    pub role: String,
    /// The kind players return to when a game ends.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lobby: Option<String>,
    pub players: KindPlayers,
    #[serde(default)]
    pub scaling: KindScaling,
    /// Extra environment for every instance; `HALLOW_*` names are refused.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub env: BTreeMap<String, String>,
    /// Memory limit per instance in MiB. Default 1024.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memory_mb: Option<u32>,

    #[serde(flatten)]
    #[schema(ignore)]
    pub extra: Extra,
}

/// One entry of `GET /v1/kinds`. Only documents the shape.
#[allow(dead_code)]
#[derive(ToSchema)]
pub struct KindInfo {
    pub name: String,
    #[schema(inline)]
    pub spec: KindSpec,
    pub updated_by: Option<String>,
    /// Unix milliseconds.
    pub updated_ms: u64,
}

/// One entry of `GET /v1/instances`. Only documents the shape.
#[allow(dead_code)]
#[derive(ToSchema)]
pub struct InstanceInfo {
    /// `<kind>-<6 hex>`; also its server's name.
    pub name: String,
    pub kind: String,
    pub uuid: String,
    pub image: String,
    pub node: String,
    /// `creating`, `starting`, `ready`, `ending`, `deleting` or `failed`.
    pub state: String,
    /// Unix milliseconds.
    pub state_since_ms: u64,
    /// Unix milliseconds.
    pub created_ms: u64,
    pub address: Option<String>,
    pub port: Option<u16>,
    pub backend_id: Option<String>,
    pub players: u32,
    pub had_players: bool,
    pub empty_since_ms: Option<u64>,
    /// Why it is ending, or the last orchestrator error.
    pub reason: Option<String>,
}

/// Kind names, as the control plane checks them: up to 40 lowercase letters,
/// digits and single dashes, starting with a letter. Instance names are a kind
/// name plus `-<6 hex>`, so `max` is 47 for them.
pub fn checked_name(name: &str, max: usize) -> Result<&str, shared::response::ApiResponse> {
    let bytes = name.as_bytes();
    let ok = !name.is_empty()
        && name.len() <= max
        && bytes[0].is_ascii_lowercase()
        && !name.ends_with('-')
        && !name.contains("--")
        && bytes
            .iter()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || *b == b'-');
    if ok {
        Ok(name)
    } else {
        Err(shared::response::ApiResponse::error(
            "name: must be lowercase letters, digits and single dashes, starting with a letter",
        ))
    }
}
