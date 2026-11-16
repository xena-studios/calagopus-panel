import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';

// The searched name lives in `?name=`, so a lookup can be linked and survives a reload.
export function usePlayerName(): [string, (name: string) => void] {
  const [params, setParams] = useSearchParams();
  const name = (params.get('name') ?? '').trim();

  return [
    name,
    (next: string) => {
      const trimmed = next.trim();
      setParams(trimmed ? { name: trimmed } : {}, { replace: false });
    },
  ];
}

export default function PlayerSearch({
  value,
  onSearch,
  loading,
  placeholder = 'Player name, such as Steve',
}: {
  value: string;
  onSearch: (name: string) => void;
  loading?: boolean;
  placeholder?: string;
}) {
  const [input, setInput] = useState(value);

  useEffect(() => setInput(value), [value]);

  return (
    <form
      className='flex gap-2 items-end w-full max-w-xl'
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(input);
      }}
    >
      <TextInput
        className='flex-1'
        aria-label='Player name'
        placeholder={placeholder}
        leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} />}
        value={input}
        maxLength={32}
        onChange={(event) => setInput(event.currentTarget.value)}
      />
      <Button type='submit' loading={loading} disabled={!input.trim()}>
        Look up
      </Button>
    </form>
  );
}
