//! Shared pieces of the moderation routes (punishments, templates, ranks):
//! who the acting staff member is, and turning the control plane's chat
//! replies into panel answers. Shapes for the OpenAPI docs only, as in
//! [`crate::network`].
#![allow(dead_code)]

use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use shared::{models::user::User, response::ApiResponse};
use utoipa::ToSchema;

/// The panel user as the control plane records them: their username, shown
/// as the issuer, and their id for the audit trail.
pub fn staff(user: &User) -> serde_json::Value {
    serde_json::json!({
        "name": user.username,
        "panel_user": user.uuid.to_string(),
    })
}

/// Drops legacy `§` colour codes (the code and the character after it).
pub fn plain(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars();
    while let Some(c) = chars.next() {
        if c == '§' {
            chars.next();
        } else {
            out.push(c);
        }
    }
    out
}

/// The control plane answers an issue or revoke with `{ok, message, id}`,
/// `ok` false when it refused (already banned, not online...). A refusal
/// becomes a 400 with the message, so the frontend shows it like any error.
pub fn punishment_reply(reply: &serde_json::Value) -> Result<(String, Option<i64>), ApiResponse> {
    let message = plain(
        reply
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or_default(),
    );
    if reply.get("ok").and_then(|ok| ok.as_bool()) == Some(true) {
        Ok((message, reply.get("id").and_then(|id| id.as_i64())))
    } else {
        Err(ApiResponse::error(if message.is_empty() {
            "The control plane refused.".to_string()
        } else {
            message
        })
        .with_status(StatusCode::BAD_REQUEST))
    }
}

/// `ban`, `mute`, `kick` or `warn`.
pub fn check_kind(kind: &str, allowed: &[&str]) -> Result<(), ApiResponse> {
    if allowed.contains(&kind) {
        Ok(())
    } else {
        Err(ApiResponse::error(format!(
            "kind: must be one of {}",
            allowed.join(", ")
        )))
    }
}

pub const KINDS: &[&str] = &["ban", "mute", "kick", "warn"];

/// One line of `GET /v1/punishments/search`.
#[derive(ToSchema)]
pub struct PunishmentEntry {
    pub id: i64,
    /// `ban`, `mute`, `kick` or `warn`.
    pub kind: String,
    pub target: String,
    pub target_name: String,
    pub reason: String,
    pub issuer: String,
    /// `player`, `staff`, `console`, `system` or `anticheat`.
    pub issuer_kind: String,
    pub created_ms: u64,
    pub expires_ms: Option<u64>,
    pub active: bool,
    pub revoked: Option<RevocationInfo>,
}

#[derive(ToSchema)]
pub struct RevocationInfo {
    pub at_ms: u64,
    pub by: String,
    pub by_kind: String,
    pub reason: Option<String>,
}

/// `GET /v1/punishments/search`.
#[derive(ToSchema)]
pub struct PunishmentPage {
    pub total: u64,
    pub entries: Vec<PunishmentEntry>,
}

/// A reason template.
#[derive(ToSchema, Serialize, Deserialize)]
pub struct PunishmentTemplate {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub duration_seconds: Option<u64>,
    pub reason: String,
    pub updated_ms: u64,
}

/// One line of `GET /v1/ranks`.
#[derive(ToSchema)]
pub struct RankInfo {
    pub name: String,
    pub display_prefix: String,
    pub weight: i32,
    pub permissions: Vec<String>,
    pub is_default: bool,
    pub members: u64,
}

#[derive(ToSchema)]
pub struct RankGrant {
    pub rank: String,
    pub granted_ms: u64,
    pub expires_ms: Option<u64>,
}

/// `GET /v1/rank-grants?name=`.
#[derive(ToSchema)]
pub struct PlayerRanks {
    pub uuid: String,
    pub username: String,
    pub grants: Vec<RankGrant>,
    pub ranks: Vec<String>,
    pub permissions: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_colour_codes() {
        assert_eq!(
            plain("§aBanned Steve for 30d 0h: §fCheating"),
            "Banned Steve for 30d 0h: Cheating"
        );
        assert_eq!(plain("plain"), "plain");
        assert_eq!(plain("trailing§"), "trailing");
    }
}
