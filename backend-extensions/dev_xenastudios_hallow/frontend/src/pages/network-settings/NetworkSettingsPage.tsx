import { faCircleCheck, faGlobe, faPlug } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import getNetwork from '../../api/network/getNetwork.ts';
import ComingNext from '../../components/ComingNext.tsx';
import ControlPlaneError from '../../components/ControlPlaneError.tsx';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';
import ConfigurationPage from '../configuration/ConfigurationPage.tsx';

function ConnectionStatus() {
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: hallowQueryKeys.network(),
    queryFn: getNetwork,
    retry: false,
  });

  return (
    <TitleCard title='Connection' icon={<FontAwesomeIcon icon={faPlug} />}>
      {isLoading ? (
        <Spinner.Centered />
      ) : error ? (
        <ControlPlaneError error={error} onRetry={refetch} retrying={isFetching} />
      ) : data ? (
        <Group gap='sm' wrap='nowrap'>
          <FontAwesomeIcon icon={faCircleCheck} size='xl' className='text-(--mantine-color-teal-text)' />
          <div>
            <Text fw={600}>Connected to the control plane</Text>
            <Text size='sm' c='dimmed'>
              {data.proxies.length} {data.proxies.length === 1 ? 'proxy' : 'proxies'}, {data.servers.length}{' '}
              {data.servers.length === 1 ? 'server' : 'servers'} and {data.count.online} of {data.count.max} players
              online.
            </Text>
          </div>
        </Group>
      ) : null}
    </TitleCard>
  );
}

export default function NetworkSettingsPage() {
  return (
    <AdminContentContainer title='Network settings' subtitle='How the panel reaches the network, and network-wide rules.'>
      <Stack gap='lg'>
        <div className='grid gap-4 xl:grid-cols-2 items-start'>
          <AdminCan action='extensions.read'>
            <ConfigurationPage />
          </AdminCan>
          <ConnectionStatus />
        </div>
        <ComingNext
          icon={faGlobe}
          title='Network rules'
          today={[
            'The player cap and network admins are set in the control plane’s configuration',
            'Fleet scaling and budgets are on Fleet settings',
          ]}
          next={[
            'Player cap and maintenance mode, changed live',
            'Server list message (MOTD) and icon',
            'Enable or disable a game, and matchmaker settings per game',
          ]}
        >
          The control plane has no API for network-wide settings yet. They will move here as it gains one.
        </ComingNext>
      </Stack>
    </AdminContentContainer>
  );
}
