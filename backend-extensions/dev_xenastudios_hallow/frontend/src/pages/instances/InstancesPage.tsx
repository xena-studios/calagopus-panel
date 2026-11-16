import { faCircleExclamation, faCubes, faHourglassHalf, faPowerOff, faUsers } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Table, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Select from '@/elements/input/Select.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { endInstance, getInstances } from '../../api/instances.ts';
import ControlPlaneError from '../../components/ControlPlaneError.tsx';
import InstanceStateBadge from '../../components/InstanceStateBadge.tsx';
import LiveIndicator from '../../components/LiveIndicator.tsx';
import MetricCard from '../../components/MetricCard.tsx';
import {
  countByState,
  INSTANCE_STATE_LABELS,
  INSTANCE_STATES,
  type InstanceInfo,
  isLive,
} from '../../lib/instances.ts';
import { formatDuration } from '../../lib/network.ts';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';
import { EmptyRow, SkeletonRows } from '../overview/ProxyTable.tsx';

const REFRESH_MS = 3_000;

// Lifecycle order: the ones taking players first, then those on their way up, then the rest.
const STATE_ORDER: Record<string, number> = { ready: 0, starting: 1, creating: 2, failed: 3, ending: 4, deleting: 5 };

const STATE_FILTERS = [
  { value: 'all', label: 'All states' },
  { value: 'live', label: 'Live (ready or on the way)' },
  ...INSTANCE_STATES.map((state) => ({ value: state, label: INSTANCE_STATE_LABELS[state] })),
];

function matchesState(instance: InstanceInfo, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'live') return isLive(instance.state);
  return instance.state === filter;
}

