import { faArrowRight, faCircleCheck, faPlug } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import type { OobeComponentProps } from '@/routers/OobeRouter.tsx';
import getNetwork from '../../api/network/getNetwork.ts';
import updateExtensionSettings from '../../api/updateExtensionSettings.ts';

function validUrl(value: string): string | null {
  if (!value.trim()) return 'Enter the control plane URL, or skip this step.';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? null : 'Use an http:// or https:// URL.';
  } catch {
    return 'Not a valid URL.';
  }
}

// Setup step: where the panel finds the Hallow control plane. Saves the extension settings, then
// asks the control plane for the network to prove the URL and token work.
export default function OobeControlPlane({ onNext, onBack, canGoBack }: OobeComponentProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState<string | null>(null);

  const form = useForm({
    initialValues: { controlPlaneUrl: '', controlPlaneToken: '' },
    validate: {
      controlPlaneUrl: validUrl,
      controlPlaneToken: (value) => (value.trim() ? null : 'Enter the control plane token.'),
    },
  });

  const doSave = (values: typeof form.values) => {
    setSaving(true);
    setError('');
    setConnected(null);

    updateExtensionSettings({
      controlPlaneUrl: values.controlPlaneUrl.trim(),
      controlPlaneToken: values.controlPlaneToken.trim(),
    })
      .then(() => getNetwork())
      .then((network) =>
        setConnected(
          `${network.proxies.length} ${network.proxies.length === 1 ? 'proxy' : 'proxies'}, ${network.servers.length} ${
            network.servers.length === 1 ? 'server' : 'servers'
          } and ${network.count.online} players online.`,
        ),
      )
      .catch((err) => setError(httpErrorToHuman(err)))
      .finally(() => setSaving(false));
  };

  return (
    <form onSubmit={form.onSubmit(doSave)}>
      <Stack>
        <div>
          <Title order={3}>Connect the control plane</Title>
          <Text size='sm' c='dimmed'>
            The control plane knows every proxy, server and player on the network. The panel talks to it from the
            server side, so it only needs to be reachable from here, not from browsers.
          </Text>
        </div>

        <TextInput
          label='Control plane URL'
          placeholder='http://10.0.0.2:7000'
          withAsterisk
          {...form.getInputProps('controlPlaneUrl')}
        />
        <PasswordInput
          label='Control plane token'
          description='The bearer token from the control plane’s configuration. Stored encrypted.'
          withAsterisk
          {...form.getInputProps('controlPlaneToken')}
        />

        {connected && (
          <Alert color='teal' icon={<FontAwesomeIcon icon={faCircleCheck} />} title='Connected'>
            {connected}
          </Alert>
        )}
        {error && (
          <Alert color='red' icon={<FontAwesomeIcon icon={faPlug} />} title='Saved, but the control plane did not answer'>
            {error} You can continue and fix it later under Network settings.
          </Alert>
        )}

        <Group justify='space-between'>
          <Group gap='xs'>
            {canGoBack && (
              <Button variant='default' onClick={onBack}>
                Back
              </Button>
            )}
            <Button variant='subtle' onClick={() => onNext()}>
              Skip for now
            </Button>
          </Group>
          {connected || error ? (
            <Button rightSection={<FontAwesomeIcon icon={faArrowRight} />} onClick={() => onNext()}>
              Continue
            </Button>
          ) : (
            <Button type='submit' loading={saving} leftSection={<FontAwesomeIcon icon={faPlug} />}>
              Save and test
            </Button>
          )}
        </Group>
      </Stack>
    </form>
  );
}
