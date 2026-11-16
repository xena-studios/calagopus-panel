import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Text } from '@mantine/core';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal } from '@/elements/modals/Modal.tsx';
import { getInstanceConsole } from '../api/instances.ts';
import type { InstanceInfo } from '../lib/instances.ts';

const MAX_LINES = 1_000;
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;

type Status = 'connecting' | 'connected' | 'closed';

// An instance's console: Wings' websocket for the instance's server, reached through the node's public URL
// (normally the panel's Wings proxy) with a token from the Hallow extension. Instances have no panel server
// record, so the stock console can't open them. Read and send commands only; ending an instance is the
// Instances page's power button.
export default function InstanceConsoleModal({
  instance,
  onClose,
}: {
  instance: InstanceInfo | null;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const socket = useRef<WebSocket | null>(null);
  const output = useRef<HTMLPreElement | null>(null);
  const name = instance?.name;

  useEffect(() => {
    if (!name) return;
    let closed = false;
    setLines([]);
    setError(null);
    setStatus('connecting');

    const send = (event: string, ...args: unknown[]) => socket.current?.send(JSON.stringify({ event, args }));
    const authenticate = () =>
      getInstanceConsole(name)
        .then(({ token }) => send('auth', token))
        .catch((err) => setError(httpErrorToHuman(err)));

    getInstanceConsole(name)
      .then(({ token, url }) => {
        if (closed) return;
        const ws = new WebSocket(url);
        socket.current = ws;
        ws.onopen = () => send('auth', token);
        ws.onclose = () => !closed && setStatus('closed');
        ws.onerror = () => !closed && setError('The connection to the node failed.');
        ws.onmessage = (message) => {
          let event: { event?: string; args?: unknown[] };
          try {
            event = JSON.parse(String(message.data));
          } catch {
            return;
          }
          const args = (event.args ?? []).map(String);
          switch (event.event) {
            case 'auth success':
              setStatus('connected');
              send('send logs');
              break;
            case 'token expiring':
              authenticate();
              break;
            case 'jwt error':
            case 'token expired':
              setError(`The node refused the console token: ${args.join(' ') || event.event}`);
              break;
            case 'console output':
            case 'daemon message': {
              const added = args.join('\n').replace(ANSI, '').split('\n');
              setLines((current) => [...current, ...added].slice(-MAX_LINES));
              break;
            }
          }
        };
      })
      .catch((err) => !closed && setError(httpErrorToHuman(err)));

    return () => {
      closed = true;
      socket.current?.close();
      socket.current = null;
    };
  }, [name]);

  useEffect(() => {
    output.current?.scrollTo({ top: output.current.scrollHeight });
  }, [lines]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = command.trim();
    if (!text || status !== 'connected') return;
    socket.current?.send(JSON.stringify({ event: 'send command', args: [text] }));
    setCommand('');
  };

  return (
    <Modal opened={instance !== null} onClose={onClose} title={`Console: ${name ?? ''}`} size='80rem'>
      <Stack gap='sm'>
        {error && (
          <Alert color='red' title='Console unavailable'>
            {error}
          </Alert>
        )}
        <Text size='xs' c='dimmed'>
          {status === 'connecting' && 'Connecting to the node…'}
          {status === 'connected' && `Connected to ${instance?.node ?? 'the node'}. Commands go to the server's console.`}
          {status === 'closed' && 'Disconnected. Close and reopen to reconnect.'}
        </Text>
        <pre
          ref={output}
          className='m-0 h-[28rem] overflow-auto whitespace-pre-wrap break-all rounded-md bg-black/80 p-3 font-mono text-xs text-gray-100'
        >
          {lines.join('\n')}
        </pre>
        <form onSubmit={submit}>
          <Group gap='sm' wrap='nowrap'>
            <TextInput
              className='flex-1'
              aria-label='Command'
              placeholder='Type a command'
              value={command}
              onChange={(e) => setCommand(e.currentTarget.value)}
              disabled={status !== 'connected'}
            />
            <Button
              type='submit'
              disabled={status !== 'connected' || !command.trim()}
              leftSection={<FontAwesomeIcon icon={faPaperPlane} />}
            >
              Send
            </Button>
          </Group>
        </form>
      </Stack>
    </Modal>
  );
}
