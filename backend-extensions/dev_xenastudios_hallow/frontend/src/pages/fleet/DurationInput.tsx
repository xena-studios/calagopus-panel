import { Group, Input } from '@mantine/core';
import { ReactNode, useEffect, useRef, useState } from 'react';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import { formatDuration } from '../../lib/fleet.ts';

const UNITS = [
  { value: 's', label: 'seconds', seconds: 1 },
  { value: 'm', label: 'minutes', seconds: 60 },
  { value: 'h', label: 'hours', seconds: 3600 },
] as const;

type Unit = (typeof UNITS)[number]['value'];

function unitSeconds(unit: Unit): number {
  return UNITS.find((u) => u.value === unit)?.seconds ?? 1;
}

/** The largest unit the value is a whole number of. */
function pickUnit(seconds: number): Unit {
  if (seconds >= 3600 && seconds % 3600 === 0) return 'h';
  if (seconds >= 60 && seconds % 60 === 0) return 'm';
  return 's';
}

interface Props {
  label: string;
  description?: string;
  value: number;
  onChange: (seconds: number) => void;
  error?: ReactNode;
  disabled?: boolean;
}

/** A duration stored as whole seconds, entered in seconds, minutes or hours. */
export default function DurationInput({ label, description, value, onChange, error, disabled }: Props) {
  const [unit, setUnit] = useState<Unit>(() => pickUnit(value));
  const emitted = useRef(value);

  // A value from outside (loading, discarding, a save) picks its best unit again.
  useEffect(() => {
    if (value !== emitted.current) {
      setUnit(pickUnit(value));
      emitted.current = value;
    }
  }, [value]);

  const factor = unitSeconds(unit);

  return (
    <Input.Wrapper
      label={label}
      description={description ? `${description} Now: ${formatDuration(value)}.` : `Now: ${formatDuration(value)}.`}
      error={error}
    >
      <Group gap='xs' wrap='nowrap' mt={4}>
        <NumberInput
          className='flex-1'
          placeholder={label}
          min={0}
          decimalScale={2}
          value={Math.round((value / factor) * 100) / 100}
          error={!!error}
          disabled={disabled}
          onChange={(raw) => {
            const amount = typeof raw === 'number' ? raw : Number.parseFloat(raw);
            const seconds = Number.isFinite(amount) ? Math.max(0, Math.round(amount * factor)) : 0;
            emitted.current = seconds;
            onChange(seconds);
          }}
        />
        <Select
          w={120}
          data={UNITS.map((u) => ({ value: u.value, label: u.label }))}
          value={unit}
          disabled={disabled}
          onChange={(next) => next && setUnit(next as Unit)}
          aria-label={`${label} unit`}
        />
      </Group>
    </Input.Wrapper>
  );
}
