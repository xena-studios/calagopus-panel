import { faShieldHalved, faUserSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Skeleton, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import Button from '@/elements/buttons/Button.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import getSignals from '../../api/network/getSignals.ts';
import ComingNext from '../../components/ComingNext.tsx';
import ControlPlaneError from '../../components/ControlPlaneError.tsx';
import PlayerSearch, { usePlayerName } from '../../components/PlayerSearch.tsx';
import SignalTable, { SignalSummary } from '../../components/SignalTable.tsx';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';

function Signals({ name }: { name: string }) {
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: hallowQueryKeys.signals(name),
    queryFn: () => getSignals(name),
    retry: false,
  });

  if (error) return <ControlPlaneError error={error} onRetry={refetch} retrying={isFetching} />;
  if (isLoading || !data) return <Skeleton height={160} radius='md' />;
  if (!data.known) {
    return (
      <Alert color='gray' icon={<FontAwesomeIcon icon={faUserSlash} />} title='No such player'>
        Nobody called <b>{name}</b> has joined the network.
      </Alert>
    );
  }

  return (
    <Stack gap='lg'>
      <SignalSummary signals={data.signals} />
      <SignalTable signals={data.signals} />
      <Group justify='flex-end'>
        <Link to={`/admin/hallow/players?name=${encodeURIComponent(name)}`}>
          <Button variant='subtle' size='xs'>
            Open the player&apos;s profile
          </Button>
        </Link>
      </Group>
    </Stack>
  );
}

export default function AnticheatPage() {
  const [name, setName] = usePlayerName();

  return (
    <AdminContentContainer
      title='Anticheat'
      subtitle='What proxies and servers measure about how a player plays, before any check acts on it.'
    >
      <Stack gap='lg'>
        <PlayerSearch value={name} onSearch={setName} />
        {name ? (
          <Signals key={name.toLowerCase()} name={name} />
        ) : (
          <ComingNext
            icon={faShieldHalved}
            title="Review a player's signals"
            today={[
              'Recent samples per player: one per 30 second window of play',
              'Packet timing from proxies, movement and combat from servers',
              'Highest and average value of every metric',
            ]}
            next={[
              'Checks that flag players from these signals (anticheat phase 2)',
              'A queue of flagged players for staff to review',
              'Per-check thresholds and actions',
            ]}
          >
            The anticheat is collecting signals and does not act on them yet. Samples are kept for a while in the
            control plane&apos;s PostgreSQL for tuning and review.
          </ComingNext>
        )}
      </Stack>
    </AdminContentContainer>
  );
}
