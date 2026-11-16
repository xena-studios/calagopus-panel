import { faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Progress, Table, Text } from '@mantine/core';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Code from '@/elements/typography/Code.tsx';
import StatusBadge from '../../components/StatusBadge.tsx';
import { type ServerInfo } from '../../lib/network.ts';
import { serverStatus } from '../../lib/status.ts';
import { EmptyRow, SkeletonRows } from './ProxyTable.tsx';

// 50 ms is the whole 20 TPS tick budget.
function tickColor(tickMs: number): string {
  if (tickMs >= 50) return 'red';
  if (tickMs >= 40) return 'yellow';
  return 'teal';
}

export default function ServerTable({ servers, loading }: { servers: ServerInfo[]; loading: boolean }) {
  // Lobbies first, then games grouped by kind.
  const sorted = [...servers].sort(
    (a, b) =>
      Number(a.role !== 'lobby') - Number(b.role !== 'lobby') ||
      a.kind.localeCompare(b.kind) ||
      a.name.localeCompare(b.name),
  );

  return (
    <Card p={0} className='overflow-hidden'>
      <Table.ScrollContainer minWidth={860}>
        <Table className='hallow-table' verticalSpacing='sm' highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Status</Table.Th>
              <Table.Th>Server</Table.Th>
              <Table.Th>Game</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th w={180}>Players</Table.Th>
              <Table.Th ta='right'>Tick</Table.Th>
              <Table.Th>Version</Table.Th>
              <Table.Th>Address</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <SkeletonRows columns={8} />
            ) : sorted.length === 0 ? (
              <EmptyRow columns={8}>
                <FontAwesomeIcon icon={faServer} size='xl' />
                <Text size='sm'>No servers are registered. Servers register once they accept players.</Text>
              </EmptyRow>
            ) : (
              sorted.map((server) => {
                const fill = server.max_players > 0 ? (server.players / server.max_players) * 100 : 0;

                return (
                  <Table.Tr key={server.name}>
                    <Table.Td>
                      <StatusBadge status={serverStatus(server.state)} />
                    </Table.Td>
                    <Table.Td>
                      <Text fw={600} size='sm'>
                        {server.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size='sm'>{server.kind}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant='outline' color={server.role === 'lobby' ? 'cyan' : 'hallow'} size='sm'>
                        {server.role}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <div className='flex items-center gap-2'>
                        <Progress
                          value={fill}
                          size='sm'
                          radius='xl'
                          className='flex-1'
                          color={fill >= 100 ? 'yellow' : 'hallow'}
                        />
                        <Text size='xs' className='tabular-nums shrink-0' c='dimmed'>
                          {server.players}/{server.max_players}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td ta='right' className='tabular-nums'>
                      {server.tick_ms === null || server.tick_ms === undefined ? (
                        <Text size='sm' c='dimmed'>
                          –
                        </Text>
                      ) : (
                        <Tooltip label='Average milliseconds per tick; 50 ms is the 20 TPS budget'>
                          <Text size='sm' c={tickColor(server.tick_ms)}>
                            {server.tick_ms.toFixed(1)} ms
                          </Text>
                        </Tooltip>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size='sm' c='dimmed'>
                        {server.version}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Code>{server.address}</Code>
                    </Table.Td>
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
