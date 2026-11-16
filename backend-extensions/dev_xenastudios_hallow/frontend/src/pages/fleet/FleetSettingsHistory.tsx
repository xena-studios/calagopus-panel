import { faClockRotateLeft, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Table, Text } from '@mantine/core';
import { httpErrorToHuman } from '@/api/axios.ts';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { useResource } from '@/plugins/resource/useResource.ts';
import getFleetSettingsHistory from '../../api/fleet/getFleetSettingsHistory.ts';
import { diffSettings, type FleetSettingsChange, formatValue } from '../../lib/fleet.ts';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';

const HISTORY_LIMIT = 100;

function ChangeCard({ change }: { change: FleetSettingsChange }) {
  const entries = diffSettings(change.before, change.after);
  const currency = change.after.currency;

  return (
    <Card withBorder>
      <Group justify='space-between' mb='sm'>
        <Group gap='xs'>
          <FontAwesomeIcon icon={faUser} className='text-(--mantine-color-dimmed)' />
          <Text fw={600}>{change.updated_by}</Text>
          <Text c='dimmed' size='sm'>
            <FormattedTimestamp timestamp={change.updated_at} />
          </Text>
        </Group>
        {change.before === null ? (
          <Badge color='blue'>First save</Badge>
        ) : (
          <Badge color='gray'>
            {entries.length} {entries.length === 1 ? 'change' : 'changes'}
          </Badge>
        )}
      </Group>

      {entries.length === 0 ? (
        <Text size='sm' c='dimmed'>
          Saved without changes.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={520}>
          <Table verticalSpacing={4} fz='sm'>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Setting</Table.Th>
                <Table.Th>Before</Table.Th>
                <Table.Th>After</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {entries.map((entry) => (
                <Table.Tr key={entry.label}>
                  <Table.Td>{entry.label}</Table.Td>
                  <Table.Td c='dimmed'>
                    {entry.key === 'provider'
                      ? entry.before === undefined
                        ? '(none)'
                        : 'present'
                      : formatValue(entry.key, entry.before, currency)}
                  </Table.Td>
                  <Table.Td>
                    {entry.key === 'provider'
                      ? entry.after === undefined
                        ? 'removed'
                        : 'added'
                      : formatValue(entry.key, entry.after, currency)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Card>
  );
}

export default function FleetSettingsHistory() {
  const { data, loading, error, refetch } = useResource({
    queryKey: hallowQueryKeys.fleetSettingsHistory(),
    queryFn: () => getFleetSettingsHistory(HISTORY_LIMIT),
    silent: true,
  });

  if (error && !data) {
    return <ErrorState error={httpErrorToHuman(error)} onRetry={refetch} retrying={loading} />;
  }
  if (!data) {
    return <Spinner.Centered />;
  }
  if (data.length === 0) {
    return (
      <EmptyState
        icon={faClockRotateLeft}
        title='No changes yet'
        description='Changes to the fleet settings show up here, with who made them.'
      />
    );
  }

  return (
    <Stack>
      {data.map((change) => (
        <ChangeCard key={change.id} change={change} />
      ))}
      {data.length >= HISTORY_LIMIT && (
        <Text size='sm' c='dimmed' ta='center'>
          Showing the latest {HISTORY_LIMIT} changes.
        </Text>
      )}
    </Stack>
  );
}
