import { faArrowRight, faCubes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Skeleton, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { getInstances } from '../../api/instances.ts';
import { countByState, INSTANCE_STATE_DOTS, INSTANCE_STATE_LABELS, INSTANCE_STATES } from '../../lib/instances.ts';
import { hallowQueryKeys } from '../../lib/queryKeys.ts';

export const INSTANCES_PATH = '/admin/hallow/instances';

const REFRESH_MS = 5_000;

function Summary() {
  const { data, error, isLoading } = useQuery({
    queryKey: hallowQueryKeys.instances(),
    queryFn: getInstances,
    refetchInterval: REFRESH_MS,
    retry: false,
  });

  const instances = data?.instances ?? [];
  const counts = countByState(instances);
  const players = instances.reduce((sum, instance) => sum + instance.players, 0);

  return (
    <section>
      <Group justify='space-between' mb='xs'>
        <Group gap='xs'>
          <FontAwesomeIcon icon={faCubes} className='text-(--mantine-color-dimmed)' />
          <Text fw={650}>Instances</Text>
        </Group>
        <Link to={INSTANCES_PATH}>
          <Button variant='subtle' size='xs' rightSection={<FontAwesomeIcon icon={faArrowRight} />}>
            All instances
          </Button>
        </Link>
      </Group>
      <Card>
        {error && !data ? (
          <Text size='sm' c='dimmed'>
            {httpErrorToHuman(error)}
          </Text>
        ) : (
          <div className='flex flex-col gap-3'>
            <div className='grid gap-3 grid-cols-3 lg:grid-cols-6'>
              {INSTANCE_STATES.map((state) => (
                <Link
                  key={state}
                  to={`${INSTANCES_PATH}?state=${state}`}
                  className='hallow-state-tile'
                  data-empty={counts[state] === 0 || undefined}
                >
                  <span className='flex items-center gap-1.5 text-xs text-(--mantine-color-dimmed)'>
                    <span className='hallow-status-dot' data-status={INSTANCE_STATE_DOTS[state]} />
                    {INSTANCE_STATE_LABELS[state]}
                  </span>
                  {isLoading ? (
                    <Skeleton height={24} width={32} mt={4} radius='sm' />
                  ) : (
                    <span className='hallow-state-tile-value'>{counts[state]}</span>
                  )}
                </Link>
              ))}
            </div>
            {!isLoading && (
              <Text size='xs' c='dimmed'>
                {instances.length === 0
                  ? 'The control plane runs no instances right now. It starts them for queues and keeps warm ones ready.'
                  : `${instances.length} ${instances.length === 1 ? 'instance' : 'instances'} · ${players} ${
                      players === 1 ? 'player' : 'players'
                    } in them`}
              </Text>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}

// The Overview's instance counts by state, linking to the Instances page. Hidden without the permission.
export default function InstancesSummary() {
  const canRead = useAdminCan('hallow.instances.read');
  return canRead ? <Summary /> : null;
}
