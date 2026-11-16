import { faTowerBroadcast } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Skeleton, Table, Text } from '@mantine/core';
import Card from '@/elements/data-display/Card.tsx';
import Code from '@/elements/typography/Code.tsx';
import StatusBadge from '../../components/StatusBadge.tsx';
import { formatDuration, PROXY_STALE_MS, type ProxyInfo } from '../../lib/network.ts';

function EmptyRow({ columns, children }: { columns: number; children: React.ReactNode }) {
  return (
    <Table.Tr>
      <Table.Td colSpan={columns}>
        <div className='flex flex-col items-center gap-2 py-6 text-(--mantine-color-dimmed)'>{children}</div>
      </Table.Td>
    </Table.Tr>
  );
}

export function SkeletonRows({ columns, rows = 3 }: { columns: number; rows?: number }) {
  return Array.from({ length: rows }, (_, row) => (
    <Table.Tr key={row}>
      {Array.from({ length: columns }, (_, column) => (
        <Table.Td key={column}>
          <Skeleton height={14} radius='sm' />
        </Table.Td>
      ))}
    </Table.Tr>
  ));
}

export { EmptyRow };

export default function ProxyTable({ proxies, now, loading }: { proxies: ProxyInfo[]; now: number; loading: boolean }) {
  const sorted = [...proxies].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <Card p={0} className='overflow-hidden'>
      <Table.ScrollContainer minWidth={720}>
        <Table className='hallow-table' verticalSpacing='sm' highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Status</Table.Th>
              <Table.Th>Proxy</Table.Th>
              <Table.Th>Address</Table.Th>
              <Table.Th>Version</Table.Th>
              <Table.Th ta='right'>Players</Table.Th>
              <Table.Th ta='right'>Last heartbeat</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <SkeletonRows columns={6} />
            ) : sorted.length === 0 ? (
              <EmptyRow columns={6}>
                <FontAwesomeIcon icon={faTowerBroadcast} size='xl' />
                <Text size='sm'>No proxies are registered. Proxies register when Vine starts with the Hallow plugin.</Text>
              </EmptyRow>
            ) : (
              sorted.map((proxy) => {
                const age = Math.max(0, now - proxy.last_heartbeat_ms);
                const status = proxy.draining ? 'draining' : age > PROXY_STALE_MS ? 'stale' : 'online';

                return (
                  <Table.Tr key={proxy.id}>
                    <Table.Td>
                      <StatusBadge status={status} />
                    </Table.Td>
                    <Table.Td>
                      <Text fw={600} size='sm'>
                        {proxy.id}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Code>{proxy.address}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Text size='sm' c='dimmed'>
                        {proxy.version}
                      </Text>
                    </Table.Td>
                    <Table.Td ta='right' className='tabular-nums'>
                      {proxy.players.toLocaleString()}
                    </Table.Td>
                    <Table.Td ta='right' className='tabular-nums'>
                      <Text size='sm' c={status === 'stale' ? 'orange' : 'dimmed'}>
                        {formatDuration(age)} ago
                      </Text>
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
