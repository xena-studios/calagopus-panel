import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { type FleetSettingsChange, fleetSettingsChangeSchema } from '../../lib/fleet.ts';

export default async (limit = 50): Promise<FleetSettingsChange[]> => {
  const { data } = await axiosInstance.get('/api/admin/hallow/fleet/settings/history', { params: { limit } });
  return z.array(fleetSettingsChangeSchema).parse(data);
};
