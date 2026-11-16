import {
  faCircleCheck,
  faCircleExclamation,
  faScrewdriverWrench,
  faServer,
  faSliders,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Table, Text } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Card from '@/elements/data-display/Card.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminNode } from '@/lib/schemas/admin/nodes.ts';
import { useNodeVersion } from '@/plugins/nodes/useNodeVersion.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import ComingNext from '../../components/ComingNext.tsx';
import MetricCard from '../../components/MetricCard.tsx';
import StatusBadge from '../../components/StatusBadge.tsx';
import { EmptyRow, SkeletonRows } from '../overview/ProxyTable.tsx';

type NodeHealth = 'online' | 'offline' | 'unknown';

// Up to this many nodes are listed; the Nodes page has the full, paginated list.
const NODE_LIMIT = 100;

function NodeRow({ node, onHealth }: { node: AdminNode; onHealth: (uuid: string, health: NodeHealth) => void }) {
  const { version, unavailable, loading } = useNodeVersion(node);
  const health: NodeHealth = loading ? 'unknown' : unavailable || !version ? 'offline' : 'online';

  useEffect(() => onHealth(node.uuid, health), [node.uuid, health, onHealth]);

  return (
    <Table.Tr>
      <Table.Td>
        {node.maintenanceEnabled ? (
          <StatusBadge status='draining' label='Maintenance' />
        ) : (
          <StatusBadge status={health} label={health === 'unknown' ? 'Checking' : undefined} />
        )}
      </Table.Td>
      <Table.Td>
        <TableLink to={`/admin/nodes/${node.uuid}`}>
          <Text fw={600} size='sm'>
            {node.name}
          </Text>
        </TableLink>
      </Table.Td>
      <Table.Td>
        <Text size='sm'>{node.location.name}</Text>
      </Table.Td>
      <Table.Td>
        <Text size='sm' c='dimmed'>
          {version ?? '–'}
        </Text>
      </Table.Td>
      <Table.Td ta='right' className='tabular-nums'>
        <Text size='sm'>{bytesToString(mbToBytes(node.memory))}</Text>
      </Table.Td>
      <Table.Td ta='right' className='tabular-nums'>
        <Text size='sm'>{bytesToString(mbToBytes(node.disk))}</Text>
      </Table.Td>
    </Table.Tr>
  );
}

// The machines the network runs on: Calagopus nodes, with their Wings status.
export default function FleetOverviewPage() {
  const { data, error, loading, refetch } = useResource({
    queryKey: [...queryKeys.admin.nodes.all(), 'hallow-fleet-overview'],
    queryFn: () => getNodes(1, undefined, NODE_LIMIT),
    silent: true,
  });
  const [health, setHealth] = useState<Record<string, NodeHealth>>({});
  const onHealth = useCallback((uuid: string, value: NodeHealth) => {
    setHealth((current) => (current[uuid] === value ? current : { ...current, [uuid]: value }));
  }, []);

  const nodes = data?.data ?? [];
  const online = nodes.filter((node) => health[node.uuid] === 'online').length;
  const offline = nodes.filter((node) => health[node.uuid] === 'offline').length;
  const maintenance = nodes.filter((node) => node.maintenanceEnabled).length;

  return (
    <AdminContentContainer
      title='Fleet'
      subtitle='The machines the network runs on, and whether their Wings daemons answer.'
      contentRight={
        <Group gap='xs'>
          <Link to='/admin/hallow/fleet/settings'>
            <Button variant='default' leftSection={<FontAwesomeIcon icon={faSliders} />}>
              Fleet settings
            </Button>
          </Link>
          <Link to='/admin/nodes'>
            <Button leftSection={<FontAwesomeIcon icon={faServer} />}>Manage nodes</Button>
          </Link>
        </Group>
      }
    >
      <Stack gap='lg'>
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <MetricCard icon={faServer} label='Nodes' value={data?.total ?? 0} loading={loading && !data} />
          <MetricCard
            icon={faCircleCheck}
            label='Online'
            value={online}
            color='teal'
            hint='Wings answers'
            loading={loading && !data}
          />
          <MetricCard
            icon={faCircleExclamation}
            label='Unreachable'
            value={offline}
            color={offline > 0 ? 'red' : 'gray'}
            hint='Wings did not answer'
            loading={loading && !data}
          />
          <MetricCard
            icon={faScrewdriverWrench}
            label='Maintenance'
            value={maintenance}
            color={maintenance > 0 ? 'yellow' : 'gray'}
            hint='Not taking new servers'
            loading={loading && !data}
          />
        </div>

        {error ? (
          <ErrorState error={httpErrorToHuman(error)} onRetry={refetch} retrying={loading} />
        ) : (
          <Card p={0} className='overflow-hidden'>
            <Table.ScrollContainer minWidth={720}>
              <Table className='hallow-table' verticalSpacing='sm' highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Node</Table.Th>
                    <Table.Th>Location</Table.Th>
                    <Table.Th>Wings</Table.Th>
                    <Table.Th ta='right'>Memory</Table.Th>
                    <Table.Th ta='right'>Disk</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {loading && !data ? (
                    <SkeletonRows columns={6} />
                  ) : nodes.length === 0 ? (
                    <EmptyRow columns={6}>
                      <FontAwesomeIcon icon={faServer} size='xl' />
                      <Text size='sm'>No nodes yet. Add the first machine on the Nodes page.</Text>
                    </EmptyRow>
                  ) : (
                    nodes.map((node) => <NodeRow key={node.uuid} node={node} onHealth={onHealth} />)
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        )}

        <ComingNext
          icon={faSliders}
          title='Fleet manager'
          today={['Scaling targets, budgets, timing and providers on Fleet settings', 'Every node’s Wings status here']}
          next={[
            'Each node’s provider, region, kind (base or burst) and monthly cost',
            'Drain, cancel or approve nodes from here',
            'Spend this month against the budget',
          ]}
        >
          The control plane&apos;s fleet manager buys and returns machines. Its per-node view arrives with its node API.
        </ComingNext>
      </Stack>
    </AdminContentContainer>
  );
}
