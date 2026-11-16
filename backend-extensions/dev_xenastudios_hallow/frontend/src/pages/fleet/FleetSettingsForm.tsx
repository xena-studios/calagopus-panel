import {
  faCircleInfo,
  faClock,
  faGaugeHigh,
  faPause,
  faServer,
  faShieldHalved,
  faSliders,
  faTriangleExclamation,
  faWallet,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { List, SimpleGrid, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import TimezoneInput from '@/elements/input/TimezoneInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import updateFleetSettings from '../../api/fleet/updateFleetSettings.ts';
import {
  CURRENCY_PATTERN,
  DECIMAL_PATTERN,
  FIELD_LABELS,
  MAX_BILLING_STEP_MARGIN_SECS,
  MAX_DURATION_SECS,
  type FleetSettings,
  type FleetSettingsResponse,
  fieldErrorsToFormErrors,
  fleetSettingsSchema,
} from '../../lib/fleet.ts';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';
import DurationInput from './DurationInput.tsx';
import LimitInput from './LimitInput.tsx';
import ProvidersTable from './ProvidersTable.tsx';

const KNOWN_KEYS = new Set(Object.keys(fleetSettingsSchema.shape));

const TIMING_FIELDS: { key: keyof FleetSettings & string; description: string }[] = [
  { key: 'queue_wait_target_secs', description: 'Scale up when any game queue waits longer than this.' },
  { key: 'scale_up_after_secs', description: 'How long low headroom or long queues must last before buying.' },
  { key: 'scale_down_after_secs', description: 'How long spare capacity must last before draining a node.' },
  { key: 'scale_up_cooldown_secs', description: 'Wait at least this long between two scale-ups.' },
  { key: 'scale_down_cooldown_secs', description: 'Wait at least this long between two scale-downs.' },
  { key: 'drain_deadline_secs', description: 'How long a draining node waits for games to end.' },
  {
    key: 'billing_step_margin_secs',
    description: 'Cancel a burst node this long before its next billing step.',
  },
];

function validate(values: FleetSettings): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const key of ['monthly_budget', 'daily_cap'] as const) {
    const value = values[key];
    if (value !== null && !DECIMAL_PATTERN.test(value)) {
      errors[key] = 'Enter an amount such as 250 or 250.00 (up to 6 decimals), or tick "No limit".';
    }
  }
  if (
    values.monthly_budget !== null &&
    values.daily_cap !== null &&
    !errors.monthly_budget &&
    !errors.daily_cap &&
    Number(values.daily_cap) > Number(values.monthly_budget)
  ) {
    errors.daily_cap = 'Cannot be more than the monthly budget.';
  }
  if (!CURRENCY_PATTERN.test(values.currency)) errors.currency = 'Three capital letters, such as EUR.';
  for (const { key } of TIMING_FIELDS) {
    const seconds = values[key] as number;
    if (seconds < 0 || seconds > MAX_DURATION_SECS) errors[key] = 'Between 0 and 30 days.';
  }
  if (!errors.billing_step_margin_secs && values.billing_step_margin_secs >= MAX_BILLING_STEP_MARGIN_SECS) {
    errors.billing_step_margin_secs = 'Must be under an hour.';
  }
  if (!values.timezone) errors.timezone = 'Pick a timezone.';
  if (values.floor_nodes > values.max_nodes) errors.floor_nodes = 'Cannot be more than the maximum nodes.';
  if (values.tighten_from < 0 || values.tighten_from > 1) errors.tighten_from = 'Between 0% and 100%.';

  const names = new Set<string>();
  values.providers.forEach((provider, index) => {
    const name = provider.name.trim();
    if (!name) errors[`providers.${index}.name`] = 'Give the provider a name.';
    else if (names.has(name)) errors[`providers.${index}.name`] = 'This provider is listed twice.';
    names.add(name);
  });

  return errors;
}

function serverFieldErrors(error: unknown): Record<string, string> | null {
  if (!error || typeof error !== 'object' || !('response' in error)) return null;
  const response = (error as { response?: { status?: number; data?: unknown } }).response;
  if (response?.status !== 400 || !response.data || typeof response.data !== 'object') return null;

  const fields = (response.data as { fields?: unknown }).fields;
  if (!fields || typeof fields !== 'object') return null;

  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value)]));
}

function fieldLabel(path: string): string {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((part) => (/^\d+$/.test(part) ? `#${Number(part) + 1}` : (FIELD_LABELS[part] ?? part)))
    .join(' > ');
}

interface Props {
  initial: FleetSettingsResponse;
}

