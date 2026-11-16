import { faFileLines, faPen, faPlus, faTrash, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Table, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  type TemplateInput,
  updateTemplate,
} from '../../api/moderation/templates.ts';
import { KIND_COLORS } from '../../components/PunishmentLogTable.tsx';
import ControlPlaneError from '../../components/ControlPlaneError.tsx';
import { formatSeconds, lasts, type PunishmentKind, type PunishmentTemplate } from '../../lib/moderation.ts';
import { PUNISHMENT_KIND_LABELS } from '../../lib/network.ts';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';
import { EmptyRow, SkeletonRows } from '../overview/ProxyTable.tsx';

const UNITS = [
  { value: '60', label: 'minutes' },
  { value: '3600', label: 'hours' },
  { value: '86400', label: 'days' },
];

function TemplateModal({
  opened,
  onClose,
  template,
}: {
  opened: boolean;
  onClose: () => void;
  template: PunishmentTemplate | null;
}) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PunishmentKind>('ban');
  const [permanent, setPermanent] = useState(false);
  const [amount, setAmount] = useState<number | string>(7);
  const [unit, setUnit] = useState('86400');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setName(template?.name ?? '');
    setKind(template?.kind ?? 'ban');
    setReason(template?.reason ?? '');
    const seconds = template ? template.duration_seconds : 7 * 86400;
    setPermanent(template !== null && lasts(template.kind) && seconds === null);
    if (seconds) {
      const fit = [...UNITS].reverse().find((u) => seconds % Number(u.value) === 0) ?? UNITS[0];
      setUnit(fit.value);
      setAmount(seconds / Number(fit.value));
    }
    setError(null);
  }, [opened, template]);

  const input = (): TemplateInput => ({
    name: name.trim(),
    kind,
    duration_seconds:
      lasts(kind) && !permanent ? Math.max(1, Math.round(Number(amount) || 0)) * Number(unit) : null,
    reason: reason.trim(),
  });

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={template ? `Edit ${template.name}` : 'New template'}
      loading={saving}
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        (template ? updateTemplate(template.id, input()) : createTemplate(input()))
          .then((saved) => {
            addToast(`Template ${saved.name} saved.`, 'success');
            queryClient.invalidateQueries({ queryKey: hallowQueryKeys.punishmentTemplates() });
            onClose();
          })
          .catch((err) => setError(httpErrorToHuman(err)))
          .finally(() => setSaving(false));
      }}
    >
      <Stack gap='md'>
        <TextInput
          label='Name'
          placeholder='Cheating'
          withAsterisk
          maxLength={64}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          data-autofocus
        />
        <Select
          label='Type'
          data={(['ban', 'mute', 'kick', 'warn'] as PunishmentKind[]).map((value) => ({
            value,
            label: PUNISHMENT_KIND_LABELS[value],
          }))}
          value={kind}
          onChange={(value) => value && setKind(value as PunishmentKind)}
        />
        {lasts(kind) && (
          <Group align='flex-end' grow>
            <Select
              label='Length'
              data={[
                { value: 'timed', label: 'For a time' },
                { value: 'permanent', label: 'Permanent' },
              ]}
              value={permanent ? 'permanent' : 'timed'}
              onChange={(value) => setPermanent(value === 'permanent')}
            />
            {!permanent && (
              <Group gap='xs' grow wrap='nowrap'>
                <NumberInput aria-label='Amount' min={1} max={3650} value={amount} onChange={setAmount} />
                <Select aria-label='Unit' data={UNITS} value={unit} onChange={(value) => value && setUnit(value)} />
              </Group>
            )}
          </Group>
        )}
        <TextArea
          label='Reason'
          description='What the player sees.'
          withAsterisk
          autosize
          minRows={2}
          maxLength={256}
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
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
        <Button type='submit' loading={saving} disabled={!name.trim() || !reason.trim()}>
          Save
        </Button>
      </ModalFooter>
    </FormModal>
  );
}

// Reasons staff pick from when punishing; each brings its type and length.
export default function TemplatesPanel({ canManage }: { canManage: boolean }) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PunishmentTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<PunishmentTemplate | null>(null);

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: hallowQueryKeys.punishmentTemplates(),
    queryFn: getTemplates,
    retry: false,
  });

  if (error) return <ControlPlaneError error={error} onRetry={refetch} retrying={isFetching} />;

  const columns = canManage ? 5 : 4;

  return (
    <Stack gap='md'>
      <TemplateModal
        opened={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        template={editing}
      />
      <ConfirmationModal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'template'}?`}
        confirm='Delete'
        onConfirmed={async () => {
          if (!deleting) return;
          await deleteTemplate(deleting.id);
          addToast(`Template ${deleting.name} deleted.`, 'success');
          queryClient.invalidateQueries({ queryKey: hallowQueryKeys.punishmentTemplates() });
          setDeleting(null);
        }}
      >
        Punishments already issued from it keep their reason.
      </ConfirmationModal>

      <Group justify='space-between'>
        <Text size='sm' c='dimmed'>
          Staff pick a template when punishing, so the same offence gets the same reason and length.
        </Text>
        {canManage && (
          <Button leftSection={<FontAwesomeIcon icon={faPlus} />} onClick={() => setCreating(true)}>
            New template
          </Button>
        )}
      </Group>

      <Card p={0} className='overflow-hidden'>
        <Table.ScrollContainer minWidth={640}>
          <Table className='hallow-table' verticalSpacing='sm' highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Length</Table.Th>
                <Table.Th>Reason</Table.Th>
                {canManage && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading || !data ? (
                <SkeletonRows columns={columns} />
              ) : data.length === 0 ? (
                <EmptyRow columns={columns}>
                  <FontAwesomeIcon icon={faFileLines} size='xl' />
                  <Text size='sm'>No templates yet.</Text>
                </EmptyRow>
              ) : (
                data.map((template) => (
                  <Table.Tr key={template.id}>
                    <Table.Td>
                      <Text size='sm' fw={500}>
                        {template.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={KIND_COLORS[template.kind]} variant='light'>
                        {PUNISHMENT_KIND_LABELS[template.kind]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size='sm'>{lasts(template.kind) ? formatSeconds(template.duration_seconds) : '–'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size='sm' c='dimmed'>
                        {template.reason}
                      </Text>
                    </Table.Td>
                    {canManage && (
                      <Table.Td>
                        <Group gap={4} justify='flex-end' wrap='nowrap'>
                          <Tooltip label='Edit'>
                            <ActionIcon variant='subtle' onClick={() => setEditing(template)}>
                              <FontAwesomeIcon icon={faPen} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label='Delete'>
                            <ActionIcon variant='subtle' color='red' onClick={() => setDeleting(template)}>
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
