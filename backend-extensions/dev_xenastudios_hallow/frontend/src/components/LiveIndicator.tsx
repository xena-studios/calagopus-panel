import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group } from '@mantine/core';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';

// The "Live · updated …" pill in a live page's header, with a refresh button.
export default function LiveIndicator({
  at,
  refreshing,
  onRefresh,
}: {
  at?: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <Group gap='xs' wrap='nowrap'>
      <span className='hallow-live' data-active={at !== undefined || undefined}>
        <span className='hallow-status-dot' data-status={at !== undefined ? 'online' : 'unknown'} />
        {at !== undefined ? (
          <span>
            Live · updated <FormattedTimestamp timestamp={at} precise />
          </span>
        ) : (
          <span>Not connected</span>
        )}
      </span>
      <Tooltip label='Refresh now'>
        <ActionIcon variant='subtle' color='gray' onClick={onRefresh} loading={refreshing} aria-label='Refresh now'>
          <FontAwesomeIcon icon={faArrowsRotate} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
