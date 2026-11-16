import type { MantineColor } from '@mantine/core';
import type { ReactNode } from 'react';
import { type IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Progress, Skeleton } from '@mantine/core';
import Card from '@/elements/data-display/Card.tsx';
import ThemeIcon from '@/elements/data-display/ThemeIcon.tsx';

// A stat tile: label, one big number, a line of context underneath.
export default function MetricCard({
  icon,
  label,
  value,
  suffix,
  hint,
  color = 'hallow',
  progress,
  loading,
}: {
  icon: IconDefinition;
  label: string;
  value: ReactNode;
  suffix?: ReactNode;
  hint?: ReactNode;
  color?: MantineColor;
  progress?: number | null;
  loading?: boolean;
}) {
  return (
    <Card className='hallow-metric'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex flex-col min-w-0'>
          <span className='hallow-metric-label'>{label}</span>
          {loading ? (
            <Skeleton height={32} width={72} mt={6} radius='sm' />
          ) : (
            <span className='hallow-metric-value'>
              {value}
              {suffix !== undefined && <span className='hallow-metric-suffix'>{suffix}</span>}
            </span>
          )}
        </div>
        <ThemeIcon size={38} radius='md' variant='light' color={color}>
          <FontAwesomeIcon icon={icon} />
        </ThemeIcon>
      </div>
      {progress !== undefined && progress !== null && !loading && (
        <Progress value={Math.min(100, Math.max(0, progress))} color={color} size='sm' radius='xl' mt='sm' />
      )}
      {hint && !loading && <span className='hallow-metric-hint'>{hint}</span>}
    </Card>
  );
}
