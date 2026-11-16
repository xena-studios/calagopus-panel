import Badge from '@/elements/data-display/Badge.tsx';
import { INSTANCE_STATE_COLORS, INSTANCE_STATE_DOTS, INSTANCE_STATE_LABELS, knownState } from '../lib/instances.ts';

// An instance's state in the theme's status colours, like StatusBadge.
export default function InstanceStateBadge({ state }: { state: string }) {
  const known = knownState(state);

  return (
    <Badge
      color={known ? INSTANCE_STATE_COLORS[known] : 'gray'}
      variant='light'
      leftSection={<span className='hallow-status-dot' data-status={known ? INSTANCE_STATE_DOTS[known] : 'unknown'} />}
    >
      {known ? INSTANCE_STATE_LABELS[known] : state}
    </Badge>
  );
}
