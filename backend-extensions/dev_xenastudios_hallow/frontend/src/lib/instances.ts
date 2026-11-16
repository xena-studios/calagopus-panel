import type { MantineColor } from '@mantine/core';
import { z } from 'zod';

// The control plane's kinds and instances (crates/proto/src/instance.rs in the Hallow repo), in its
// snake_case like lib/network.ts. Loose objects, so fields a newer control plane adds don't break
// parsing, and a kind's unknown fields go back on save.

export const INSTANCE_STATES = ['creating', 'starting', 'ready', 'ending', 'deleting', 'failed'] as const;
export type InstanceState = (typeof INSTANCE_STATES)[number];

export const instanceInfoSchema = z.looseObject({
  name: z.string(),
  kind: z.string(),
  uuid: z.string(),
  image: z.string(),
  node: z.string(),
  state: z.enum(INSTANCE_STATES).or(z.string()),
  state_since_ms: z.number(),
  created_ms: z.number(),
  address: z.string().nullish(),
  port: z.number().nullish(),
  backend_id: z.string().nullish(),
  players: z.number().default(0),
  had_players: z.boolean().default(false),
  empty_since_ms: z.number().nullish(),
  reason: z.string().nullish(),
});

export const instanceListSchema = z.object({
  instances: z.array(instanceInfoSchema),
  fetched_at_ms: z.number(),
});

export const KIND_ROLES = ['game', 'lobby', 'hub'] as const;

export const kindInfoSchema = z.looseObject({
  name: z.string(),
  image: z.string(),
  role: z.string(),
  lobby: z.string().nullish(),
  players: z.looseObject({ min: z.number().default(1), max: z.number() }),
  scaling: z.looseObject({ warm: z.number().default(0), max_instances: z.number().nullish() }).default({ warm: 0 }),
  env: z.record(z.string(), z.string()).default({}),
  memory_mb: z.number().nullish(),
  updated_by: z.string().nullish(),
  updated_ms: z.number(),
});

export type InstanceInfo = z.infer<typeof instanceInfoSchema>;
export type InstanceList = z.infer<typeof instanceListSchema>;
export type KindInfo = z.infer<typeof kindInfoSchema>;

// What `PUT /api/admin/hallow/kinds/{name}` takes.
export interface KindInput {
  image: string;
  role: string;
  lobby?: string;
  players: { min: number; max: number };
  scaling: { warm: number; max_instances?: number };
  env: Record<string, string>;
  memory_mb?: number;
  [extra: string]: unknown;
}

// Up to 40 lowercase letters, digits and single dashes, starting with a letter: the control plane's rule.
export const KIND_NAME = /^[a-z](?:-?[a-z0-9])*$/;
export const KIND_NAME_MAX = 40;

// The theme's status colours (lib/status.ts): healthy teal, on its way up the Hallow accent, winding
// down amber, gone grey, broken red.
export const INSTANCE_STATE_COLORS: Record<InstanceState, MantineColor> = {
  creating: 'hallow',
  starting: 'hallow',
  ready: 'teal',
  ending: 'yellow',
  deleting: 'gray',
  failed: 'red',
};

// The dot each state uses (app.css's `.hallow-status-dot` statuses).
export const INSTANCE_STATE_DOTS: Record<InstanceState, string> = {
  creating: 'in_game',
  starting: 'in_game',
  ready: 'ready',
  ending: 'draining',
  deleting: 'unknown',
  failed: 'offline',
};

export const INSTANCE_STATE_LABELS: Record<InstanceState, string> = {
  creating: 'Creating',
  starting: 'Starting',
  ready: 'Ready',
  ending: 'Ending',
  deleting: 'Deleting',
  failed: 'Failed',
};

export function knownState(state: string): InstanceState | null {
  return (INSTANCE_STATES as readonly string[]).includes(state) ? (state as InstanceState) : null;
}

// Instances that count against a kind's capacity and may still take players.
export function isLive(state: string): boolean {
  return state === 'creating' || state === 'starting' || state === 'ready';
}

export function countByState(instances: InstanceInfo[]): Record<InstanceState, number> {
  const counts = Object.fromEntries(INSTANCE_STATES.map((state) => [state, 0])) as Record<InstanceState, number>;
  for (const instance of instances) {
    const state = knownState(instance.state);
    if (state) counts[state] += 1;
  }
  return counts;
}
