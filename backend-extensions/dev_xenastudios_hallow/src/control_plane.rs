//! A small client for the Hallow control plane's HTTP API. Browsers never call
//! the control plane: admin routes go through here, with the URL and bearer
//! token from the extension's settings.

use axum::http::StatusCode;
use shared::{State, response::ApiResponse};
use std::time::Duration;

use crate::settings::HallowSettings;

const TIMEOUT: Duration = Duration::from_secs(15);

pub struct ControlPlane {
    client: reqwest::Client,
    base_url: String,
    token: compact_str::CompactString,
}

impl ControlPlane {
    /// Reads the control plane URL and token from the extension's settings.
    /// Answers 503 when either is missing.
    pub async fn from_state(state: &State) -> Result<Self, ApiResponse> {
        let (base_url, token) = {
            let settings = state.settings.get().await?;
            let hallow: &HallowSettings = settings.find_extension_settings()?;

            (
                hallow
                    .control_plane_url
                    .trim()
                    .trim_end_matches('/')
                    .to_string(),
                hallow.control_plane_token.clone(),
            )
        };

        if base_url.is_empty() || token.is_empty() {
            return Err(ApiResponse::error(
                "The Hallow control plane is not configured. Set its URL and token under Admin > Extensions > Hallow.",
            )
            .with_status(StatusCode::SERVICE_UNAVAILABLE));
        }

        Ok(Self {
            client: state.client.clone(),
            base_url,
            token,
        })
    }

    /// Starts a request to `path` (such as `/v1/fleet/settings`) with the bearer token.
    pub fn request(&self, method: reqwest::Method, path: &str) -> reqwest::RequestBuilder {
        self.client
            .request(method, format!("{}{path}", self.base_url))
            .bearer_auth(&self.token)
            .timeout(TIMEOUT)
    }

    /// Sends a request and returns the JSON body of a 2xx answer untouched, so
    /// fields the panel doesn't know about pass through.
    ///
    /// A 400 or 422 keeps its status, with the control plane's `code`,
    /// `message` and `fields`, plus the panel's usual `errors` list so the
    /// frontend's error helpers show the message. Anything else is a 502.
    pub async fn send(
        &self,
        request: reqwest::RequestBuilder,
    ) -> Result<serde_json::Value, ApiResponse> {
        let response = request.send().await.map_err(|err| {
            tracing::warn!("hallow: control plane request failed: {err:#}");
            bad_gateway(format!("Could not reach the Hallow control plane: {err}"))
        })?;

        let status = response.status();
        let bytes = response.bytes().await.map_err(|err| {
            bad_gateway(format!(
                "Could not read the Hallow control plane's answer: {err}"
            ))
        })?;
        let body: Option<serde_json::Value> = serde_json::from_slice(&bytes).ok();

        if status.is_success() {
            return body.ok_or_else(|| {
                bad_gateway(
                    "The Hallow control plane answered with something other than JSON.".into(),
                )
            });
        }

        let message = body
            .as_ref()
            .and_then(|b| b.get("message"))
            .and_then(|m| m.as_str())
            .map(str::to_string);

        match status {
            StatusCode::BAD_REQUEST | StatusCode::UNPROCESSABLE_ENTITY => {
                let body = body.unwrap_or_default();
                let message = message.unwrap_or_else(|| "The control plane rejected the request.".into());

                Err(ApiResponse::new_serialized(serde_json::json!({
                    "errors": [message],
                    "code": body.get("code").cloned().unwrap_or_else(|| "bad_request".into()),
                    "message": message,
                    "fields": body.get("fields").cloned().unwrap_or_else(|| serde_json::json!({})),
                }))
                .with_status(StatusCode::BAD_REQUEST))
            }
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Err(bad_gateway(
                "The Hallow control plane rejected the panel's token. Check it under Admin > Extensions > Hallow.".into(),
            )),
            StatusCode::SERVICE_UNAVAILABLE => Err(bad_gateway(match message {
                Some(message) => format!("The Hallow control plane is unavailable: {message}"),
                None => "The Hallow control plane is unavailable.".into(),
            })),
            StatusCode::NOT_FOUND => Err(bad_gateway(
                "The Hallow control plane does not know this endpoint. Is it up to date?".into(),
            )),
            _ => Err(bad_gateway(match message {
                Some(message) => format!("The Hallow control plane answered {status}: {message}"),
                None => format!("The Hallow control plane answered {status}."),
            })),
        }
    }
}

fn bad_gateway(message: String) -> ApiResponse {
    ApiResponse::error(message).with_status(StatusCode::BAD_GATEWAY)
}
