import { axiosInstance } from '@/api/axios.ts';
import { type PunishmentReply, punishmentReplySchema } from '../../lib/moderation.ts';

export default async (kind: 'ban' | 'mute', target: string, reason: string | null): Promise<PunishmentReply> => {
  const { data } = await axiosInstance.post('/api/admin/hallow/punishments/revoke', { kind, target, reason });
  return punishmentReplySchema.parse(data);
};