export default function FleetSettingsForm({ initial }: Props) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const canManage = useAdminCan('hallow.fleet.manage');

  const [saved, setSaved] = useState<FleetSettingsResponse>(initial);
  const [saving, setSaving] = useState(false);
  const [confirmDryRunOff, setConfirmDryRunOff] = useState(false);
  const [rejectedFields, setRejectedFields] = useState<Record<string, string>>({});

  const form = useForm<FleetSettings>({
    initialValues: initial.settings,
    validate,
    validateInputOnBlur: true,
  });

  // Makes `settings` the saved state: what Discard goes back to and what dirtiness compares with.
  const hydrate = (response: FleetSettingsResponse) => {
    setSaved(response);
    form.setInitialValues(response.settings);
    form.setValues(response.settings);
    form.resetDirty(response.settings);
  };

  // A fresh copy from the server (refetch, another admin's save) replaces the form only when it
  // has no unsaved edits.
  useEffect(() => {
    if (initial === saved || form.isDirty()) return;
    hydrate(initial);
  }, [initial]);

  const values = form.values;
  const dirty = form.isDirty();
  const extraKeys = Object.keys(values).filter((key) => !KNOWN_KEYS.has(key));

  const persist = () => {
    setSaving(true);
    setRejectedFields({});

    updateFleetSettings(form.getValues())
      .then((response) => {
        hydrate(response);
        queryClient.setQueryData(hallowQueryKeys.fleetSettings(), response);
        queryClient.invalidateQueries({ queryKey: hallowQueryKeys.fleetSettingsHistory() });
        addToast('Fleet settings saved.', 'success');
      })
      .catch((error) => {
        const fields = serverFieldErrors(error);
        if (fields) {
          setRejectedFields(fields);
          form.setErrors(fieldErrorsToFormErrors(fields, form.getValues()));
        }
        addToast(httpErrorToHuman(error), 'error');
      })
      .finally(() => setSaving(false));
  };

  const onSubmit = () => {
    if (saved.settings.dry_run && !form.getValues().dry_run) {
      setConfirmDryRunOff(true);
      return;
    }
    persist();
  };

  const disabled = !canManage;
  const rejected = Object.entries(rejectedFields);

  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <ConfirmationModal
        opened={confirmDryRunOff}
        onClose={() => setConfirmDryRunOff(false)}
        title='Turn off dry run?'
        confirm='Turn off dry run'
        onConfirmed={() => {
          setConfirmDryRunOff(false);
          persist();
        }}
      >
        The fleet manager will start ordering and cancelling real machines with the enabled providers, and that costs
        money, up to the budget you set.
      </ConfirmationModal>

      <Stack>
        {rejected.length > 0 && (
          <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />} title='Not saved'>
            The control plane rejected these settings:
            <List size='sm' mt='xs'>
              {rejected.map(([field, message]) => (
                <List.Item key={field}>
                  <b>{fieldLabel(field)}</b>: {message}
                </List.Item>
              ))}
            </List>
          </Alert>
        )}

        <fieldset disabled={disabled} className='m-0 border-0 p-0 min-w-0'>
          <Stack>
            <SimpleGrid cols={{ base: 1, lg: 2 }}>
              <TitleCard title='Mode' icon={<FontAwesomeIcon icon={faSliders} />}>
                <Stack>
                  <Switch
                    label='Dry run'
                    description='Log what the fleet manager would do, without calling any provider.'
                    {...form.getInputProps('dry_run', { type: 'checkbox' })}
                  />
                  <Switch
                    label='Paused'
                    description='Stop all scaling: no machines are bought, drained or cancelled.'
                    {...form.getInputProps('paused', { type: 'checkbox' })}
                  />
                  {values.dry_run ? (
                    <Alert color='blue' icon={<FontAwesomeIcon icon={faCircleInfo} />} title='Dry run is on'>
                      Nothing is bought or cancelled; decisions only go to the log.
                    </Alert>
                  ) : (
                    <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />} title='Dry run is off'>
                      The fleet manager orders and cancels real machines, and that costs money.
                    </Alert>
                  )}
                  {values.paused && (
                    <Alert color='yellow' icon={<FontAwesomeIcon icon={faPause} />} title='Paused'>
                      The fleet stays as it is until you unpause.
                    </Alert>
                  )}
                </Stack>
              </TitleCard>

              <TitleCard title='Safety' icon={<FontAwesomeIcon icon={faShieldHalved} />}>
                <Stack>
                  <Switch
                    label='Base drains need approval'
                    description='Ask a staff member before draining and cancelling a monthly (base) node.'
                    {...form.getInputProps('base_drain_needs_approval', { type: 'checkbox' })}
                  />
                  <Switch
                    label='Prefer burst nodes on scale-down'
                    description='Drain hourly (burst) nodes before monthly (base) ones when capacity is no longer needed.'
                    {...form.getInputProps('prefer_burst_on_scale_down', { type: 'checkbox' })}
                  />
                  {!values.base_drain_needs_approval && (
                    <Alert color='yellow' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
                      Base nodes are billed monthly and take hours to days to come back once cancelled.
                    </Alert>
                  )}
                  <Text size='sm' c='dimmed'>
                    Monthly orders always need approval in the panel. Budgets stop growth; they never cut a node that
                    has players on it.
                  </Text>
                </Stack>
              </TitleCard>

              <TitleCard title='Budget' icon={<FontAwesomeIcon icon={faWallet} />}>
                <Stack>
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label='Currency'
                      description='ISO 4217 code of the budgets, such as EUR.'
                      maxLength={3}
                      {...form.getInputProps('currency')}
                      onChange={(event) => form.setFieldValue('currency', event.currentTarget.value.toUpperCase())}
                    />
                    <TimezoneInput
                      description='Days and months of the budget start at midnight here.'
                      {...form.getInputProps('timezone')}
                    />
                  </SimpleGrid>
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <LimitInput
                      label='Monthly budget'
                      description='Spend for the whole network per calendar month.'
                      currency={values.currency}
                      disabled={disabled}
                      value={values.monthly_budget}
                      error={form.errors.monthly_budget}
                      onChange={(value) => form.setFieldValue('monthly_budget', value)}
                    />
                    <LimitInput
                      label='Daily cap'
                      description='Spend for the whole network per day.'
                      currency={values.currency}
                      disabled={disabled}
                      value={values.daily_cap}
                      error={form.errors.daily_cap}
                      onChange={(value) => form.setFieldValue('daily_cap', value)}
                    />
                  </SimpleGrid>
                  <NumberInput
                    label='Tighten from'
                    description='When the month-end forecast passes this share of the monthly budget, keep less spare capacity, then stop buying.'
                    suffix='%'
                    min={0}
                    max={100}
                    decimalScale={2}
                    value={Math.round(values.tighten_from * 10000) / 100}
                    error={form.errors.tighten_from}
                    onChange={(raw) => {
                      const percent = typeof raw === 'number' ? raw : Number.parseFloat(raw);
                      form.setFieldValue('tighten_from', Number.isFinite(percent) ? percent / 100 : 0);
                    }}
                  />
                </Stack>
              </TitleCard>

              <TitleCard title='Capacity' icon={<FontAwesomeIcon icon={faServer} />}>
                <Stack>
                  <NumberInput
                    label='Floor nodes'
                    description='Machines that always run, even with nobody online.'
                    min={0}
                    allowDecimal={false}
                    allowNegative={false}
                    {...form.getInputProps('floor_nodes')}
                  />
                  <NumberInput
                    label='Maximum nodes'
                    description='Never run more machines than this, whatever the budget.'
                    min={0}
                    allowDecimal={false}
                    allowNegative={false}
                    {...form.getInputProps('max_nodes')}
                  />
                  <NumberInput
                    label='Headroom slots'
                    description='Free game slots to keep across all nodes; fewer than this triggers a scale-up.'
                    min={0}
                    allowDecimal={false}
                    allowNegative={false}
                    {...form.getInputProps('headroom_slots')}
                  />
                </Stack>
              </TitleCard>
            </SimpleGrid>

            <TitleCard title='Timing' icon={<FontAwesomeIcon icon={faClock} />}>
              <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
                {TIMING_FIELDS.map(({ key, description }) => (
                  <DurationInput
                    key={key}
                    label={FIELD_LABELS[key]}
                    description={description}
                    disabled={disabled}
                    value={values[key] as number}
                    error={form.errors[key]}
                    onChange={(seconds) => form.setFieldValue(key, seconds)}
                  />
                ))}
              </SimpleGrid>
            </TitleCard>

            <TitleCard title='Providers' icon={<FontAwesomeIcon icon={faGaugeHigh} />}>
              <ProvidersTable form={form} disabled={disabled} />
            </TitleCard>
          </Stack>
        </fieldset>

        {extraKeys.length > 0 && (
          <Text size='xs' c='dimmed'>
            Also kept as they are, from a newer control plane: {extraKeys.join(', ')}.
          </Text>
        )}

        <Card withBorder className='sticky bottom-4 z-10'>
          <Group justify='space-between'>
            <Text size='sm' c='dimmed'>
              {saved.updated_at ? (
                <>
                  Last changed <FormattedTimestamp timestamp={saved.updated_at} />
                  {saved.updated_by ? ` by ${saved.updated_by}` : ''}.
                </>
              ) : (
                'Never changed from the panel; these are the control plane defaults.'
              )}
            </Text>
            <Group>
              {dirty && <Badge color='yellow'>Unsaved changes</Badge>}
              {dirty && (
                <Button
                  variant='default'
                  disabled={saving}
                  onClick={() => {
                    form.reset();
                    setRejectedFields({});
                  }}
                >
                  Discard
                </Button>
              )}
              <AdminCan action='hallow.fleet.manage' cantSave>
                <Button type='submit' loading={saving} disabled={!dirty}>
                  Save
                </Button>
              </AdminCan>
            </Group>
          </Group>
        </Card>
      </Stack>
    </form>
  );
}
