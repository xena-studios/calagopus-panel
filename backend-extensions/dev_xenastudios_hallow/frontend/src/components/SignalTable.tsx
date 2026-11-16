import { faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Table, Text } from '@mantine/core';
import Card from '@/elements/data-display/Card.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { formatDuration, formatMetric, protocolLabel, type SignalRecord } from '../lib/network.ts';
import { EmptyRow } from '../pages/overview/ProxyTable.tsx';

// Highest and average value of each metric over the samples shown.
export function SignalSummary({ signals }: { signals: SignalRecord[] }) {
  const stats = new Map<string, { max: number; sum: number; count: number }>();
  for (const signal of signals) {
    for (const [name, value] of Object.entries(signal.metrics)) {
      const entry = stats.get(name) ?? { max: -Infinity, sum: 0, count: 0 };
      entry.max = Math.max(entry.max, value);
      entry.sum += value;
      entry.count += 1;
      stats.set(name, entry);
    }
  }
  if (stats.size === 0) return null;

  return (
    <div className='grid gap-3 grid-cols-2 md:grid-cols-4'>
      {[...stats.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, entry]) => (
          <Card key={name} className='hallow-metric'>
            <span className='hallow-metric-label'>{name}</span>
            <span className='hallow-metric-value text-xl!'>{formatMetric(entry.max)}</span>
            <span className='hallow-metric-hint'>
              highest · average {formatMetric(entry.sum / entry.count)} over {entry.count}
            </span>
          </Card>
        ))}
    </div>
  );
}

export default function SignalTable({ signals }: { signals: SignalRecord[] }) {
  return (
    <Card p={0} className='overflow-hidden'>
      <Table.ScrollContainer minWidth={760}>
        <Table className='hallow-table' verticalSpacing='sm' highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Window ended</Table.Th>
              <Table.Th>Measured by</Table.Th>
              <Table.Th>Window</Table.Th>
              <Table.Th>Client</Table.Th>
              <Table.Th>Metrics</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {signals.length === 0 ? (
              <EmptyRow columns={5}>
                <FontAwesomeIcon icon={faShieldHalved} size='xl' />
                <Text size='sm'>No signal samples are stored for this player yet.</Text>
              </EmptyRow>
            ) : (
              signals.map((signal, index) => (
                <Table.Tr key={`${signal.at_ms}-${signal.source}-${index}`}>
                  <Table.Td>
                    <Text size='sm'>
                      <FormattedTimestamp timestamp={signal.at_ms} />
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm' fw={600}>
                      {signal.source}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm' c='dimmed'>
                      {formatDuration(signal.window_ms)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm' c='dimmed'>
                      {protocolLabel(signal.protocol)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      {Object.entries(signal.metrics)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([name, value]) => (
                          <Code key={name}>
                            {name} {formatMetric(value)}
                          </Code>
                        ))}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}
