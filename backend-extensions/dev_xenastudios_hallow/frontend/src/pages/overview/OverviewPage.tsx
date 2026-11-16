import {
  faDoorOpen,
  faNetworkWired,
  faServer,
  faTowerBroadcast,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import getNetwork from '../../api/network/getNetwork.ts';
import ControlPlaneError from '../../components/ControlPlaneError.tsx';
import LiveIndicator from '../../components/LiveIndicator.tsx';
import MetricCard from '../../components/MetricCard.tsx';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';
import InstancesSummary from './InstancesSummary.tsx';
import ProxyTable from './ProxyTable.tsx';
import ServerTable from './ServerTable.tsx';

const REFRESH_MS = 5_000;

// Admin landing page: network health from the control plane, refreshed every few seconds.
export default function OverviewPage() {
  const { data, error, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: hallowQueryKeys.network(),
    queryFn: getNetwork,
    refetchInterval: REFRESH_MS,
    retry: false,
  });

  const proxies = data?.proxies ?? [];
  const servers = data?.servers ?? [];
  const drainingProxies = proxies.filter((proxy) => proxy.draining).length;
  const drainingServers = servers.filter((server) => server.state === 'draining').length;
  const readyServers = servers.filter((server) => server.state === 'ready').length;
  const inGameServers = servers.filter((server) => server.state === 'in_game').length;
  const lobbies = servers.filter((server) => server.role === 'lobby').length;
  const online = data?.count.online ?? 0;
  const max = data?.count.max ?? 0;
  const loading = isLoading && !data;
  // Show the last good numbers while a refresh fails, with the error above them.
  const stale = !!error && !!data;

  return (
    <AdminContentContainer
      title='Overview'
      subtitle='Live health of the Hallow network: players, instances, proxies and servers.'
      contentRight={
        <LiveIndicator at={data && !error ? dataUpdatedAt : undefined} refreshing={isFetching} onRefresh={refetch} />
      }
    >
      <Stack gap='lg'>
        {error && <ControlPlaneError error={error} onRetry={refetch} retrying={isFetching} />}

        {(data || loading) && (
          <>
            <div className={stale ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                <MetricCard
                  icon={faUsers}
                  label='Players online'
                  value={online.toLocaleString()}
                  suffix={max > 0 ? ` / ${max.toLocaleString()}` : undefined}
                  progress={max > 0 ? (online / max) * 100 : null}
                  hint={max > 0 ? `${Math.round((online / max) * 100)}% of the network's capacity` : 'No player cap set'}
                  loading={loading}
                />
                <MetricCard
                  icon={faTowerBroadcast}
                  label='Proxies'
                  value={proxies.length}
                  color={proxies.length === 0 ? 'red' : 'teal'}
                  hint={
                    proxies.length === 0
                      ? 'No proxy is registered: nobody can join'
                      : `${proxies.length - drainingProxies} taking players`
                  }
                  loading={loading}
                />
                <MetricCard
                  icon={faServer}
                  label='Servers'
                  value={servers.length}
                  color='hallow'
                  hint={`${readyServers} ready · ${inGameServers} in game · ${lobbies} ${lobbies === 1 ? 'lobby' : 'lobbies'}`}
                  loading={loading}
                />
                <MetricCard
                  icon={faDoorOpen}
                  label='Draining'
                  value={drainingProxies + drainingServers}
                  color={drainingProxies + drainingServers > 0 ? 'yellow' : 'gray'}
                  hint={`${drainingProxies} ${drainingProxies === 1 ? 'proxy' : 'proxies'} · ${drainingServers} ${
                    drainingServers === 1 ? 'server' : 'servers'
                  }`}
                  loading={loading}
                />
              </div>
            </div>

            <InstancesSummary />

            <section>
              <Group justify='space-between' mb='xs'>
                <Group gap='xs'>
                  <FontAwesomeIcon icon={faNetworkWired} className='text-(--mantine-color-dimmed)' />
                  <Text fw={650}>Proxies</Text>
                </Group>
                <Text size='xs' c='dimmed'>
                  Vine proxies registered with the control plane
                </Text>
              </Group>
              <ProxyTable proxies={proxies} now={data?.fetched_at_ms ?? 0} loading={loading} />
            </section>

            <section>
              <Group justify='space-between' mb='xs'>
                <Group gap='xs'>
                  <FontAwesomeIcon icon={faServer} className='text-(--mantine-color-dimmed)' />
                  <Text fw={650}>Servers</Text>
                </Group>
                <Text size='xs' c='dimmed'>
                  Lobbies and game instances taking part in the network
                </Text>
              </Group>
              <ServerTable servers={servers} loading={loading} />
            </section>
          </>
        )}
      </Stack>
    </AdminContentContainer>
  );
}
