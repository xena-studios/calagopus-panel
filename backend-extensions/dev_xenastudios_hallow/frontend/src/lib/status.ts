import type { MantineColor } from '@mantine/core';

// One colour per status across every Hallow page: healthy is teal, winding down is amber,
// down is red, busy (a match running) is the Hallow accent.
export type HallowStatus = 'online' | 'ready' | 'in_game' | 'draining' | 'stale' | 'offline' | 'unknown';

export const STATUS_COLORS: Record<HallowStatus, MantineColor> = {
  online: 'teal',
  ready: 'teal',
  in_game: 'hallow',
  draining: 'yellow',
  stale: 'orange',
  offline: 'red',
  unknown: 'gray',
};

export const STATUS_LABELS: Record<HallowStatus, string> = {
  online: 'Online',
  ready: 'Ready',
  in_game: 'In game',
  draining: 'Draining',
  stale: 'Stale',
  offline: 'Offline',
  unknown: 'Unknown',
};

export function serverStatus(state: string): HallowStatus {
  return state === 'ready' || state === 'in_game' || state === 'draining' ? state : 'unknown';
}
