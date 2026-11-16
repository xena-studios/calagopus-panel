import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Stack, Text } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import revokePunishment from '../api/moderation/revokePunishment.ts';
import { hallowQueryKeys } from '../lib/queryKeys.ts';

// Lift a player's active ban or mute, with an optional reason for the record.
export default function RevokePunishmentModal({
  opened,
  onClose,
  kind,
  target,
}: {
  opened: boolean;
  onClose: () => void;
  kind: 'ban' | 'mute';
  target: string;
}) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setReason('');
      setError(null);
    }
  }, [opened]);

  const action = kind === 'ban' ? 'Unban' : 'Unmute';

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={`${action} ${target}`}
      loading={submitting}
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        revokePunishment(kind, target, reason.trim() || null)
          .then((reply) => {
            addToast(reply.message, 'success');
            queryClient.invalidateQueries({ queryKey: hallowQueryKeys.punishmentsAll() });
            onClose();
          })
          .catch((err) => setError(httpErrorToHuman(err)))
          .finally(() => setSubmitting(false));
      }}
    >
      <Stack gap='md'>
        <Text size='sm'>
          {kind === 'ban'
            ? `${target} can join again straight away. The ban stays on their record as lifted.`
            : `${target} can chat again straight away and is told so. The mute stays on their record as lifted.`}
        </Text>
        <TextArea
          label='Reason'
          description='Optional; kept with the record, such as "appeal accepted".'
          autosize
          minRows={2}
          maxLength={256}
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
          data-autofocus
        />
        {error && (
          <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />} title='Not lifted'>
            {error}
          </Alert>
        )}
      </Stack>
      <ModalFooter>
        <Button variant='default' onClick={onClose}>
          Cancel
        </Button>
        <Button type='submit' color='teal' loading={submitting}>
          {action}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
