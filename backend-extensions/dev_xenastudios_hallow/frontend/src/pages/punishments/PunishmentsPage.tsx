import { faFileLines, faGavel, faList, faUserSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { Pagination } from '@/elements/data-display/Table.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Select from '@/elements/input/Select.tsx';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import Tabs from '@/elements/layout/Tabs.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import searchPunishments from '../../api/moderation/searchPunishments.ts';
import ControlPlaneError from '../../components/ControlPlaneError.tsx';
import IssuePunishmentModal from '../../components/IssuePunishmentModal.tsx';
import PlayerSearch, { usePlayerName } from '../../components/PlayerSearch.tsx';
import PunishmentLogTable from '../../components/PunishmentLogTable.tsx';
import RevokePunishmentModal from '../../components/RevokePunishmentModal.tsx';
import type { PunishmentEntry } from '../../lib/moderation.ts';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';
import TemplatesPanel from './TemplatesPanel.tsx';

const KIND_FILTERS = [
  { value: 'all', label: 'All types' },
  { value: 'ban', label: 'Bans' },
  { value: 'mute', label: 'Mutes' },
  { value: 'kick', label: 'Kicks' },
  { value: 'warn', label: 'Warnings' },
];

const PER_PAGE = 25;

function PunishmentLog({ canManage, onIssue }: { canManage: boolean; onIssue: () => void }) {
  // The player filter lives in `?name=`, so a profile can link here.
  const [player, setPlayer] = usePlayerName();
  const [kind, setKind] = useState('all');
  const [state, setState] = useState('all');
  const [page, setPage] = useState(1);
  const [revoking, setRevoking] = useState<PunishmentEntry | null>(null);

  useEffect(() => setPage(1), [player, kind, state]);

  const filters = {
    player,
    kind: kind === 'all' ? null : kind,
    active: state === 'all' ? null : state === 'active',
    page,
    perPage: PER_PAGE,
  };
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: hallowQueryKeys.punishmentSearch(filters),
    queryFn: () => searchPunishments(filters),
    placeholderData: keepPreviousData,
    retry: false,
    refetchInterval: 30_000,
  });

  return (
    <Stack gap='md'>
      {revoking && (
        <RevokePunishmentModal
          opened
          onClose={() => setRevoking(null)}
          kind={revoking.kind === 'mute' ? 'mute' : 'ban'}
          target={revoking.target_name}
        />
      )}
      <Group justify='space-between' align='flex-end' gap='sm'>
        <Group align='flex-end' gap='sm' className='flex-1'>
          <div className='flex-1 min-w-64 max-w-md'>
            <PlayerSearch value={player} onSearch={setPlayer} placeholder='Filter by player' />
          </div>
          <Select aria-label='Type' className='w-36' data={KIND_FILTERS} value={kind} onChange={(v) => setKind(v ?? 'all')} />
          <SegmentedControl
            value={state}
            onChange={setState}
            data={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'ended', label: 'Ended' },
            ]}
          />
          {player && (
            <Button variant='subtle' size='xs' onClick={() => setPlayer('')}>
              Clear player
            </Button>
          )}
        </Group>
        {canManage && (
          <Button color='red' leftSection={<FontAwesomeIcon icon={faGavel} />} onClick={onIssue}>
            Issue punishment
          </Button>
        )}
      </Group>

      {error ? (
        <ControlPlaneError error={error} onRetry={refetch} retrying={isFetching} />
      ) : data && !data.known ? (
        <Alert color='gray' icon={<FontAwesomeIcon icon={faUserSlash} />} title='No such player'>
          Nobody called <b>{player}</b> has joined the network.
        </Alert>
      ) : (
        <>
          <PunishmentLogTable
            entries={data?.punishments.entries ?? []}
            loading={isLoading}
            canManage={canManage}
            onRevoke={setRevoking}
          />
          {data && (
            <Pagination
              data={{
                total: data.punishments.total,
                perPage: data.per_page,
                page: data.page,
                data: data.punishments.entries,
              }}
              onPageSelect={setPage}
            />
          )}
        </>
      )}
    </Stack>
  );
}

export default function PunishmentsPage() {
  const canManage = useAdminCan('hallow.punishments.manage');
  const [tab, setTab] = useState<string | null>('log');
  const [issuing, setIssuing] = useState(false);

  return (
    <AdminContentContainer
      title='Punishments'
      subtitle='Bans, mutes, kicks and warnings across the network. A ban here reaches every proxy at once.'
    >
      <IssuePunishmentModal opened={issuing} onClose={() => setIssuing(false)} />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb='md'>
          <Tabs.Tab value='log' leftSection={<FontAwesomeIcon icon={faList} />}>
            All punishments
          </Tabs.Tab>
          <Tabs.Tab value='templates' leftSection={<FontAwesomeIcon icon={faFileLines} />}>
            Templates
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value='log'>
          <PunishmentLog canManage={canManage} onIssue={() => setIssuing(true)} />
        </Tabs.Panel>
        <Tabs.Panel value='templates'>{tab === 'templates' && <TemplatesPanel canManage={canManage} />}</Tabs.Panel>
      </Tabs>
    </AdminContentContainer>
  );
}
