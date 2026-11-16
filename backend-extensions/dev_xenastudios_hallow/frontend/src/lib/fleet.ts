import { z } from 'zod';

// The fleet manager's settings keep the control plane's snake_case keys on the frontend too, and
// skip the panel's camelCase transform helpers on purpose: those drop keys the schema doesn't
// declare, and fields a newer control plane adds must survive a save. Keeping the wire names also
// lets the 400's `fields` map straight onto form paths.

export const fleetProviderSchema = z.looseObject({
  name: z.string(),
  enabled: z.boolean(),
  regions: z.array(z.string()),
  machine_types: z.array(z.string()),
});

export const fleetSettingsSchema = z.looseObject({
  dry_run: z.boolean(),
  paused: z.boolean(),
  timezone: z.string(),
  currency: z.string(),
  monthly_budget: z.string().nullable(),
  daily_cap: z.string().nullable(),
  max_nodes: z.number(),
  floor_nodes: z.number(),
  headroom_slots: z.number(),
  tighten_from: z.number(),
  queue_wait_target_secs: z.number(),
  scale_up_after_secs: z.number(),
  scale_down_after_secs: z.number(),
  scale_up_cooldown_secs: z.number(),
  scale_down_cooldown_secs: z.number(),
  drain_deadline_secs: z.number(),
  billing_step_margin_secs: z.number(),
  base_drain_needs_approval: z.boolean(),
  prefer_burst_on_scale_down: z.boolean().default(true),
  providers: z.array(fleetProviderSchema),
});

export const fleetSettingsResponseSchema = z.object({
  settings: fleetSettingsSchema,
  // Unix milliseconds; null before the first save.
  updated_at: z.number().nullable(),
  updated_by: z.string().nullable(),
});

export const fleetSettingsChangeSchema = z.object({
  id: z.number(),
  // Unix milliseconds.
  updated_at: z.number(),
  updated_by: z.string(),
  before: fleetSettingsSchema.nullable(),
  after: fleetSettingsSchema,
});

export type FleetProvider = z.infer<typeof fleetProviderSchema>;
export type FleetSettings = z.infer<typeof fleetSettingsSchema>;
export type FleetSettingsResponse = z.infer<typeof fleetSettingsResponseSchema>;
export type FleetSettingsChange = z.infer<typeof fleetSettingsChangeSchema>;

export const DURATION_KEYS = [
  'queue_wait_target_secs',
  'scale_up_after_secs',
  'scale_down_after_secs',
  'scale_up_cooldown_secs',
  'scale_down_cooldown_secs',
  'drain_deadline_secs',
  'billing_step_margin_secs',
] as const;

export const FIELD_LABELS: Record<string, string> = {
  dry_run: 'Dry run',
  paused: 'Paused',
  timezone: 'Timezone',
  currency: 'Currency',
  monthly_budget: 'Monthly budget',
  daily_cap: 'Daily cap',
  max_nodes: 'Maximum nodes',
  floor_nodes: 'Floor nodes',
  headroom_slots: 'Headroom slots',
  tighten_from: 'Tighten from',
  queue_wait_target_secs: 'Queue wait target',
  scale_up_after_secs: 'Scale up after',
  scale_down_after_secs: 'Scale down after',
  scale_up_cooldown_secs: 'Scale-up cooldown',
  scale_down_cooldown_secs: 'Scale-down cooldown',
  drain_deadline_secs: 'Drain deadline',
  billing_step_margin_secs: 'Billing step margin',
  base_drain_needs_approval: 'Base drains need approval',
  prefer_burst_on_scale_down: 'Prefer burst nodes on scale-down',
  providers: 'Providers',
  name: 'Name',
  enabled: 'Enabled',
  regions: 'Regions',
  machine_types: 'Machine types',
};

/** Money amounts: up to 6 decimals, as the control plane accepts. */
export const DECIMAL_PATTERN = /^\d+(\.\d{1,6})?$/;
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;
export const MAX_DURATION_SECS = 30 * 24 * 3600;
export const MAX_BILLING_STEP_MARGIN_SECS = 3600;

