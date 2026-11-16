import { Stack } from '@mantine/core';
import { ReactNode, useEffect, useRef } from 'react';
import Checkbox from '@/elements/input/Checkbox.tsx';
import TextInput from '@/elements/input/TextInput.tsx';

interface Props {
  label: string;
  description?: string;
  /** A decimal string, or null for no limit. */
  value: string | null;
  onChange: (value: string | null) => void;
  currency?: string;
  error?: ReactNode;
  disabled?: boolean;
}

/** A money amount kept as a decimal string (exact, unlike a float), with a "No limit" toggle. */
export default function LimitInput({ label, description, value, onChange, currency, error, disabled }: Props) {
  // Remember the last amount so unticking "No limit" brings it back.
  const lastAmount = useRef(value ?? '');
  useEffect(() => {
    if (value !== null) lastAmount.current = value;
  }, [value]);

  const noLimit = value === null;

  return (
    <Stack gap={6}>
      <TextInput
        label={label}
        description={description}
        inputMode='decimal'
        placeholder={noLimit ? 'No limit' : '0.00'}
        value={value ?? ''}
        disabled={disabled || noLimit}
        rightSection={currency ? <span className='text-xs text-(--mantine-color-dimmed)'>{currency}</span> : null}
        rightSectionWidth={currency ? 48 : undefined}
        error={error}
        onChange={(event) => onChange(event.currentTarget.value.replace(',', '.').trim())}
      />
      <Checkbox
        label='No limit'
        size='xs'
        checked={noLimit}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked ? null : lastAmount.current || '0')}
      />
    </Stack>
  );
}
