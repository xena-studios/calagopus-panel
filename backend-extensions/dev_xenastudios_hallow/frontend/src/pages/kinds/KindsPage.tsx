import { faCubes, faPen, faPlus, faShapes, faTrash, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Table, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import MultiKeyValueInput from '@/elements/input/MultiKeyValueInput.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { deleteKind, getInstances, getKinds, saveKind } from '../../api/instances.ts';
import ControlPlaneError from '../../components/ControlPlaneError.tsx';
import { isLive, KIND_NAME, KIND_NAME_MAX, type KindInfo, type KindInput } from '../../lib/instances.ts';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';
import { EmptyRow, SkeletonRows } from '../overview/ProxyTable.tsx';
import { INSTANCES_PATH } from '../overview/InstancesSummary.tsx';

const ROLE_OPTIONS = [
  { value: 'game', label: 'Game: one match per instance' },
  { value: 'lobby', label: 'Lobby: where players return after a game' },
  { value: 'hub', label: 'Hub: where players join the network' },
];

const ROLE_COLORS: Record<string, string> = { game: 'hallow', lobby: 'cyan', hub: 'teal' };

// The kind fields this form edits; everything else on a kind is sent back unchanged.
const EDITED_KEYS = new Set([
  'name',
  'image',
  'role',
  'lobby',
  'players',
  'scaling',
  'env',
  'memory_mb',
  'updated_by',
  'updated_ms',
]);

function serverFieldErrors(error: unknown): Record<string, string> | null {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (response?.status !== 400 || !response.data || typeof response.data !== 'object') return null;
  const fields = (response.data as { fields?: unknown }).fields;
  if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) return null;
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value)]));
}

function optionalNumber(value: number | string): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : undefined;
}

