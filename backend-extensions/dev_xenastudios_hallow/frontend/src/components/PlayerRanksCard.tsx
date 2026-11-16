import { faCrown, faPlus, faTriangleExclamation, faUserSlash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Skeleton, Stack, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Select from '@/elements/input/Select.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { getPlayerRanks, getRanks, grantRank, revokeRank } from '../api/moderation/ranks.ts';
import { DURATION_PRESETS } from '../lib/moderation.ts';
import { hallowQueryKeys } from '../lib/queryKeys.ts';
import ControlPlaneError from './ControlPlaneError.tsx';

// A player's Hallow ranks: what they hold, the nodes those give, and giving or taking one. Nodes reach
// the proxy with the login, so changes apply at the player's next join.
export default function PlayerRanksCard({ name, canManage }: { name: string; canManage: boolean }) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [rank, setRank] = useState<string | null>(null);
  const [length, setLength] = useState<string>((DURATION_PRESETS.length - 1).toString());
  const [granting, setGranting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const player = useQuery({
    queryKey: hallowQueryKeys.playerRanks(name),
    queryFn: () => getPlayerRanks(name),
    retry: false,
  });
  const ranks = useQuery({ queryKey: hallowQueryKeys.ranks(), queryFn: getRanks, retry: false, enabled: canManage });

  if (player.error) return <ControlPlaneError error={player.error} onRetry={player.refetch} />;
  if (player.isLoading) return <Skeleton height={120} radius='md' />;
  if (!player.data) {
    return (
      <Alert color='gray' icon={<FontAwesomeIcon icon={faUserSlash} />} title='No such player'>
        Nobody called <b>{name}</b> has joined the network.
      </Alert>
    );
  }

  const data = player.data;
  const grantable = (ranks.data ?? []).filter((r) => !r.is_default);
  const refresh = (next: typeof data) => {
    queryClient.setQueryData(hallowQueryKeys.playerRanks(name), next);
    queryClient.invalidateQueries({ queryKey: hallowQueryKeys.ranks() });
  };

  return (
    <Card>
      <ConfirmationModal
        opened={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Take ${removing} from ${data.username}?`}
        confirm='Take rank'
        onConfirmed={async () => {
          if (!removing) return;
          const next = await revokeRank(data.username, removing);
          refresh(next);
          addToast(`Took ${removing} from ${data.username}.`, 'success');
          setRemoving(null);
        }}
      >
        They lose its permissions the next time they join.
      </ConfirmationModal>
      <Stack gap='md'>
        <div>
          <Text size='sm' fw={500} mb={6}>
            Ranks
          </Text>
          <Group gap='xs'>
            {data.ranks.map((name) => {
              const grant = data.grants.find((g) => g.rank === name);
              return (
                <Badge
                  key={name}
                  size='lg'
                  variant={grant ? 'light' : 'outline'}
                  color={grant ? 'hallow' : 'gray'}
                  leftSection={grant ? <FontAwesomeIcon icon={faCrown} /> : undefined}
                  rightSection={
                    grant && canManage ? (
                      <ActionIcon
                        size='xs'
                        variant='transparent'
                        color='gray'
                        aria-label={`Take ${name}`}
                        onClick={() => setRemoving(name)}
                      >
                        <FontAwesomeIcon icon={faXmark} />
                      </ActionIcon>
                    ) : undefined
                  }
                >
                  {name}
                  {grant?.expires_ms ? (
                    <span className='opacity-70 font-normal normal-case'>
                      {' '}
                      until <FormattedTimestamp timestamp={grant.expires_ms} />
                    </span>
                  ) : null}
                  {!grant && <span className='opacity-70 font-normal normal-case'> · everyone</span>}
                </Badge>
              );
            })}
          </Group>
        </div>
        <div>
          <Text size='sm' fw={500} mb={6}>
            Permission nodes
          </Text>
          {data.permissions.length === 0 ? (
            <Text size='sm' c='dimmed'>
              None: no staff commands in game.
            </Text>
          ) : (
            <Group gap={6}>
              {data.permissions.map((node) => (
                <Code key={node}>{node}</Code>
              ))}
            </Group>
          )}
        </div>
        {canManage && (
          <Group align='flex-end' gap='sm'>
            <Select
              label='Give a rank'
              className='w-48'
              placeholder={ranks.isLoading ? 'Loading...' : 'Pick a rank'}
              data={grantable.map((r) => ({ value: r.name, label: r.name }))}
              value={rank}
              onChange={setRank}
              error={ranks.error ? httpErrorToHuman(ranks.error) : undefined}
            />
            <Select
              label='For'
              className='w-36'
              data={DURATION_PRESETS.map((p, index) => ({ value: index.toString(), label: p.label }))}
              value={length}
              onChange={(value) => value && setLength(value)}
            />
            <Tooltip label='Applies at their next join'>
              <Button
                leftSection={<FontAwesomeIcon icon={faPlus} />}
                disabled={!rank}
                loading={granting}
                onClick={() => {
                  if (!rank) return;
                  setGranting(true);
                  grantRank(data.username, rank, DURATION_PRESETS[Number(length)].seconds)
                    .then((next) => {
                      refresh(next);
                      addToast(`Gave ${data.username} ${rank}.`, 'success');
                      setRank(null);
                    })
                    .catch((err) => addToast(httpErrorToHuman(err), 'error'))
                    .finally(() => setGranting(false));
                }}
              >
                Give
              </Button>
            </Tooltip>
          </Group>
        )}
        {canManage && grantable.length === 0 && ranks.data && (
          <Alert color='gray' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
            Only the default rank exists. Create a staff rank first.
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
