import { faCrown, faPen, faPlus, faTrash, faTriangleExclamation, faUserShield } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Table, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Code from '@/elements/typography/Code.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { deleteRank, getRanks, saveRank } from '../../api/moderation/ranks.ts';
import ControlPlaneError from '../../components/ControlPlaneError.tsx';
import PlayerRanksCard from '../../components/PlayerRanksCard.tsx';
import PlayerSearch, { usePlayerName } from '../../components/PlayerSearch.tsx';
import RankPrefix from '../../components/RankPrefix.tsx';
import { KNOWN_NODES, RANK_NAME, type RankInfo, validNode } from '../../lib/moderation.ts';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';
import { EmptyRow, SkeletonRows } from '../overview/ProxyTable.tsx';

function RankModal({ opened, onClose, rank }: { opened: boolean; onClose: () => void; rank: RankInfo | null }) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [weight, setWeight] = useState<number | string>(0);
  const [nodes, setNodes] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setName(rank?.name ?? '');
    setPrefix(rank?.display_prefix ?? '');
    setWeight(rank?.weight ?? 10);
    setNodes(rank?.permissions ?? []);
    setIsDefault(rank?.is_default ?? false);
    setError(null);
  }, [opened, rank]);

  const normalized = nodes.map((node) => node.trim().toLowerCase()).filter(Boolean);
  const invalid = normalized.filter((node) => !validNode(node));
  const nameOk = RANK_NAME.test(name);

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={rank ? `Edit ${rank.name}` : 'New rank'}
      size='lg'
      loading={saving}
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        saveRank(name, {
          display_prefix: prefix,
          weight: Math.round(Number(weight) || 0),
          permissions: normalized,
          is_default: isDefault,
        })
          .then((saved) => {
            addToast(`Rank ${saved.name} saved. Players get the change at their next join.`, 'success');
            queryClient.invalidateQueries({ queryKey: hallowQueryKeys.ranks() });
            onClose();
          })
          .catch((err) => setError(httpErrorToHuman(err)))
          .finally(() => setSaving(false));
      }}
    >
      <Stack gap='md'>
        <Group grow align='flex-start'>
          <TextInput
            label='Name'
            description='Lowercase letters, digits, _ and -'
            placeholder='moderator'
            withAsterisk
            disabled={rank !== null}
            maxLength={32}
            value={name}
            error={name && !nameOk ? 'Lowercase letters, digits, _ and - only' : undefined}
            onChange={(event) => setName(event.currentTarget.value)}
            data-autofocus
          />
          <NumberInput
            label='Weight'
            description='Higher wins: display order and the primary rank'
            value={weight}
            onChange={setWeight}
          />
        </Group>
        <TextInput
          label='Prefix'
          description='Shown before the player name, with & colour codes'
          placeholder='&2[MOD] '
          maxLength={64}
          value={prefix}
          onChange={(event) => setPrefix(event.currentTarget.value)}
          rightSectionWidth={160}
        />
        <div>
          <RankPrefix prefix={prefix} name={name || 'Steve'} />
        </div>
        <TagsInput
          label='Permission nodes'
          description='Such as hallow.staff.ban, hallow.staff.* for every staff command, or -hallow.staff.alert to deny one.'
          value={nodes}
          onChange={setNodes}
          invalidTags={nodes.filter((node) => !validNode(node.trim().toLowerCase()))}
          error={invalid.length > 0 ? `Not permission nodes: ${invalid.join(', ')}` : undefined}
          placeholder='hallow.staff.ban'
        />
        <Group gap={6}>
          {KNOWN_NODES.filter((known) => !normalized.includes(known.node)).map((known) => (
            <Tooltip key={known.node} label={known.description}>
              <Button
                size='compact-xs'
                variant='light'
                leftSection={<FontAwesomeIcon icon={faPlus} />}
                onClick={() => setNodes([...nodes, known.node])}
              >
                {known.node}
              </Button>
            </Tooltip>
          ))}
        </Group>
        <Switch
          label='Default rank'
          description='Every player holds it without being given it. Takes the flag off the current default.'
          checked={isDefault}
          onChange={(event) => setIsDefault(event.currentTarget.checked)}
        />
        {error && (
          <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />} title='Not saved'>
            {error}
          </Alert>
        )}
      </Stack>
      <ModalFooter>
        <Button variant='default' onClick={onClose}>
          Cancel
        </Button>
        <Button type='submit' loading={saving} disabled={!nameOk || invalid.length > 0}>
          Save
        </Button>
      </ModalFooter>
    </FormModal>
  );
}

