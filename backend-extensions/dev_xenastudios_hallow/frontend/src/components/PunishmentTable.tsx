import { faGavel } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Table, Text } from '@mantine/core';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { PUNISHMENT_KIND_LABELS, type PunishmentRecord } from '../lib/network.ts';
import { EmptyRow } from '../pages/overview/ProxyTable.tsx';

const KIND_COLORS: Record<string, string> = { ban: 'red', mute: 'orange', kick: 'yellow', warn: 'gray' };

export default function PunishmentTable({ punishments }: { punishments: PunishmentRecord[] }) {
  return (
    <Card p={0} className='overflow-hidden'>
      <Table.ScrollContainer minWidth={760}>
        <Table className='hallow-table' verticalSpacing='sm' highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Reason</Table.Th>
              <Table.Th>Issued by</Table.Th>
              <Table.Th>Issued</Table.Th>
              <Table.Th>Expires</Table.Th>
              <Table.Th>State</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {punishments.length === 0 ? (
              <EmptyRow columns={6}>
                <FontAwesomeIcon icon={faGavel} size='xl' />
                <Text size='sm'>A clean record: no bans, mutes, kicks or warnings.</Text>
              </EmptyRow>
            ) : (
              punishments.map((punishment) => (
                <Table.Tr key={punishment.id}>
                  <Table.Td>
                    <Badge color={KIND_COLORS[punishment.kind] ?? 'gray'} variant='light'>
                      {PUNISHMENT_KIND_LABELS[punishment.kind] ?? punishment.kind}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm'>{punishment.reason || '(no reason given)'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm' c='dimmed'>
                      {punishment.issuer}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm'>
                      <FormattedTimestamp timestamp={punishment.created_ms} />
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size='sm' c='dimmed'>
                      {punishment.kind === 'kick' || punishment.kind === 'warn' ? (
                        '–'
                      ) : punishment.expires_ms === null ? (
                        'Permanent'
                      ) : (
                        <FormattedTimestamp timestamp={punishment.expires_ms} />
                      )}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {punishment.kind === 'ban' || punishment.kind === 'mute' ? (
                      <Badge color={punishment.active ? 'red' : 'gray'} variant={punishment.active ? 'filled' : 'light'}>
                        {punishment.active ? 'Active' : 'Ended'}
                      </Badge>
                    ) : (
                      <Text size='sm' c='dimmed'>
                        –
                      </Text>
                    )}
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
