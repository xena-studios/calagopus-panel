import { faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import getExtensionSettings from '../../api/getExtensionSettings.ts';
import updateExtensionSettings from '../../api/updateExtensionSettings.ts';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';

interface FormValues {
  controlPlaneUrl: string;
  controlPlaneToken: string;
}

function validUrl(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? null : 'Use an http:// or https:// URL.';
  } catch {
    return 'Not a valid URL.';
  }
}

// Where the panel finds the Hallow control plane. Shown on Network settings and on
// Admin > Extensions > Hallow.
export default function ConfigurationPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: settings, invalidate } = useResource({
    queryKey: hallowQueryKeys.extensionSettings(),
    queryFn: getExtensionSettings,
  });

  const form = useForm<FormValues>({
    initialValues: { controlPlaneUrl: '', controlPlaneToken: '' },
    validateInputOnBlur: true,
    validate: { controlPlaneUrl: validUrl },
  });

  useEffect(() => {
    if (!settings) return;
    const values = { controlPlaneUrl: settings.controlPlaneUrl, controlPlaneToken: '' };
    form.setValues(values);
    form.resetDirty(values);
  }, [settings]);

  const doSave = (values: FormValues) => {
    setSaving(true);

    updateExtensionSettings({
      controlPlaneUrl: values.controlPlaneUrl.trim(),
      controlPlaneToken: values.controlPlaneToken ? values.controlPlaneToken : undefined,
    })
      .then(() => {
        addToast('Hallow settings saved.', 'success');
        invalidate();
        // Pages may have shown "not configured"; let every Hallow query try again.
        queryClient.invalidateQueries({ queryKey: hallowQueryKeys.all() });
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setSaving(false));
  };

  return (
    <TitleCard title='Control plane' icon={<FontAwesomeIcon icon={faServer} />}>
      <form onSubmit={form.onSubmit(doSave)}>
        <Stack>
          <TextInput
            label='Control plane URL'
            description='Base URL of the Hallow control plane, reachable from the panel (not from browsers), such as http://10.0.0.2:7000.'
            placeholder='http://10.0.0.2:7000'
            {...form.getInputProps('controlPlaneUrl')}
          />
          <PasswordInput
            label='Control plane token'
            description={
              settings?.controlPlaneTokenSet
                ? 'A token is set. Enter a new one to replace it, or leave this empty to keep it.'
                : 'Bearer token for the control plane API. Stored encrypted.'
            }
            placeholder={settings?.controlPlaneTokenSet ? 'Unchanged' : 'Token'}
            {...form.getInputProps('controlPlaneToken')}
          />
          <AdminCan action='extensions.manage' cantSave>
            <Button type='submit' loading={saving} disabled={!form.isValid()} className='w-fit!'>
              Save
            </Button>
          </AdminCan>
        </Stack>
      </form>
    </TitleCard>
  );
}