function RankTable({ canManage }: { canManage: boolean }) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RankInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<RankInfo | null>(null);

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: hallowQueryKeys.ranks(),
    queryFn: getRanks,
    retry: false,
  });

  if (error) return <ControlPlaneError error={error} onRetry={refetch} retrying={isFetching} />;
  const columns = canManage ? 6 : 5;

  return (
    <Stack gap='md'>
      <RankModal
        opened={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        rank={editing}
      />
      <ConfirmationModal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'rank'}?`}
        confirm='Delete rank'
        onConfirmed={async () => {
          if (!deleting) return;
          await deleteRank(deleting.name);
          addToast(`Rank ${deleting.name} deleted.`, 'success');
          queryClient.invalidateQueries({ queryKey: hallowQueryKeys.ranks() });
          setDeleting(null);
        }}
      >
        {deleting?.members
          ? `${deleting.members} ${deleting.members === 1 ? 'player loses' : 'players lose'} it, and its permissions at their next join.`
          : 'Nobody holds it.'}
      </ConfirmationModal>

      <Group justify='space-between'>
        <Text size='sm' c='dimmed'>
          Ranks give players in-game staff commands. Panel access comes from panel roles under Staff &amp; Access.
        </Text>
        {canManage && (
          <Button leftSection={<FontAwesomeIcon icon={faPlus} />} onClick={() => setCreating(true)}>
            New rank
          </Button>
        )}
      </Group>
      <Card p={0} className='overflow-hidden'>
        <Table.ScrollContainer minWidth={760}>
          <Table className='hallow-table' verticalSpacing='sm' highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Rank</Table.Th>
                <Table.Th>Prefix</Table.Th>
                <Table.Th>Weight</Table.Th>
                <Table.Th>Permission nodes</Table.Th>
                <Table.Th>Players</Table.Th>
                {canManage && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading || !data ? (
                <SkeletonRows columns={columns} />
              ) : data.length === 0 ? (
                <EmptyRow columns={columns}>
                  <FontAwesomeIcon icon={faCrown} size='xl' />
                  <Text size='sm'>No ranks yet.</Text>
                </EmptyRow>
              ) : (
                data.map((rank) => (
                  <Table.Tr key={rank.name}>
                    <Table.Td>
                      <Group gap={6} wrap='nowrap'>
                        <Text size='sm' fw={500}>
                          {rank.name}
                        </Text>
                        {rank.is_default && (
                          <Badge size='xs' variant='outline' color='gray'>
                            Default
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <RankPrefix prefix={rank.display_prefix} />
                    </Table.Td>
                    <Table.Td>
                      <Text size='sm'>{rank.weight}</Text>
                    </Table.Td>
                    <Table.Td maw={380}>
                      {rank.permissions.length === 0 ? (
                        <Text size='sm' c='dimmed'>
                          None
                        </Text>
                      ) : (
                        <Group gap={4}>
                          {rank.permissions.slice(0, 6).map((node) => (
                            <Code key={node}>{node}</Code>
                          ))}
                          {rank.permissions.length > 6 && (
                            <Text size='xs' c='dimmed'>
                              +{rank.permissions.length - 6} more
                            </Text>
                          )}
                        </Group>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size='sm'>{rank.is_default ? 'Everyone' : rank.members}</Text>
                    </Table.Td>
                    {canManage && (
                      <Table.Td>
                        <Group gap={4} justify='flex-end' wrap='nowrap'>
                          <Tooltip label='Edit'>
                            <ActionIcon variant='subtle' onClick={() => setEditing(rank)}>
                              <FontAwesomeIcon icon={faPen} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={rank.is_default ? 'The default rank stays' : 'Delete'}>
                            <ActionIcon
                              variant='subtle'
                              color='red'
                              disabled={rank.is_default}
                              onClick={() => setDeleting(rank)}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}

// Admin > Overview > Ranks: Hallow ranks (in-game staff power) and who holds them.
export default function RanksPage() {
  const canManage = useAdminCan('hallow.ranks.manage');
  const [name, setName] = usePlayerName();

  return (
    <AdminContentContainer
      title='Ranks'
      subtitle='In-game ranks: prefixes and the permission nodes behind staff commands, and who holds them.'
    >
      <Stack gap='xl'>
        <RankTable canManage={canManage} />
        <TitleCard title="A player's ranks" icon={<FontAwesomeIcon icon={faUserShield} />}>
          <Stack gap='md'>
            <PlayerSearch value={name} onSearch={setName} />
            {name && <PlayerRanksCard key={name.toLowerCase()} name={name} canManage={canManage} />}
          </Stack>
        </TitleCard>
      </Stack>
    </AdminContentContainer>
  );
}