/** `5400` -> `1h 30m`. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0s';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);

  return [hours && `${hours}h`, minutes && `${minutes}m`, seconds && `${seconds}s`].filter(Boolean).join(' ');
}

/** Formats a value of a settings key for people, for the history view. */
export function formatValue(key: string, value: unknown, currency?: string): string {
  if (value === undefined) return '(unset)';
  if ((key === 'monthly_budget' || key === 'daily_cap') && value === null) return 'no limit';
  if ((key === 'monthly_budget' || key === 'daily_cap') && typeof value === 'string') {
    return currency ? `${value} ${currency}` : value;
  }
  if ((DURATION_KEYS as readonly string[]).includes(key) && typeof value === 'number') return formatDuration(value);
  if (key === 'tighten_from' && typeof value === 'number') return `${Math.round(value * 10000) / 100}%`;
  if ((key === 'regions' || key === 'machine_types') && Array.isArray(value)) {
    return value.length === 0 ? 'any' : value.join(', ');
  }
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);

  return String(value);
}

export interface SettingsDiffEntry {
  /** Human label, such as `Providers > hetzner-cloud > Regions`. */
  label: string;
  key: string;
  before: unknown;
  after: unknown;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function label(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

/** The keys that differ between two settings documents. Providers are compared by name. */
export function diffSettings(before: FleetSettings | null, after: FleetSettings): SettingsDiffEntry[] {
  const entries: SettingsDiffEntry[] = [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);

  for (const key of keys) {
    const a = (before as Record<string, unknown> | null)?.[key];
    const b = (after as Record<string, unknown>)[key];

    if (key === 'providers' && before) {
      entries.push(...diffProviders(before.providers ?? [], after.providers ?? []));
      continue;
    }
    if (!sameValue(a, b)) {
      entries.push({ label: label(key), key, before: a, after: b });
    }
  }

  return entries;
}

function diffProviders(before: FleetProvider[], after: FleetProvider[]): SettingsDiffEntry[] {
  const entries: SettingsDiffEntry[] = [];
  const beforeByName = new Map(before.map((provider) => [provider.name, provider]));
  const afterByName = new Map(after.map((provider) => [provider.name, provider]));

  for (const [name, provider] of afterByName) {
    const old = beforeByName.get(name);
    if (!old) {
      entries.push({ label: `Providers > ${name}`, key: 'provider', before: undefined, after: provider });
      continue;
    }

    const keys = new Set([...Object.keys(old), ...Object.keys(provider)]);
    for (const key of keys) {
      const a = (old as Record<string, unknown>)[key];
      const b = (provider as Record<string, unknown>)[key];
      if (!sameValue(a, b)) {
        entries.push({ label: `Providers > ${name} > ${label(key)}`, key, before: a, after: b });
      }
    }
  }

  for (const [name, provider] of beforeByName) {
    if (!afterByName.has(name)) {
      entries.push({ label: `Providers > ${name}`, key: 'provider', before: provider, after: undefined });
    }
  }

  const beforeOrder = before.map((provider) => provider.name).filter((name) => afterByName.has(name));
  const afterOrder = after.map((provider) => provider.name).filter((name) => beforeByName.has(name));
  if (!sameValue(beforeOrder, afterOrder)) {
    entries.push({ label: 'Providers > order', key: 'providers', before: beforeOrder, after: afterOrder });
  }

  return entries;
}

/**
 * Turns the control plane's `fields` (`providers[0].regions[1]`) into Mantine form paths. An error
 * on one tag (`providers.0.regions.1`) lands on its tag input (`providers.0.regions`), naming the tag.
 */
export function fieldErrorsToFormErrors(
  fields: Record<string, string>,
  values?: FleetSettings,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, message] of Object.entries(fields)) {
    const path = field.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
    const tag = /^(providers\.(\d+)\.(regions|machine_types))\.(\d+)$/.exec(path);

    if (tag) {
      const [, input, provider, list, index] = tag;
      const value = values?.providers[Number(provider)]?.[list as 'regions' | 'machine_types']?.[Number(index)];
      const text = value === undefined ? message : `${value}: ${message}`;
      errors[input] = errors[input] ? `${errors[input]}; ${text}` : text;
    } else {
      errors[path] = message;
    }
  }

  return errors;
}
