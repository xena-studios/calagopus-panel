import { axiosInstance } from '@/api/axios.ts';
import { type PunishmentKind, type PunishmentReply, punishmentReplySchema } from '../../lib/moderation.ts';

export interface IssuePunishment {
  kind: PunishmentKind;
  target: string;
  reason: string;
  durationSeconds: number | null;
  template?: string | null;
}

// Issued as the logged-in staff member; a refusal (already banned, not online for a kick) is a 400.
export default async (punishment: IssuePunishment): Promise<PunishmentReply> => {
  const { data } = await axiosInstance.post('/api/admin/hallow/punishments', {
    kind: punishment.kind,
    target: punishment.target,
    reason: punishment.reason,
    duration_seconds: punishment.durationSeconds,
    template: punishment.template ?? null,
  });
  return punishmentReplySchema.parse(data);
};
