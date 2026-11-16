import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { punishmentRecordSchema } from '../../lib/network.ts';

const responseSchema = z.object({ known: z.boolean(), punishments: z.array(punishmentRecordSchema) });

export type PunishmentHistory = z.infer<typeof responseSchema>;

export default async (name: string): Promise<PunishmentHistory> => {
  const { data } = await axiosInstance.get('/api/admin/hallow/punishments', { params: { name } });
  return responseSchema.parse(data);
};