function KindModal({
  opened,
  onClose,
  kind,
  kinds,
}: {
  opened: boolean;
  onClose: () => void;
  kind: KindInfo | null;
  kinds: KindInfo[];
}) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [role, setRole] = useState<string>('game');
  const [lobby, setLobby] = useState<string | null>(null);
  const [minPlayers, setMinPlayers] = useState<number | string>(1);
  const [maxPlayers, setMaxPlayers] = useState<number | string>(16);
  const [warm, setWarm] = useState<number | string>(0);
  const [maxInstances, setMaxInstances] = useState<number | string>('');
  const [memory, setMemory] = useState<number | string>('');
  const [env, setEnv] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!opened) return;
    setName(kind?.name ?? '');
    setImage(kind?.image ?? '');
    setRole(kind?.role ?? 'game');
    setLobby(kind?.lobby ?? null);
    setMinPlayers(kind?.players.min ?? 1);
    setMaxPlayers(kind?.players.max ?? 16);
    setWarm(kind?.scaling.warm ?? 0);
    setMaxInstances(kind?.scaling.max_instances ?? '');
    setMemory(kind?.memory_mb ?? '');
    setEnv(kind?.env ?? {});
    setError(null);
    setFields({});
  }, [opened, kind]);

  const nameOk = KIND_NAME.test(name) && name.length <= KIND_NAME_MAX;
  const lobbyOptions = kinds
    .filter((other) => other.name !== name && other.role !== 'game')
    .map((other) => ({ value: other.name, label: `${other.name} (${other.role})` }));
  if (lobby && !lobbyOptions.some((option) => option.value === lobby)) lobbyOptions.push({ value: lobby, label: lobby });
  const envErrors = Object.entries(fields).filter(([field]) => field.startsWith('env.'));
  const shownFields = new Set([
    'image',
    'role',
    'lobby',
    'players.min',
    'players.max',
    'scaling.warm',
    'scaling.max_instances',
    'memory_mb',
  ]);
  const otherErrors = Object.entries(fields).filter(([field]) => !shownFields.has(field) && !field.startsWith('env.'));

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={kind ? `Edit ${kind.name}` : 'New game kind'}
      size='lg'
      loading={saving}
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        setFields({});

        // Fields this form doesn't know about go back as they came.
        const extra = Object.fromEntries(Object.entries(kind ?? {}).filter(([key]) => !EDITED_KEYS.has(key)));
        const scalingExtra = Object.fromEntries(
          Object.entries(kind?.scaling ?? {}).filter(([key]) => key !== 'warm' && key !== 'max_instances'),
        );
        const input: KindInput = {
          ...extra,
          image: image.trim(),
          role,
          lobby: lobby || undefined,
          players: { ...kind?.players, min: optionalNumber(minPlayers) ?? 1, max: optionalNumber(maxPlayers) ?? 0 },
          scaling: { ...scalingExtra, warm: optionalNumber(warm) ?? 0, max_instances: optionalNumber(maxInstances) },
          env,
          memory_mb: optionalNumber(memory),
        };

        saveKind(name, input)
          .then((saved) => {
            addToast(
              kind
                ? `${saved.name} saved. New instances use it; running ones keep their image.`
                : `${saved.name} registered.`,
              'success',
            );
            queryClient.invalidateQueries({ queryKey: hallowQueryKeys.kinds() });
            onClose();
          })
          .catch((err) => {
            const rejected = serverFieldErrors(err);
            if (rejected) setFields(rejected);
            setError(httpErrorToHuman(err));
          })
          .finally(() => setSaving(false));
      }}
    >
      <Stack gap='md'>
        <Group grow align='flex-start'>
          <TextInput
            label='Name'
            description='The server repo, such as skywars'
            placeholder='skywars'
            withAsterisk
            disabled={kind !== null}
            maxLength={KIND_NAME_MAX}
            value={name}
            error={name && !nameOk ? 'Lowercase letters, digits and single dashes, starting with a letter' : undefined}
            onChange={(event) => setName(event.currentTarget.value)}
            data-autofocus
          />
          <Select
            label='Role'
            description="As in the repo's hallow.toml"
            withAsterisk
            data={ROLE_OPTIONS}
            value={role}
            onChange={(value) => setRole(value ?? 'game')}
            allowDeselect={false}
            error={fields.role}
          />
        </Group>
        <TextInput
          label='Image'
          description='What new instances run. Saving a new tag makes it live; running instances keep theirs.'
          placeholder='ghcr.io/xena-studios/skywars:1.4.0'
          withAsterisk
          value={image}
          error={fields.image}
          onChange={(event) => setImage(event.currentTarget.value)}
        />
        <Select
          label='Lobby'
          description='Where players go when a game ends. Empty for the default.'
          placeholder='Default lobby'
          clearable
          searchable
          data={lobbyOptions}
          value={lobby}
          onChange={setLobby}
          error={fields.lobby}
        />
        <Group grow align='flex-start'>
          <NumberInput
            label='Players to start'
            description='players.min'
            min={1}
            value={minPlayers}
            onChange={setMinPlayers}
            error={fields['players.min']}
          />
          <NumberInput
            label='Players per instance'
            description='players.max'
            withAsterisk
            min={1}
            value={maxPlayers}
            onChange={setMaxPlayers}
            error={fields['players.max']}
          />
        </Group>
        <Group grow align='flex-start'>
          <NumberInput
            label='Warm instances'
            description='Kept ready while anyone is online'
            min={0}
            value={warm}
            onChange={setWarm}
            error={fields['scaling.warm']}
          />
          <NumberInput
            label='Max instances'
            description='Empty for no limit'
            placeholder='No limit'
            min={1}
            value={maxInstances}
            onChange={setMaxInstances}
            error={fields['scaling.max_instances']}
          />
          <NumberInput
            label='Memory (MiB)'
            description='Per instance. Empty for 1024.'
            placeholder='1024'
            min={128}
            max={65536}
            step={256}
            value={memory}
            onChange={setMemory}
            error={fields.memory_mb}
          />
        </Group>
        <MultiKeyValueInput
          label='Environment'
          description='Extra variables for every instance. HALLOW_ names are the control plane’s and refused.'
          allowReordering={false}
          options={env}
          onChange={setEnv}
          placeholderKey='NAME'
          placeholderValue='value'
        />
        {envErrors.length > 0 && (
          <Text size='xs' c='red'>
            {envErrors.map(([field, message]) => `${field.slice(4)}: ${message}`).join(' · ')}
          </Text>
        )}
        {error && (
          <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />} title='Not saved'>
            {error}
            {otherErrors.length > 0 && (
              <ul className='mt-1 list-disc pl-5'>
                {otherErrors.map(([field, message]) => (
                  <li key={field}>
                    <Code>{field}</Code> {message}
                  </li>
                ))}
              </ul>
            )}
          </Alert>
        )}
      </Stack>
      <ModalFooter>
        <Button variant='default' onClick={onClose}>
          Cancel
        </Button>
        <Button type='submit' loading={saving} disabled={!nameOk || !image.trim()}>
          {kind ? 'Save' : 'Register kind'}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}

function instancesQuery(enabled: boolean) {
  // Shares the Instances page's query, so both stay in step.
  return {
    queryKey: hallowQueryKeys.instances(),
    queryFn: getInstances,
    refetchInterval: 5_000,
    retry: false,
    enabled,
  };
}