function InstanceTable({
  instances,
  now,
  loading,
  canManage,
  filtered,
  onEnd,
}: {
  instances: InstanceInfo[];
  now: number;
  loading: boolean;
  canManage: boolean;
  filtered: boolean;
  onEnd: (instance: InstanceInfo) => void;
}) {
  const columns = canManage ? 9 : 8;

  return (
    <Card p={0} className='overflow-hidden'>
      <Table.ScrollContainer minWidth={980}>
        <Table className='hallow-table' verticalSpacing='sm' highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>State</Table.Th>
              <Table.Th>Instance</Table.Th>
              <Table.Th>Kind</Table.Th>
              <Table.Th>Node</Table.Th>
              <Table.Th>Address</Table.Th>
              <Table.Th ta='right'>Players</Table.Th>
              <Table.Th ta='right'>Age</Table.Th>
              <Table.Th>Reason</Table.Th>
              {canManage && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <SkeletonRows columns={columns} />
            ) : instances.length === 0 ? (
              <EmptyRow columns={columns}>
                <FontAwesomeIcon icon={faCubes} size='xl' />
                <Text size='sm'>
                  {filtered
                    ? 'No instance matches these filters.'
                    : 'The control plane runs no instances right now. It starts them when a queue needs one and keeps warm ones ready.'}
                </Text>
              </EmptyRow>
            ) : (
              instances.map((instance) => {
                const ending = instance.state === 'ending' || instance.state === 'deleting';

                return (
                  <Table.Tr key={instance.name}>
                    <Table.Td>
                      <Tooltip
                        label={
                          <span>
                            Since <FormattedTimestamp timestamp={instance.state_since_ms} precise />
                          </span>
                        }
                      >
                        <span>
                          <InstanceStateBadge state={instance.state} />
                        </span>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={600} size='sm'>
                        {instance.name}
                      </Text>
                      <Text size='xs' c='dimmed' className='truncate max-w-64'>
                        {instance.image}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size='sm'>{instance.kind}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size='sm'>{instance.node}</Text>
                    </Table.Td>
                    <Table.Td>
                      {instance.address ? (
                        <Code>{instance.address}</Code>
                      ) : (
                        <Text size='sm' c='dimmed'>
                          –
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td ta='right' className='tabular-nums'>
                      <Text size='sm' c={instance.players === 0 ? 'dimmed' : undefined}>
                        {instance.players}
                      </Text>
                    </Table.Td>
                    <Table.Td ta='right' className='tabular-nums'>
                      <Tooltip
                        label={
                          <span>
                            Created <FormattedTimestamp timestamp={instance.created_ms} precise />
                          </span>
                        }
                      >
                        <Text size='sm' c='dimmed'>
                          {formatDuration(Math.max(0, now - instance.created_ms))}
                        </Text>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td maw={280}>
                      {instance.reason ? (
                        <Tooltip label={instance.reason} multiline maw={360}>
                          <Text size='sm' c={instance.state === 'failed' ? 'red' : 'dimmed'} className='truncate'>
                            {instance.reason}
                          </Text>
                        </Tooltip>
                      ) : (
                        <Text size='sm' c='dimmed'>
                          –
                        </Text>
                      )}
                    </Table.Td>
                    {canManage && (
                      <Table.Td>
                        <Group justify='flex-end' wrap='nowrap'>
                          <Tooltip label={ending ? 'Already ending' : 'End now'}>
                            <ActionIcon
                              variant='subtle'
                              color='red'
                              disabled={ending}
                              onClick={() => onEnd(instance)}
                              aria-label={`End ${instance.name}`}
                            >
                              <FontAwesomeIcon icon={faPowerOff} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

// Admin > Fleet > Instances: every lobby and game instance the control plane runs (docs/INSTANCES.md in
// the Hallow repo), refreshed every few seconds. `?kind=` and `?state=` filter it, so other pages link here.
export default function InstancesPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const canManage = useAdminCan('hallow.instances.manage');
  const [params, setParams] = useSearchParams();
  const [ending, setEnding] = useState<InstanceInfo | null>(null);

  const kind = params.get('kind') ?? 'all';
  const state = params.get('state') ?? 'all';
  const setFilter = (key: string, value: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (!value || value === 'all') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const { data, error, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: hallowQueryKeys.instances(),
    queryFn: getInstances,
    refetchInterval: REFRESH_MS,
    retry: false,
  });

  const instances = data?.instances ?? [];
  const counts = countByState(instances);
  const live = counts.creating + counts.starting + counts.ready;
  const players = instances.reduce((sum, instance) => sum + instance.players, 0);
  const kinds = [...new Set([...instances.map((instance) => instance.kind), ...(kind !== 'all' ? [kind] : [])])].sort();
  const shown = instances
    .filter((instance) => (kind === 'all' || instance.kind === kind) && matchesState(instance, state))
    .sort(
      (a, b) =>
        (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9) ||
        a.kind.localeCompare(b.kind) ||
        a.name.localeCompare(b.name),
    );
  const loading = isLoading && !data;
  const stale = !!error && !!data;

  return (
    <AdminContentContainer
      title='Instances'
      subtitle='Lobby and game instances the control plane runs: where each one is and what it is doing.'
      contentRight={
        <LiveIndicator at={data && !error ? dataUpdatedAt : undefined} refreshing={isFetching} onRefresh={refetch} />
      }
    >
      <ConfirmationModal
        opened={ending !== null}
        onClose={() => setEnding(null)}
        title={`End ${ending?.name ?? 'instance'}?`}
        confirm='End instance'
        onConfirmed={async () => {
          if (!ending) return;
          await endInstance(ending.name);
          addToast(`Ending ${ending.name}.`, 'success');
          queryClient.invalidateQueries({ queryKey: hallowQueryKeys.instances() });
          setEnding(null);
        }}
      >
        {ending && ending.players > 0
          ? `${ending.players} ${ending.players === 1 ? 'player is' : 'players are'} on it and will be sent back to the lobby by their proxy. `
          : 'Nobody is on it. '}
        The control plane starts another if {ending?.kind ?? 'the kind'} still needs one.
      </ConfirmationModal>

      <Stack gap='lg'>
        {error && <ControlPlaneError error={error} onRetry={refetch} retrying={isFetching} />}

        {(data || loading) && (
          <>
            <div className={stale ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                <MetricCard
                  icon={faCubes}
                  label='Live'
                  value={live}
                  color='teal'
                  hint={`${counts.ready} ready · ${counts.starting + counts.creating} starting`}
                  loading={loading}
                />
                <MetricCard
                  icon={faUsers}
                  label='Players in instances'
                  value={players}
                  hint={`Across ${instances.length} ${instances.length === 1 ? 'instance' : 'instances'}`}
                  loading={loading}
                />
                <MetricCard
                  icon={faHourglassHalf}
                  label='Ending'
                  value={counts.ending + counts.deleting}
                  color={counts.ending + counts.deleting > 0 ? 'yellow' : 'gray'}
                  hint={`${counts.ending} stopping · ${counts.deleting} deleting`}
                  loading={loading}
                />
                <MetricCard
                  icon={faCircleExclamation}
                  label='Failed'
                  value={counts.failed}
                  color={counts.failed > 0 ? 'red' : 'gray'}
                  hint={counts.failed > 0 ? 'Cleaned up and retried after a few seconds' : 'No orchestrator errors'}
                  loading={loading}
                />
              </div>
            </div>

            <Group align='center' gap='sm'>
              <Select
                aria-label='Kind'
                className='w-52'
                data={[{ value: 'all', label: 'All kinds' }, ...kinds.map((name) => ({ value: name, label: name }))]}
                value={kind}
                onChange={(value) => setFilter('kind', value)}
              />
              <Select
                aria-label='State'
                className='w-60'
                data={STATE_FILTERS}
                value={state}
                onChange={(value) => setFilter('state', value)}
              />
              {(kind !== 'all' || state !== 'all') && (
                <Button variant='subtle' size='xs' onClick={() => setParams({}, { replace: true })}>
                  Clear filters
                </Button>
              )}
              <Text size='xs' c='dimmed' ml='auto'>
                {shown.length === instances.length
                  ? `${instances.length} ${instances.length === 1 ? 'instance' : 'instances'}`
                  : `${shown.length} of ${instances.length} instances`}
              </Text>
            </Group>

            <InstanceTable
              instances={shown}
              now={data?.fetched_at_ms ?? 0}
              loading={loading}
              canManage={canManage}
              filtered={shown.length !== instances.length}
              onEnd={setEnding}
            />
          </>
        )}
      </Stack>
    </AdminContentContainer>
  );
}
