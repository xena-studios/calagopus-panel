//! The fleet manager's settings, as the control plane's `/v1/fleet/settings`
//! sends and takes them. Fields the panel doesn't know about are kept in
//! `extra` and sent back on save, so a newer control plane loses nothing.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

type Extra = serde_json::Map<String, serde_json::Value>;

#[derive(ToSchema, Serialize, Deserialize)]
pub struct FleetSettings {
    /// Log what the fleet manager would do without calling providers.
    pub dry_run: bool,
    /// Stop all scaling actions.
    pub paused: bool,
    /// IANA timezone for budget periods, such as `Europe/Berlin`.
    pub timezone: String,
    /// Currency of the budgets, such as `EUR`.
    pub currency: String,
    /// Decimal string; null means no limit.
    pub monthly_budget: Option<String>,
    /// Decimal string; null means no limit.
    pub daily_cap: Option<String>,
    pub max_nodes: u32,
    pub floor_nodes: u32,
    pub headroom_slots: u32,
    /// Share of the budget (0 to 1) from which spare capacity shrinks.
    pub tighten_from: f64,
    // Durations in seconds: 0 to 30 days; `billing_step_margin_secs` is under an hour.
    pub queue_wait_target_secs: i64,
    pub scale_up_after_secs: i64,
    pub scale_down_after_secs: i64,
    pub scale_up_cooldown_secs: i64,
    pub scale_down_cooldown_secs: i64,
    pub drain_deadline_secs: i64,
    pub billing_step_margin_secs: i64,
    pub base_drain_needs_approval: bool,
    /// Drain burst (hourly) nodes before base (monthly) ones when scaling down.
    #[serde(default = "default_true")]
    pub prefer_burst_on_scale_down: bool,
    pub providers: Vec<FleetProvider>,

    #[serde(flatten)]
    #[schema(ignore)]
    pub extra: Extra,
}

#[derive(ToSchema, Serialize, Deserialize)]
pub struct FleetProvider {
    pub name: String,
    pub enabled: bool,
    /// Empty means any region.
    pub regions: Vec<String>,
    /// Empty means any machine type.
    pub machine_types: Vec<String>,

    #[serde(flatten)]
    #[schema(ignore)]
    pub extra: Extra,
}

fn default_true() -> bool {
    true
}

/// `GET /v1/fleet/settings`, passed through as is. Only documents the shape.
#[allow(dead_code)]
#[derive(ToSchema)]
pub struct FleetSettingsResponse {
    pub settings: FleetSettings,
    /// Unix milliseconds; null before the first save.
    pub updated_at: Option<i64>,
    pub updated_by: Option<String>,
}

/// One entry of `GET /v1/fleet/settings/history`. Only documents the shape.
#[allow(dead_code)]
#[derive(ToSchema)]
pub struct FleetSettingsChange {
    pub id: i64,
    /// Unix milliseconds.
    pub updated_at: i64,
    pub updated_by: String,
    /// Null for the first save.
    pub before: Option<FleetSettings>,
    pub after: FleetSettings,
}
