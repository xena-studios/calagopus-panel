import { faClockRotateLeft, faSliders } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { Link } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Tabs from '@/elements/layout/Tabs.tsx';
import { useResource } from '@/plugins/resource/useResource.ts';
import getFleetSettings from '../../api/fleet/getFleetSettings.ts';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';
import FleetSettingsForm from './FleetSettingsForm.tsx';
import FleetSettingsHistory from './FleetSettingsHistory.tsx';

function errorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

// Admin > Fleet settings: every setting of the control plane's fleet manager (docs/FLEET.md in
// the Hallow repo), read and saved through /api/admin/hallow/fleet/settings.
export default function FleetSettingsPage() {
  const [tab, setTab] = useState<string | null>('settings');

  const { data, loading, error, refetch } = useResource({
    queryKey: hallowQueryKeys.fleetSettings(),
    queryFn: getFleetSettings,
    silent: true,
  });

  let settings;
  if (data) {
    settings = <FleetSettingsForm initial={data} />;
  } else if (error && errorStatus(error) === 503) {
    settings = (
      <Alert
        color='yellow'
        icon={<FontAwesomeIcon icon={faSliders} />}
        title='Control plane not configured'
      >
        {httpErrorToHuman(error)}
        <div className='mt-3'>
          <Link to='/admin/extensions/dev.xenastudios.hallow'>
            <Button variant='default' size='xs'>
              Configure the Hallow extension
            </Button>
          </Link>
        </div>
      </Alert>
    );
  } else if (error) {
    settings = <ErrorState error={httpErrorToHuman(error)} onRetry={refetch} retrying={loading} />;
  } else {
    settings = <Spinner.Centered />;
  }

  return (
    <AdminContentContainer
      title='Fleet settings'
      subtitle='How the fleet manager buys, keeps and returns machines: mode, budget, capacity, timing and providers.'
    >
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb='md'>
          <Tabs.Tab value='settings' leftSection={<FontAwesomeIcon icon={faSliders} />}>
            Settings
          </Tabs.Tab>
          <Tabs.Tab value='history' leftSection={<FontAwesomeIcon icon={faClockRotateLeft} />}>
            History
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value='settings'>{settings}</Tabs.Panel>
        <Tabs.Panel value='history'>{tab === 'history' && <FleetSettingsHistory />}</Tabs.Panel>
      </Tabs>
    </AdminContentContainer>
  );
}