// Admin > Fleet > Game kinds: the server kinds the control plane may start, each an image plus the
// scaling part of its hallow.toml (docs/INSTANCES.md in the Hallow repo).
export default function KindsPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const canManage = useAdminCan('hallow.kinds.manage');
  const canSeeInstances = useAdminCan('hallow.instances.read');
  const [editing, setEditing] = useState<KindInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<KindInfo | null>(null);

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: hallowQueryKeys.kinds(),
    queryFn: getKinds,
    retry: false,
  });
  const { data: instances } = useQuery(instancesQuery(canSeeInstances));

  const running = new Map<string, number>();
  for (const instance of instances?.instances ?? []) {
    if (isLive(instance.state)) running.set(instance.kind, (running.get(instance.kind) ?? 0) + 1);
  }
  const kinds = [...(data ?? [])].sort(
    (a, b) => Number(a.role === 'game') - Number(b.role === 'game') || a.name.localeCompare(b.name),
  );
  const columns = 7 + (canSeeInstances ? 1 : 0) + (canManage ? 1 : 0);

  return (
    <AdminContentContainer
      title='Game kinds'
      subtitle='The games, lobbies and hubs the control plane may start: their live image and how they scale.'
    >
      <KindModal
        opened={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        kind={editing}
        kinds={data ?? []}
      />
      <ConfirmationModal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Remove ${deleting?.name ?? 'kind'}?`}
        confirm='Remove kind'
        onConfirmed={async () => {
          if (!deleting) return;
          await deleteKind(deleting.name);
          addToast(`${deleting.name} removed.`, 'success');
          queryClient.invalidateQueries({ queryKey: hallowQueryKeys.kinds() });
          setDeleting(null);
        }}
      >
        No new instances of it start and its unused ones end. Games already running finish. A kinds file on the
        control plane registers it again at its next start.
      </ConfirmationModal>

      <Stack gap='md'>
        {error ? (
          <ControlPlaneError error={error} onRetry={refetch} retrying={isFetching} />
        ) : (
          <>
            <Group justify='space-between'>
              <Text size='sm' c='dimmed'>
                Making a new image live is saving its kind with the new tag. Running instances keep the image they
                started with.
              </Text>
              {canManage && (
                <Button leftSection={<FontAwesomeIcon icon={faPlus} />} onClick={() => setCreating(true)}>
                  New kind
                </Button>
              )}
            </Group>
            <Card p={0} className='overflow-hidden'>
              <Table.ScrollContainer minWidth={980}>
                <Table className='hallow-table' verticalSpacing='sm' highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Kind</Table.Th>
                      <Table.Th>Role</Table.Th>
                      <Table.Th>Image</Table.Th>
                      <Table.Th ta='right'>Players</Table.Th>
                      <Table.Th ta='right'>Warm</Table.Th>
                      <Table.Th ta='right'>Max instances</Table.Th>
                      {canSeeInstances && <Table.Th ta='right'>Running</Table.Th>}
                      <Table.Th>Updated</Table.Th>
                      {canManage && <Table.Th />}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {isLoading || !data ? (
                      <SkeletonRows columns={columns} />
                    ) : kinds.length === 0 ? (
                      <EmptyRow columns={columns}>
                        <FontAwesomeIcon icon={faShapes} size='xl' />
                        <Text size='sm'>
                          No kinds are registered. Register one here, or with the control plane&apos;s kinds file.
                        </Text>
                      </EmptyRow>
                    ) : (
                      kinds.map((kind) => (
                        <Table.Tr key={kind.name}>
                          <Table.Td>
                            <Text size='sm' fw={600}>
                              {kind.name}
                            </Text>
                            {kind.lobby && (
                              <Text size='xs' c='dimmed'>
                                Returns to {kind.lobby}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Badge variant='outline' size='sm' color={ROLE_COLORS[kind.role] ?? 'gray'}>
                              {kind.role}
                            </Badge>
                          </Table.Td>
                          <Table.Td maw={320}>
                            <Tooltip label={kind.image} multiline maw={420}>
                              <Code className='block truncate'>{kind.image}</Code>
                            </Tooltip>
                          </Table.Td>
                          <Table.Td ta='right' className='tabular-nums'>
                            <Text size='sm'>
                              {kind.players.min === kind.players.max
                                ? kind.players.max
                                : `${kind.players.min}–${kind.players.max}`}
                            </Text>
                          </Table.Td>
                          <Table.Td ta='right' className='tabular-nums'>
                            <Text size='sm' c={kind.scaling.warm === 0 ? 'dimmed' : undefined}>
                              {kind.scaling.warm}
                            </Text>
                          </Table.Td>
                          <Table.Td ta='right' className='tabular-nums'>
                            <Text size='sm' c={kind.scaling.max_instances == null ? 'dimmed' : undefined}>
                              {kind.scaling.max_instances ?? 'No limit'}
                            </Text>
                          </Table.Td>
                          {canSeeInstances && (
                            <Table.Td ta='right' className='tabular-nums'>
                              <Link to={`${INSTANCES_PATH}?kind=${encodeURIComponent(kind.name)}`}>
                                <Button
                                  variant='subtle'
                                  size='compact-sm'
                                  leftSection={<FontAwesomeIcon icon={faCubes} />}
                                >
                                  {running.get(kind.name) ?? 0}
                                </Button>
                              </Link>
                            </Table.Td>
                          )}
                          <Table.Td>
                            <Text size='sm' c='dimmed'>
                              <FormattedTimestamp timestamp={kind.updated_ms} />
                            </Text>
                            {kind.updated_by && (
                              <Text size='xs' c='dimmed'>
                                by {kind.updated_by}
                              </Text>
                            )}
                          </Table.Td>
                          {canManage && (
                            <Table.Td>
                              <Group gap={4} justify='flex-end' wrap='nowrap'>
                                <Tooltip label='Edit'>
                                  <ActionIcon variant='subtle' onClick={() => setEditing(kind)}>
                                    <FontAwesomeIcon icon={faPen} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label='Remove'>
                                  <ActionIcon variant='subtle' color='red' onClick={() => setDeleting(kind)}>
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
          </>
        )}
      </Stack>
    </AdminContentContainer>
  );
}
