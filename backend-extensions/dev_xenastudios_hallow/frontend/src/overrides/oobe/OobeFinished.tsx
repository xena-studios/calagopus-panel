import { faArrowRight, faCheckCircle, faCogs, faPlug, faUsers } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import updateOobeSettings from '@/api/admin/settings/updateOobeSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import ThemeIcon from '@/elements/data-display/ThemeIcon.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Group from '@/elements/layout/Group.tsx';
import Paper from '@/elements/layout/Paper.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import getExtensionSettings from '../../api/getExtensionSettings.ts';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';

function Item({
  icon,
  title,
  detail,
  skipped,
}: {
  icon: typeof faUsers;
  title: string;
  detail?: string;
  skipped?: boolean;
}) {
  return (
    <Group gap='xs'>
      <ThemeIcon size='sm' radius='xl' color='hallow' variant='light'>
        <FontAwesomeIcon icon={icon} size='xs' />
      </ThemeIcon>
      <div className='flex-1'>
        <Text size='sm' fw={500}>
          {title}
        </Text>
        {detail && (
          <Text size='xs' c='dimmed'>
            {detail}
          </Text>
        )}
      </div>
      {skipped && (
        <Badge color='yellow' size='sm'>
          Skipped
        </Badge>
      )}
    </Group>
  );
}

export default function OobeFinished() {
  const { user } = useAuth();
  const settings = useGlobalStore((state) => state.settings);
  const setSettings = useGlobalStore((state) => state.setSettings);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: hallow } = useResource({
    queryKey: hallowQueryKeys.extensionSettings(),
    queryFn: getExtensionSettings,
    silent: true,
  });
  const controlPlaneSet = !!hallow?.controlPlaneUrl && hallow.controlPlaneTokenSet;

  const handleFinish = () => {
    setLoading(true);

    updateOobeSettings(null)
      .then(() => {
        setSettings({ ...settings, oobeStep: null });
        navigate('/admin');
      })
      .catch((err) => setError(httpErrorToHuman(err)))
      .finally(() => setLoading(false));
  };

  return (
    <Stack gap='xl'>
      <div>
        <Title order={2} ta='center' mb='xs'>
          All set
        </Title>
        <Text size='lg' ta='center' c='dimmed'>
          {settings.app.name} is ready to run the network.
        </Text>
      </div>

      <Paper p='lg' withBorder radius='md'>
        <Group mb='md'>
          <FontAwesomeIcon icon={faCheckCircle} style={{ color: 'var(--mantine-color-teal-6)' }} />
          <Text fw={600} size='sm'>
            What is set up
          </Text>
        </Group>

        <Stack gap='sm'>
          <Item icon={faUsers} title='Administrator account' detail={user ? `${user.username} (${user.email})` : undefined} />
          <Divider />
          <Item icon={faCogs} title='Panel settings' detail={`${settings.app.name} at ${settings.app.url}`} />
          <Divider />
          <Item
            icon={faPlug}
            title='Control plane'
            detail={controlPlaneSet ? hallow?.controlPlaneUrl : 'Connect it later under Overview > Network settings'}
            skipped={hallow !== undefined && !controlPlaneSet}
          />
        </Stack>
      </Paper>

      {error && <AlertError error={error} setError={setError} />}

      <Group justify='center' mt='lg'>
        <Button size='lg' rightSection={<FontAwesomeIcon icon={faArrowRight} />} onClick={handleFinish} loading={loading}>
          Open the network overview
        </Button>
      </Group>
    </Stack>
  );
}
