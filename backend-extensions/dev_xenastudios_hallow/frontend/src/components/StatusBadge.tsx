import Badge from '@/elements/data-display/Badge.tsx';
import { type HallowStatus, STATUS_COLORS, STATUS_LABELS } from '../lib/status.ts';

export default function StatusBadge({ status, label }: { status: HallowStatus; label?: string }) {
  return (
    <Badge
      color={STATUS_COLORS[status]}
      variant='light'
      leftSection={<span className='hallow-status-dot' data-status={status} />}
    >
      {label ?? STATUS_LABELS[status]}
    </Badge>
  );
}
