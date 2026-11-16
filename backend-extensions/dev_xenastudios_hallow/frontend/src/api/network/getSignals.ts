import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { signalRecordSchema } from '../../lib/network.ts';

const responseSchema = z.object({ known: z.boolean(), signals: z.array(signalRecordSchema) });

export type SignalHistory = z.infer<typeof responseSchema>;

export default async (name: string): Promise<SignalHistory> => {
  const { data } = await axiosInstance.get('/api/admin/hallow/signals', { params: { name } });
  return responseSchema.parse(data);
};
