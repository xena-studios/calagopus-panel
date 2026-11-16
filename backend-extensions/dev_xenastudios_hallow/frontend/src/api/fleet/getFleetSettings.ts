import { axiosInstance } from '@/api/axios.ts';
import { type FleetSettingsResponse, fleetSettingsResponseSchema } from '../../lib/fleet.ts';

export default async (): Promise<FleetSettingsResponse> => {
  const { data } = await axiosInstance.get('/api/admin/hallow/fleet/settings');
  return fleetSettingsResponseSchema.parse(data);
};
