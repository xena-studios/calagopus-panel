import { faBan, faCommentSlash, faRightFromBracket, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import issuePunishment from '../api/moderation/issuePunishment.ts';
import { getTemplates } from '../api/moderation/templates.ts';
import {
  DURATION_PRESETS,
  DURATION_UNITS,
  formatSeconds,
  lasts,
  type PunishmentKind,
  type PunishmentTemplate,
} from '../lib/moderation.ts';
import { PUNISHMENT_KIND_LABELS } from '../lib/network.ts';
import { hallowQueryKeys } from '../lib/queryKeys.ts';

const CUSTOM = 'custom';
const KIND_ACTIONS: Record<PunishmentKind, string> = { ban: 'Ban', mute: 'Mute', kick: 'Kick', warn: 'Warn' };
const KIND_ICONS = { ban: faBan, mute: faCommentSlash, kick: faRightFromBracket, warn: faTriangleExclamation };
const KIND_HINTS: Record<PunishmentKind, string> = {
  ban: 'Disconnected from whichever proxy they are on now, and refused at login on every proxy until it ends.',
  mute: 'Their proxy blocks chat, /msg, /r and party chat straight away; they are told why.',
  kick: 'Disconnected now. Needs the player online; it stays on their record.',
  warn: 'A message on their screen if they are online, and a line on their record.',
};

function presetValue(seconds: number | null): string {
  const index = DURATION_PRESETS.findIndex((preset) => preset.seconds === seconds);
  return index === -1 ? CUSTOM : index.toString();
}

// Issue a ban, mute, kick or warning, from a template or written out. `target` fixes the player (a
// profile's quick action); `kind` picks the starting type.
export default function IssuePunishmentModal({
  opened,
  onClose,
  target,
  kind: initialKind = 'ban',
}: {
  opened: boolean;
  onClose: () => void;
  target?: string;
  kind?: PunishmentKind;
}) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [player, setPlayer] = useState(target ?? '');
  const [kind, setKind] = useState<PunishmentKind>(initialKind);
  const [template, setTemplate] = useState<string | null>(null);
  const [preset, setPreset] = useState<string>(presetValue(7 * 86400));
  const [customAmount, setCustomAmount] = useState<number | string>(1);
  const [customUnit, setCustomUnit] = useState('d');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: hallowQueryKeys.punishmentTemplates(),
    queryFn: getTemplates,
    enabled: opened,
    retry: false,
  });

  // Every time it opens, it starts from the caller's player and type.
  useEffect(() => {
    if (!opened) return;
    setPlayer(target ?? '');
    setKind(initialKind);
    setTemplate(null);
    setPreset(presetValue(initialKind === 'mute' ? 3600 : 7 * 86400));
    setReason('');
    setError(null);
  }, [opened, target, initialKind]);

  const applyTemplate = (id: string | null) => {
    setTemplate(id);
    const picked = templates.data?.find((t) => t.id.toString() === id);
    if (!picked) return;
    setKind(picked.kind);
    setReason(picked.reason);
    if (lasts(picked.kind)) {
      const value = presetValue(picked.duration_seconds);
      setPreset(value);
      if (value === CUSTOM && picked.duration_seconds) {
        const unit = [...DURATION_UNITS].reverse().find((u) => picked.duration_seconds! % u.seconds === 0)!;
        setCustomUnit(unit.value);
        setCustomAmount(picked.duration_seconds / unit.seconds);
      }
    }
  };

  const durationSeconds = (): number | null => {
    if (!lasts(kind)) return null;
    if (preset !== CUSTOM) return DURATION_PRESETS[Number(preset)].seconds;
    const unit = DURATION_UNITS.find((u) => u.value === customUnit)!;
    return Math.max(1, Math.round(Number(customAmount) || 0)) * unit.seconds;
  };

  const pickedTemplate = templates.data?.find((t) => t.id.toString() === template);
  const name = player.trim();
  const valid = name.length > 0 && reason.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    issuePunishment({
      kind,
      target: name,
      reason: reason.trim(),
      durationSeconds: durationSeconds(),
      template: pickedTemplate?.name ?? null,
    })
      .then((reply) => {
        addToast(reply.message, 'success');
        queryClient.invalidateQueries({ queryKey: hallowQueryKeys.punishmentsAll() });
        onClose();
      })
      .catch((err) => setError(httpErrorToHuman(err)))
      .finally(() => setSubmitting(false));
  };

  const templateLabel = (t: PunishmentTemplate) =>
    `${t.name} · ${PUNISHMENT_KIND_LABELS[t.kind]}${lasts(t.kind) ? `, ${formatSeconds(t.duration_seconds)}` : ''}`;

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={target ? `Punish ${target}` : 'Issue a punishment'}
      size='lg'
      loading={submitting}
      isDirty={reason.length > 0}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Stack gap='md'>
        <Select
          label='Template'
          description='Fills in the type, length and reason; change anything after.'
          placeholder={templates.isLoading ? 'Loading templates...' : 'None: write it out'}
          clearable
          allowDeselect
          data={(templates.data ?? []).map((t) => ({ value: t.id.toString(), label: templateLabel(t) }))}
          value={template}
          onChange={applyTemplate}
          error={templates.error ? httpErrorToHuman(templates.error) : undefined}
        />
        {!target && (
          <TextInput
            label='Player'
            placeholder='Username, online or not'
            withAsterisk
            maxLength={32}
            value={player}
            onChange={(event) => setPlayer(event.currentTarget.value)}
            data-autofocus
          />
        )}
        <Stack gap={6}>
          <Text size='sm' fw={500}>
            Type
          </Text>
          <SegmentedControl
            fullWidth
            value={kind}
            onChange={(value) => setKind(value as PunishmentKind)}
            data={(['ban', 'mute', 'kick', 'warn'] as PunishmentKind[]).map((value) => ({
              value,
              label: (
                <Group gap={6} justify='center' wrap='nowrap'>
                  <FontAwesomeIcon icon={KIND_ICONS[value]} />
                  <span>{PUNISHMENT_KIND_LABELS[value]}</span>
                </Group>
              ),
            }))}
          />
          <Text size='xs' c='dimmed'>
            {KIND_HINTS[kind]}
          </Text>
        </Stack>
        {lasts(kind) && (
          <Group align='flex-end' grow>
            <Select
              label='Length'
              data={[
                ...DURATION_PRESETS.map((p, index) => ({ value: index.toString(), label: p.label })),
                { value: CUSTOM, label: 'Custom...' },
              ]}
              value={preset}
              onChange={(value) => value && setPreset(value)}
            />
            {preset === CUSTOM && (
              <Group gap='xs' grow wrap='nowrap'>
                <NumberInput
                  aria-label='Amount'
                  min={1}
                  max={3650}
                  value={customAmount}
                  onChange={setCustomAmount}
                />
                <Select
                  aria-label='Unit'
                  data={DURATION_UNITS.map((u) => ({ value: u.value, label: u.label }))}
                  value={customUnit}
                  onChange={(value) => value && setCustomUnit(value)}
                />
              </Group>
            )}
          </Group>
        )}
        <TextArea
          label='Reason'
          description='Shown to the player and kept on their record.'
          withAsterisk
          autosize
          minRows={2}
          maxLength={256}
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
        />
        {error && (
          <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />} title='Not issued'>
            {error}
          </Alert>
        )}
      </Stack>
      <ModalFooter>
        <Button variant='default' onClick={onClose}>
          Cancel
        </Button>
        <Button
          type='submit'
          color={kind === 'warn' ? 'yellow' : 'red'}
          loading={submitting}
          disabled={!valid}
          leftSection={<FontAwesomeIcon icon={KIND_ICONS[kind]} />}
        >
          {KIND_ACTIONS[kind]}
          {name ? ` ${name}` : ''}
          {lasts(kind) ? ` · ${formatSeconds(durationSeconds())}` : ''}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
