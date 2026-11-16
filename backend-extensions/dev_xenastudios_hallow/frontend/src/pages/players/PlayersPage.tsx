import {
  faBan,
  faCommentSlash,
  faCrown,
  faGavel,
  faLocationDot,
  faRightFromBracket,
  faRotateLeft,
  faTriangleExclamation,
  faShieldHalved,
  faTowerBroadcast,
  faUserSlash,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Avatar, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import Button from '@/elements/buttons/Button.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Tabs from '@/elements/layout/Tabs.tsx';
import Code from '@/elements/typography/Code.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import getPlayer from '../../api/network/getPlayer.ts';
import getPunishments from '../../api/network/getPunishments.ts';
import getSignals from '../../api/network/getSignals.ts';
import ComingNext from '../../components/ComingNext.tsx';
import ControlPlaneError from '../../components/ControlPlaneError.tsx';
import IssuePunishmentModal from '../../components/IssuePunishmentModal.tsx';
import PlayerRanksCard from '../../components/PlayerRanksCard.tsx';
import PlayerSearch, { usePlayerName } from '../../components/PlayerSearch.tsx';
import PunishmentTable from '../../components/PunishmentTable.tsx';
import RevokePunishmentModal from '../../components/RevokePunishmentModal.tsx';
import SignalTable, { SignalSummary } from '../../components/SignalTable.tsx';
import StatusBadge from '../../components/StatusBadge.tsx';
import type { PunishmentKind } from '../../lib/moderation.ts';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';

function Detail({ icon, label, children }: { icon: typeof faUsers; label: string; children: React.ReactNode }) {
  return (
    <div className='flex items-center gap-2 min-w-0'>
      <FontAwesomeIcon icon={icon} className='text-(--mantine-color-dimmed)' fixedWidth />
      <span className='hallow-metric-label normal-case! tracking-normal!'>{label}</span>
      <span className='truncate text-sm'>{children}</span>
    </div>
  );
}

function PlayerProfile({ name }: { name: string }) {
  const canPunishments = useAdminCan('hallow.punishments.read');
  const canSignals = useAdminCan('hallow.anticheat.read');
  const canManage = useAdminCan('hallow.punishments.manage');
  const canRanks = useAdminCan('hallow.ranks.read');
  const canManageRanks = useAdminCan('hallow.ranks.manage');
  const [tab, setTab] = useState<string | null>(
    canPunishments ? 'punishments' : canSignals ? 'anticheat' : 'ranks',
  );
  const [issuing, setIssuing] = useState<PunishmentKind | null>(null);
  const [revoking, setRevoking] = useState<'ban' | 'mute' | null>(null);

  const presence = useQuery({
    queryKey: hallowQueryKeys.player(name),
    queryFn: () => getPlayer(name),
    retry: false,
    refetchInterval: 15_000,
  });
  const punishments = useQuery({
    queryKey: hallowQueryKeys.punishments(name),
    queryFn: () => getPunishments(name),
    retry: false,
    enabled: canPunishments,
  });
  const signals = useQuery({
    queryKey: hallowQueryKeys.signals(name),
    queryFn: () => getSignals(name),
    retry: false,
    enabled: canSignals,
  });

  if (presence.error) {
    return <ControlPlaneError error={presence.error} onRetry={presence.refetch} retrying={presence.isFetching} />;
  }

  const player = presence.data;
  const known = player !== null || punishments.data?.known || signals.data?.known;
  const historyLoaded = (!canPunishments || punishments.data) && (!canSignals || signals.data);

  if (presence.isLoading) {
    return (
      <Card>
        <Group>
          <Skeleton circle height={56} />
          <Stack gap={8} className='flex-1'>
            <Skeleton height={18} width='30%' />
            <Skeleton height={12} width='50%' />
          </Stack>
        </Group>
      </Card>
    );
  }

  if (!known && historyLoaded) {
    return (
      <Alert color='gray' icon={<FontAwesomeIcon icon={faUserSlash} />} title='No such player'>
        Nobody called <b>{name}</b> has joined the network.
      </Alert>
    );
  }

  const activePunishments = punishments.data?.punishments.filter((p) => p.active) ?? [];
  const activeBan = activePunishments.find((p) => p.kind === 'ban');
  const activeMute = activePunishments.find((p) => p.kind === 'mute');

  const username = player?.username ?? name;

  return (
    <Stack gap='lg'>
      <IssuePunishmentModal
        opened={issuing !== null}
        onClose={() => setIssuing(null)}
        target={username}
        kind={issuing ?? 'ban'}
      />
      {revoking && (
        <RevokePunishmentModal opened onClose={() => setRevoking(null)} kind={revoking} target={username} />
      )}
      <Card className='hallow-profile'>
        <div className='flex flex-col md:flex-row md:items-center gap-4'>
          <Avatar size={64} radius='md' color='hallow' variant='light'>
            {(player?.username ?? name).slice(0, 2).toUpperCase()}
          </Avatar>
          <Stack gap={6} className='flex-1 min-w-0'>
            <Group gap='sm'>
              <Title order={2}>{player?.username ?? name}</Title>
              <StatusBadge status={player ? 'online' : 'offline'} />
              {activeBan && <StatusBadge status='offline' label='Banned' />}
              {activeMute && <StatusBadge status='draining' label='Muted' />}
            </Group>
            {player ? (
              <div className='grid gap-2 md:grid-cols-3'>
                <Detail icon={faTowerBroadcast} label='Proxy'>
                  {player.proxy}
                </Detail>
                <Detail icon={faLocationDot} label='Server'>
                  {player.server ?? 'Between servers'}
                </Detail>
                <Detail icon={faUsers} label='UUID'>
                  <Code>{player.uuid}</Code>
                </Detail>
              </div>
            ) : (
              <Text size='sm' c='dimmed'>
                Not online right now. Their history below is kept by the control plane.
              </Text>
            )}
          </Stack>
          {canManage && (
            <Group gap='xs' className='md:self-start'>
              {activeBan ? (
                <Button
                  variant='light'
                  color='teal'
                  leftSection={<FontAwesomeIcon icon={faRotateLeft} />}
                  onClick={() => setRevoking('ban')}
                >
                  Unban
                </Button>
              ) : (
                <Button color='red' leftSection={<FontAwesomeIcon icon={faBan} />} onClick={() => setIssuing('ban')}>
                  Ban
                </Button>
              )}
              {activeMute ? (
                <Button
                  variant='light'
                  color='teal'
                  leftSection={<FontAwesomeIcon icon={faRotateLeft} />}
                  onClick={() => setRevoking('mute')}
                >
                  Unmute
                </Button>
              ) : (
                <Button
                  variant='light'
                  color='orange'
                  leftSection={<FontAwesomeIcon icon={faCommentSlash} />}
                  onClick={() => setIssuing('mute')}
                >
                  Mute
                </Button>
              )}
              <Tooltip label='Only players who are online can be kicked' disabled={!!player}>
                <Button
                  variant='light'
                  color='yellow'
                  leftSection={<FontAwesomeIcon icon={faRightFromBracket} />}
                  disabled={!player}
                  onClick={() => setIssuing('kick')}
                >
                  Kick
                </Button>
              </Tooltip>
              <Button
                variant='default'
                leftSection={<FontAwesomeIcon icon={faTriangleExclamation} />}
                onClick={() => setIssuing('warn')}
              >
                Warn
              </Button>
            </Group>
          )}
        </div>
      </Card>

      {(canPunishments || canSignals || canRanks) && (
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List mb='md'>
            {canPunishments && (
              <Tabs.Tab value='punishments' leftSection={<FontAwesomeIcon icon={faGavel} />}>
                Punishments{punishments.data ? ` (${punishments.data.punishments.length})` : ''}
              </Tabs.Tab>
            )}
            {canSignals && (
              <Tabs.Tab value='anticheat' leftSection={<FontAwesomeIcon icon={faShieldHalved} />}>
                Anticheat signals{signals.data ? ` (${signals.data.signals.length})` : ''}
              </Tabs.Tab>
            )}
            {canRanks && (
              <Tabs.Tab value='ranks' leftSection={<FontAwesomeIcon icon={faCrown} />}>
                Ranks
              </Tabs.Tab>
            )}
          </Tabs.List>

          <Tabs.Panel value='punishments'>
            {punishments.error ? (
              <ControlPlaneError error={punishments.error} onRetry={punishments.refetch} />
            ) : punishments.data ? (
              <Stack gap='xs'>
                <PunishmentTable punishments={punishments.data.punishments} />
                <Group justify='flex-end'>
                  <Link to={`/admin/hallow/punishments?name=${encodeURIComponent(username)}`}>
                    <Button variant='subtle' size='xs'>
                      Full history
                    </Button>
                  </Link>
                </Group>
              </Stack>
            ) : (
              <Skeleton height={120} radius='md' />
            )}
          </Tabs.Panel>
          <Tabs.Panel value='anticheat'>
            {signals.error ? (
              <ControlPlaneError error={signals.error} onRetry={signals.refetch} />
            ) : signals.data ? (
              <Stack>
                <SignalSummary signals={signals.data.signals} />
                <SignalTable signals={signals.data.signals} />
              </Stack>
            ) : (
              <Skeleton height={120} radius='md' />
            )}
          </Tabs.Panel>
          <Tabs.Panel value='ranks'>
            {tab === 'ranks' && <PlayerRanksCard name={username} canManage={canManageRanks} />}
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  );
}

export default function PlayersPage() {
  const [name, setName] = usePlayerName();

  return (
    <AdminContentContainer title='Players' subtitle='Find a player: where they are now, their punishments and signals.'>
      <Stack gap='lg'>
        <PlayerSearch value={name} onSearch={setName} />
        {name ? (
          <PlayerProfile key={name.toLowerCase()} name={name} />
        ) : (
          <ComingNext
            icon={faUsers}
            title='Look a player up by name'
            today={[
              'Online status, proxy and server, from live presence',
              'Punishment history, active bans and mutes',
              'Recent anticheat signal samples, and their ranks',
              'Ban, mute, kick or warn in one click',
            ]}
            next={[
              'Search by UUID and IP, and a list of who is online',
              'Profiles with stats, sessions and alts',
              'Chat and command logs',
            ]}
          >
            Names match without case; the most recently seen account wins. The control plane only looks players up by
            name today, so there is no browsable list yet.
          </ComingNext>
        )}
      </Stack>
    </AdminContentContainer>
  );
}
