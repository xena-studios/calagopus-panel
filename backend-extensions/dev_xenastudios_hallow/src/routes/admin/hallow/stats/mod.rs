//! `GET /api/admin/hallow/stats?range=`: network stats over time for the
//! Stats page, read from the Prometheus that scrapes the control plane
//! (its URL is in the extension's settings).
//!
//! Every control-plane instance serves the same network-wide numbers, so
//! series are combined with `max`, not `sum`.

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::extract::Query;
    use serde::Deserialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use std::{collections::BTreeMap, time::Duration};
    use utoipa::IntoParams;

    use crate::settings::HallowSettings;

    const TIMEOUT: Duration = Duration::from_secs(10);

    #[derive(Deserialize, IntoParams)]
    pub struct Params {
        /// `1h`, `6h`, `24h` or `7d`; `24h` if left out.
        range: Option<String>,
    }

    /// The range in seconds and the step between points.
    fn window(range: &str) -> Option<(u64, u64)> {
        Some(match range {
            "1h" => (3_600, 30),
            "6h" => (6 * 3_600, 120),
            "24h" => (24 * 3_600, 300),
            "7d" => (7 * 24 * 3_600, 1_800),
            _ => return None,
        })
    }

    type Series = Vec<(f64, f64)>;

    struct Prometheus {
        client: reqwest::Client,
        base: String,
        end: f64,
        start: f64,
        step: u64,
    }

    impl Prometheus {
        async fn get(&self, path: &str, query: &[(&str, String)]) -> Result<serde_json::Value, String> {
            let response = self
                .client
                .get(format!("{}{path}", self.base))
                .query(query)
                .timeout(TIMEOUT)
                .send()
                .await
                .map_err(|err| format!("Could not reach Prometheus: {err}"))?;
            let status = response.status();
            let body: serde_json::Value = response
                .json()
                .await
                .map_err(|err| format!("Prometheus answered {status} with something other than JSON: {err}"))?;
            if body.get("status").and_then(|s| s.as_str()) != Some("success") {
                let message = body.get("error").and_then(|e| e.as_str()).unwrap_or("unknown error");
                return Err(format!("Prometheus answered {status}: {message}"));
            }
            Ok(body["data"]["result"].clone())
        }

        /// Each series of a range query, keyed by `label` (or `""`).
        async fn range(&self, query: &str, label: &str) -> Result<BTreeMap<String, Series>, String> {
            let result = self
                .get(
                    "/api/v1/query_range",
                    &[
                        ("query", query.to_string()),
                        ("start", format!("{:.0}", self.start)),
                        ("end", format!("{:.0}", self.end)),
                        ("step", self.step.to_string()),
                    ],
                )
                .await?;
            let mut out = BTreeMap::new();
            for series in result.as_array().into_iter().flatten() {
                let key = series["metric"][label].as_str().unwrap_or_default().to_string();
                let points = series["values"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|point| {
                        let t = point.get(0)?.as_f64()?;
                        let v: f64 = point.get(1)?.as_str()?.parse().ok()?;
                        v.is_finite().then_some((t * 1000.0, v))
                    })
                    .collect();
                out.insert(key, points);
            }
            Ok(out)
        }

        /// Each value of an instant query, keyed by `label` (or `""`).
        async fn instant(&self, query: &str, label: &str) -> Result<BTreeMap<String, f64>, String> {
            let result = self
                .get("/api/v1/query", &[("query", query.to_string()), ("time", format!("{:.0}", self.end))])
                .await?;
            let mut out = BTreeMap::new();
            for series in result.as_array().into_iter().flatten() {
                let key = series["metric"][label].as_str().unwrap_or_default().to_string();
                if let Some(v) = series["value"].get(1).and_then(|v| v.as_str()).and_then(|v| v.parse::<f64>().ok())
                    && v.is_finite()
                {
                    out.insert(key, v);
                }
            }
            Ok(out)
        }
    }

    /// Players online, queue sizes, games started and queue waits by kind,
    /// over the range. `configured` is false when no Prometheus URL is set;
    /// a query that fails is left out and named in `errors`.
    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = serde_json::Value),
        (status = BAD_REQUEST, body = shared::ApiError),
    ), params(Params))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("hallow.network.read")?;
        let range = params.range.unwrap_or_else(|| "24h".into());
        let Some((seconds, step)) = window(&range) else {
            return ApiResponse::error("range: must be 1h, 6h, 24h or 7d").ok();
        };

        let base = {
            let settings = state.settings.get().await?;
            let hallow: &HallowSettings = settings.find_extension_settings()?;
            hallow.prometheus_url.trim().trim_end_matches('/').to_string()
        };
        if base.is_empty() {
            return ApiResponse::new_serialized(serde_json::json!({ "configured": false, "range": range })).ok();
        }

        let end = chrono::Utc::now().timestamp() as f64;
        let prometheus = Prometheus {
            client: state.client.clone(),
            base,
            end,
            start: end - seconds as f64,
            step,
        };
        let window = format!("{seconds}s");
        let step_window = format!("{step}s");

        let (online, capacity, queue, games, games_total, wait_p50, wait_p90) = tokio::join!(
            prometheus.range("max(hallow_players_online)", ""),
            prometheus.instant("max(hallow_players_max)", ""),
            prometheus.range("max by (kind) (hallow_queue_players)", "kind"),
            prometheus.range(
                &format!("max by (kind) (increase(hallow_games_started_total[{step_window}]))"),
                "kind"
            ),
            prometheus.instant(
                &format!("max by (kind) (increase(hallow_games_started_total[{window}]))"),
                "kind"
            ),
            prometheus.instant(
                &format!(
                    "histogram_quantile(0.5, max by (kind, le) (rate(hallow_queue_wait_seconds_bucket[{window}])))"
                ),
                "kind"
            ),
            prometheus.instant(
                &format!(
                    "histogram_quantile(0.9, max by (kind, le) (rate(hallow_queue_wait_seconds_bucket[{window}])))"
                ),
                "kind"
            ),
        );

        let mut errors: Vec<String> = Vec::new();
        let mut take = |result: Result<serde_json::Value, String>| match result {
            Ok(value) => value,
            Err(err) => {
                if !errors.contains(&err) {
                    errors.push(err);
                }
                serde_json::Value::Null
            }
        };
        let json = |v| serde_json::to_value(v).unwrap_or_default();

        let online = take(online.map(|mut s| json(s.remove("").unwrap_or_default())));
        let capacity = take(capacity.map(|s| json(s.get("").copied())));
        let queue = take(queue.map(json));
        let games = take(games.map(json));
        let games_total = take(games_total.map(json));
        let wait_p50 = take(wait_p50.map(json));
        let wait_p90 = take(wait_p90.map(json));

        ApiResponse::new_serialized(serde_json::json!({
            "configured": true,
            "range": range,
            "step_s": step,
            "start_ms": prometheus.start * 1000.0,
            "end_ms": end * 1000.0,
            "online": online,
            "capacity": capacity,
            "queue": queue,
            "games": games,
            "games_total": games_total,
            "queue_wait_p50_s": wait_p50,
            "queue_wait_p90_s": wait_p90,
            "errors": errors,
        }))
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
