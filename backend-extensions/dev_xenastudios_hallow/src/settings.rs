//! The extension's own settings, edited on its configuration page
//! (Admin > Extensions > Hallow) and stored by the panel.

use serde::{Deserialize, Serialize};
use shared::extensions::settings::{
    ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
    SettingsSerializer,
};

#[derive(Default, Serialize, Deserialize)]
pub struct HallowSettings {
    /// Base URL of the Hallow control plane, such as `http://10.0.0.2:7000`.
    /// Empty until an admin sets it.
    pub control_plane_url: compact_str::CompactString,
    /// Bearer token for the control plane's API. Stored encrypted.
    pub control_plane_token: compact_str::CompactString,
    /// Base URL of the Prometheus that scrapes the control plane, such as
    /// `http://prometheus:9090`, for the Stats page. Empty turns the charts off.
    pub prometheus_url: compact_str::CompactString,
}

#[async_trait::async_trait]
impl SettingsSerializeExt for HallowSettings {
    async fn serialize(
        &self,
        serializer: SettingsSerializer,
    ) -> Result<SettingsSerializer, anyhow::Error> {
        Ok(serializer
            .write_raw_setting("control_plane_url", self.control_plane_url.clone())
            .write_raw_encrypted_setting("control_plane_token", self.control_plane_token.clone())
            .await?
            .write_raw_setting("prometheus_url", self.prometheus_url.clone()))
    }
}

pub struct HallowSettingsDeserializer;

#[async_trait::async_trait]
impl SettingsDeserializeExt for HallowSettingsDeserializer {
    async fn deserialize_boxed(
        &self,
        mut deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        // Never fail here: an error marks the whole extension as failed to start.
        let control_plane_token = match deserializer
            .read_raw_encrypted_setting("control_plane_token")
            .await
        {
            Ok(token) => token.unwrap_or_default(),
            Err(err) => {
                tracing::warn!("hallow: could not decrypt the control plane token: {err:#}");
                Default::default()
            }
        };

        Ok(Box::new(HallowSettings {
            control_plane_url: deserializer
                .take_raw_setting("control_plane_url")
                .unwrap_or_default(),
            control_plane_token,
            prometheus_url: deserializer
                .take_raw_setting("prometheus_url")
                .unwrap_or_default(),
        }))
    }
}
