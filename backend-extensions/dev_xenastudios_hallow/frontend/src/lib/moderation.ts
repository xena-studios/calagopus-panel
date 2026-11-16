import { z } from 'zod';

// Shapes of the moderation endpoints (crates/proto in the Hallow repo: punishment.rs and rank.rs), in
// the control plane's snake_case. Loose objects, so fields a newer control plane adds don't break parsing.

export const punishmentKindSchema = z.enum(['ban', 'mute', 'kick', 'warn']);
export type PunishmentKind = z.infer<typeof punishmentKindSchema>;

export const revocationSchema = z.looseObject({
  at_ms: z.number(),
  by: z.string(),
  by_kind: z.string(),
  reason: z.string().nullable(),
});

export const punishmentEntrySchema = z.looseObject({
  id: z.number(),
  kind: z.string(),
  target: z.string(),
  target_name: z.string(),
  reason: z.string(),
  issuer: z.string(),
  issuer_kind: z.string(),
  created_ms: z.number(),
  expires_ms: z.number().nullable(),
  active: z.boolean(),
  revoked: revocationSchema.nullable(),
});

export const punishmentSearchSchema = z.object({
  known: z.boolean(),
  page: z.number(),
  per_page: z.number(),
  punishments: z.object({ total: z.number(), entries: z.array(punishmentEntrySchema) }),
});

export const punishmentTemplateSchema = z.looseObject({
  id: z.number(),
  name: z.string(),
  kind: punishmentKindSchema,
  duration_seconds: z.number().nullable(),
  reason: z.string(),
  updated_ms: z.number(),
});

export const rankInfoSchema = z.looseObject({
  name: z.string(),
  display_prefix: z.string(),
  weight: z.number(),
  permissions: z.array(z.string()),
  is_default: z.boolean(),
  members: z.number(),
});

export const playerRanksSchema = z.looseObject({
  uuid: z.string(),
  username: z.string(),
  grants: z.array(z.looseObject({ rank: z.string(), granted_ms: z.number(), expires_ms: z.number().nullable() })),
  ranks: z.array(z.string()),
  permissions: z.array(z.string()),
});

export const punishmentReplySchema = z.object({ message: z.string(), id: z.number().nullable() });

export type PunishmentEntry = z.infer<typeof punishmentEntrySchema>;
export type PunishmentSearchResult = z.infer<typeof punishmentSearchSchema>;
export type PunishmentTemplate = z.infer<typeof punishmentTemplateSchema>;
export type RankInfo = z.infer<typeof rankInfoSchema>;
export type PlayerRanks = z.infer<typeof playerRanksSchema>;
export type PunishmentReply = z.infer<typeof punishmentReplySchema>;

export const LASTING_KINDS: PunishmentKind[] = ['ban', 'mute'];

export function lasts(kind: string): boolean {
  return kind === 'ban' || kind === 'mute';
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Lengths offered for bans, mutes and rank grants; `null` is permanent.
export const DURATION_PRESETS: { label: string; seconds: number | null }[] = [
  { label: '1 hour', seconds: HOUR },
  { label: '6 hours', seconds: 6 * HOUR },
  { label: '1 day', seconds: DAY },
  { label: '3 days', seconds: 3 * DAY },
  { label: '7 days', seconds: 7 * DAY },
  { label: '14 days', seconds: 14 * DAY },
  { label: '30 days', seconds: 30 * DAY },
  { label: '90 days', seconds: 90 * DAY },
  { label: 'Permanent', seconds: null },
];

export const DURATION_UNITS: { value: string; label: string; seconds: number }[] = [
  { value: 'm', label: 'minutes', seconds: MINUTE },
  { value: 'h', label: 'hours', seconds: HOUR },
  { value: 'd', label: 'days', seconds: DAY },
];

// `30d`, `6h`, `90m`, `1d 12h`: the largest units that divide evenly, at most two.
export function formatSeconds(seconds: number | null): string {
  if (seconds === null) return 'Permanent';
  const days = Math.floor(seconds / DAY);
  const hours = Math.floor((seconds % DAY) / HOUR);
  const minutes = Math.floor((seconds % HOUR) / MINUTE);
  const parts = [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`].filter(Boolean);
  return parts.slice(0, 2).join(' ') || `${seconds}s`;
}

// Nodes the database accepts: `*`, or dot-separated lowercase segments, optionally ending in `.*`,
// optionally denied with a leading `-`. Mirrors `hallow_proto::rank::valid_node`.
const NODE = /^-?(\*|[a-z0-9_-]+(\.[a-z0-9_-]+)*(\.\*)?)$/;

export function validNode(node: string): boolean {
  return NODE.test(node);
}

export const RANK_NAME = /^[a-z0-9_-]{1,32}$/;

// In-game permission nodes Hallow's Vine plugin checks (crates/vine-plugin/src/commands.rs).
export const KNOWN_NODES: { node: string; description: string }[] = [
  { node: 'hallow.staff.*', description: 'Every staff command' },
  { node: 'hallow.staff.find', description: '/find: where a player is' },
  { node: 'hallow.staff.alert', description: '/alert: message the whole network' },
  { node: 'hallow.staff.kick', description: '/gkick: disconnect a player' },
  { node: 'hallow.staff.ban', description: '/ban and /unban' },
  { node: 'hallow.staff.mute', description: '/mute and /unmute' },
  { node: 'hallow.staff.warn', description: '/warn' },
  { node: 'hallow.staff.history', description: "/history: a player's punishments" },
];

export const ISSUER_KIND_LABELS: Record<string, string> = {
  player: 'In game',
  staff: 'Panel',
  console: 'Console',
  system: 'System',
  anticheat: 'Anticheat',
};
