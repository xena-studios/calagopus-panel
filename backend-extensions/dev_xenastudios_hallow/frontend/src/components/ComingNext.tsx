import type { ReactNode } from 'react';
import { faCircleCheck, faHourglassHalf, type IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Stack, Text, Title } from '@mantine/core';
import Card from '@/elements/data-display/Card.tsx';
import ThemeIcon from '@/elements/data-display/ThemeIcon.tsx';

// A placeholder that says what the page will do, what works today and what it waits on.
export default function ComingNext({
  icon,
  title,
  children,
  today = [],
  next,
}: {
  icon: IconDefinition;
  title: string;
  children: ReactNode;
  today?: ReactNode[];
  next: ReactNode[];
}) {
  return (
    <Card className='hallow-coming-next'>
      <div className='flex flex-col md:flex-row gap-5'>
        <ThemeIcon size={52} radius='md' variant='light' color='hallow'>
          <FontAwesomeIcon icon={icon} size='lg' />
        </ThemeIcon>
        <Stack gap='sm' className='flex-1 min-w-0'>
          <div>
            <Title order={3}>{title}</Title>
            <Text c='dimmed' size='sm' mt={4}>
              {children}
            </Text>
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            {today.length > 0 && (
              <div>
                <span className='hallow-metric-label'>Works today</span>
                <ul className='hallow-checklist'>
                  {today.map((item, index) => (
                    <li key={index}>
                      <FontAwesomeIcon icon={faCircleCheck} className='text-(--mantine-color-teal-text)' />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <span className='hallow-metric-label'>Coming next</span>
              <ul className='hallow-checklist'>
                {next.map((item, index) => (
                  <li key={index}>
                    <FontAwesomeIcon icon={faHourglassHalf} className='text-(--mantine-color-dimmed)' />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Stack>
      </div>
    </Card>
  );
}
