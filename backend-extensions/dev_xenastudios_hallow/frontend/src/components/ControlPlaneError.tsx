import { faPlugCircleExclamation, faRotateRight, faSliders } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group } from '@mantine/core';
import { Link } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';

export function errorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

export const NETWORK_SETTINGS_PATH = '/admin/hallow/network-settings';

// What every control-plane-backed page shows when it can't get data: 503 means the panel has no
// URL or token yet, 502 means the control plane didn't answer (or refused the token).
export default function ControlPlaneError({
  error,
  onRetry,
  retrying,
}: {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const status = errorStatus(error);

  if (status === 503) {
    return (
      <Alert color='yellow' icon={<FontAwesomeIcon icon={faSliders} />} title='Control plane not configured'>
        The panel needs the Hallow control plane&apos;s URL and token before it can show the network.
        <Group mt='sm'>
          <Link to={NETWORK_SETTINGS_PATH}>
            <Button variant='default' size='xs'>
              Connect the control plane
            </Button>
          </Link>
        </Group>
      </Alert>
    );
  }

  if (status === 502) {
    return (
      <Alert color='red' icon={<FontAwesomeIcon icon={faPlugCircleExclamation} />} title='Control plane unreachable'>
        {httpErrorToHuman(error)}
        <Group mt='sm' gap='xs'>
          {onRetry && (
            <Button
              variant='default'
              size='xs'
              loading={retrying}
              leftSection={<FontAwesomeIcon icon={faRotateRight} />}
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
          <Link to={NETWORK_SETTINGS_PATH}>
            <Button variant='subtle' size='xs'>
              Check the connection
            </Button>
          </Link>
        </Group>
      </Alert>
    );
  }

  return <ErrorState error={httpErrorToHuman(error)} onRetry={onRetry} retrying={retrying} />;
}
