#![allow(clippy::default_constructed_unit_structs)]
#![allow(unused_imports)]

use shared::extensions::{ConstructedExtension, distr::MetadataToml};
use std::sync::Arc;

pub fn list() -> Vec<ConstructedExtension> {
    vec![
        ConstructedExtension {
            metadata_toml: MetadataToml {
                package_name: "dev.xenastudios.hallow".to_string(),
                name: "Hallow".to_string(),
                panel_version: semver::VersionReq::parse(">=1.2.10").unwrap(),
                license_text: None,
            },
            package_name: "dev.xenastudios.hallow",
            description: "Hallow network features for the Hallow Panel: network, players, punishments and staff.",
            authors: &["Xena Studios"],
            version: semver::Version::parse("0.1.0").unwrap(),
            extension: Arc::new(dev_xenastudios_hallow::ExtensionStruct::default()),
        },
    ]
}
