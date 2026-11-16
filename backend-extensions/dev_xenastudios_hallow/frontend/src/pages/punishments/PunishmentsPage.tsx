import { faBan, faCommentSlash, faGavel, faUserSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Skeleton, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import Button from '@/elements/buttons/Button.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import getPunishments from '../../api/network/getPunishments.ts';
import ComingNext from '../../components/ComingNext.tsx';
import ControlPlaneError from '../../components/ControlPlaneError.tsx';
import MetricCard from '../../components/MetricCard.tsx';
import PlayerSearch, { usePlayerName } from '../../components/PlayerSearch.tsx';
import PunishmentTable from '../../components/PunishmentTable.tsx';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';

function History({ name }: { name: string }) {
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: hallowQueryKeys.punishments(name),
    queryFn: () => getPunishments(name),
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

  const records = data.punishments;
  const count = (kind: string) => records.filter((record) => record.kind === kind).length;
  const activeBan = records.some((record) => record.kind === 'ban' && record.active);
  const activeMute = records.some((record) => record.kind === 'mute' && record.active);

  return (
    <Stack gap='lg'>
      <div className='grid gap-4 sm:grid-cols-3'>
        <MetricCard
          icon={faBan}
          label='Ban'
          value={activeBan ? 'Banned' : 'Not banned'}
          color={activeBan ? 'red' : 'teal'}
          hint={`${count('ban')} ${count('ban') === 1 ? 'ban' : 'bans'} on record`}
        />
        <MetricCard
          icon={faCommentSlash}
          label='Mute'
          value={activeMute ? 'Muted' : 'Not muted'}
          color={activeMute ? 'orange' : 'teal'}
          hint={`${count('mute')} ${count('mute') === 1 ? 'mute' : 'mutes'} on record`}
        />
        <MetricCard
          icon={faGavel}
          label='Kicks and warnings'
          value={count('kick') + count('warn')}
          color='gray'
          hint={`${count('kick')} kicks · ${count('warn')} warnings`}
        />
      </div>
      <PunishmentTable punishments={records} />
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

export default function PunishmentsPage() {
  const [name, setName] = usePlayerName();

  return (
    <AdminContentContainer title='Punishments' subtitle="Bans, mutes, kicks and warnings on a player's record.">
      <Stack gap='lg'>
        <PlayerSearch value={name} onSearch={setName} />
        {name ? (
          <History key={name.toLowerCase()} name={name} />
        ) : (
          <ComingNext
            icon={faGavel}
            title="Look up a player's record"
            today={[
              'Full history per player, newest first',
              'Whether a ban or mute is active, and when it ends',
              'Who issued each one: staff, console, system or anticheat',
            ]}
            next={[
              'Issue and revoke from the panel, once panel staff are linked to their Minecraft accounts',
              'A network-wide log of recent punishments',
              'Reason templates, IP bans and appeals',
            ]}
          >
            Staff issue punishments in game today. The control plane keeps them in PostgreSQL, so this page needs a
            control plane with a database.
          </ComingNext>
        )}
        {!name && (
          <Text size='xs' c='dimmed'>
            The control plane looks punishments up by player name only; there is no list of all punishments yet.
          </Text>
        )}
      </Stack>
    </AdminContentContainer>
  );
}
