import { z } from 'zod';

// The control plane's network shapes (crates/proto in the Hallow repo), kept in its snake_case like
// lib/fleet.ts. Loose objects, so fields a newer control plane adds don't break parsing.

export const proxyInfoSchema = z.looseObject({
  id: z.string(),
  address: z.string(),
  version: z.string(),
  players: z.number(),
  draining: z.boolean(),
  last_heartbeat_ms: z.number(),
});

export const serverStateSchema = z.enum(['ready', 'in_game', 'draining']).or(z.string());

export const serverInfoSchema = z.looseObject({
  name: z.string(),
  kind: z.string(),
  version: z.string(),
  role: z.string(),
  address: z.string(),
  max_players: z.number(),
  players: z.number(),
  state: serverStateSchema,
  tick_ms: z.number().nullish(),
});

export const networkCountSchema = z.looseObject({
  online: z.number(),
  max: z.number(),
});

export const networkOverviewSchema = z.object({
  proxies: z.array(proxyInfoSchema),
  servers: z.array(serverInfoSchema),
  count: networkCountSchema,
  fetched_at_ms: z.number(),
});

export const playerLocationSchema = z.looseObject({
  uuid: z.string(),
  username: z.string(),
  proxy: z.string(),
  server: z.string().nullable(),
});

export const punishmentRecordSchema = z.looseObject({
  id: z.number(),
  kind: z.string(),
  reason: z.string(),
  issuer: z.string(),
  created_ms: z.number(),
  expires_ms: z.number().nullable(),
  active: z.boolean(),
});

export const signalRecordSchema = z.looseObject({
  source: z.string(),
  at_ms: z.number(),
  window_ms: z.number(),
  protocol: z.number().nullable(),
  metrics: z.record(z.string(), z.number()),
});

export type ProxyInfo = z.infer<typeof proxyInfoSchema>;
export type ServerInfo = z.infer<typeof serverInfoSchema>;
export type NetworkOverview = z.infer<typeof networkOverviewSchema>;
export type PlayerLocation = z.infer<typeof playerLocationSchema>;
export type PunishmentRecord = z.infer<typeof punishmentRecordSchema>;
export type SignalRecord = z.infer<typeof signalRecordSchema>;

// Proxies heartbeat every 5 s and drop after three misses; past this the row is shown as stale.
export const PROXY_STALE_MS = 10_000;

export const SERVER_STATE_LABELS: Record<string, string> = {
  ready: 'Ready',
  in_game: 'In game',
  draining: 'Draining',
};

export const PUNISHMENT_KIND_LABELS: Record<string, string> = {
  ban: 'Ban',
  mute: 'Mute',
  kick: 'Kick',
  warn: 'Warning',
};

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function formatMetric(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

export function protocolLabel(protocol: number | null): string {
  return protocol === null ? 'Bedrock' : `Java ${protocol}`;
}
