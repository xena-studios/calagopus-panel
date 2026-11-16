import { faGavel, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Table, Text } from '@mantine/core';
import { Link } from 'react-router';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { ISSUER_KIND_LABELS, lasts, type PunishmentEntry } from '../lib/moderation.ts';
import { PUNISHMENT_KIND_LABELS } from '../lib/network.ts';
import { EmptyRow, SkeletonRows } from '../pages/overview/ProxyTable.tsx';

export const KIND_COLORS: Record<string, string> = { ban: 'red', mute: 'orange', kick: 'yellow', warn: 'gray' };

function State({ entry }: { entry: PunishmentEntry }) {
  if (!lasts(entry.kind)) {
    return (
      <Text size='sm' c='dimmed'>
        –
      </Text>
    );
  }
  if (entry.active) {
    return (
      <Badge color='red' variant='filled'>
        Active
      </Badge>
    );
  }
  if (entry.revoked) {
    const revoked = entry.revoked;
    return (
      <Tooltip
        label={
          <Stack gap={2}>
            <span>
              Lifted by {revoked.by} ({ISSUER_KIND_LABELS[revoked.by_kind] ?? revoked.by_kind})
            </span>
            {revoked.reason && <span>Reason: {revoked.reason}</span>}
          </Stack>
        }
      >
        <Badge color='teal' variant='light'>
          Lifted
        </Badge>
      </Tooltip>
    );
  }
  return (
    <Badge color='gray' variant='light'>
      Ended
    </Badge>
  );
}

// The network-wide list: one row per punishment, with its player, who issued it and its state. Active
// bans and mutes get a lift button for staff who may manage punishments.
export default function PunishmentLogTable({
  entries,
  loading,
  canManage,
  onRevoke,
}: {
  entries: PunishmentEntry[];
  loading: boolean;
  canManage: boolean;
  onRevoke: (entry: PunishmentEntry) => void;
}) {
  const columns = canManage ? 8 : 7;

  return (
    <Card p={0} className='overflow-hidden'>
      <Table.ScrollContainer minWidth={980}>
        <Table className='hallow-table' verticalSpacing='sm' highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Player</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Reason</Table.Th>
              <Table.Th>Issued by</Table.Th>
              <Table.Th>Issued</Table.Th>
              <Table.Th>Ends</Table.Th>
              <Table.Th>State</Table.Th>
              {canManage && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <SkeletonRows columns={columns} rows={5} />
            ) : entries.length === 0 ? (
              <EmptyRow columns={columns}>
                <FontAwesomeIcon icon={faGavel} size='xl' />
                <Text size='sm'>No punishments match.</Text>
              </EmptyRow>
            ) : (
              entries.map((entry) => (
                <Table.Tr key={entry.id}>
                  <Table.Td>
                    <Link
                      className='text-sm font-medium hover:underline'
                      to={`/admin/hallow/players?name=${encodeURIComponent(entry.target_name)}`}
                    >
                      {entry.target_name}
                    </Link>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={KIND_COLORS[entry.kind] ?? 'gray'} variant='light'>
                      {PUNISHMENT_KIND_LABELS[entry.kind] ?? entry.kind}
                    </Badge>
                  </Table.Td>
                  <Table.Td maw={320}>
                    <Text size='sm' lineClamp={2}>
                      {entry.reason}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap='nowrap'>
                      <Text size='sm'>{entry.issuer}</Text>
                      <Badge size='xs' variant='outline' color={entry.issuer_kind === 'staff' ? 'hallow' : 'gray'}>
                        {ISSUER_KIND_LABELS[entry.issuer_kind] ?? entry.issuer_kind}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm'>
                      <FormattedTimestamp timestamp={entry.created_ms} />
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm' c='dimmed'>
                      {!lasts(entry.kind) ? (
                        '–'
                      ) : entry.expires_ms === null ? (
                        'Permanent'
                      ) : (
                        <FormattedTimestamp timestamp={entry.expires_ms} />
                      )}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <State entry={entry} />
                  </Table.Td>
                  {canManage && (
                    <Table.Td>
                      {entry.active && (
                        <Button
                          size='compact-xs'
                          variant='light'
                          color='teal'
                          leftSection={<FontAwesomeIcon icon={faRotateLeft} />}
                          onClick={() => onRevoke(entry)}
                        >
                          {entry.kind === 'ban' ? 'Unban' : 'Unmute'}
                        </Button>
                      )}
                    </Table.Td>
                  )}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}
