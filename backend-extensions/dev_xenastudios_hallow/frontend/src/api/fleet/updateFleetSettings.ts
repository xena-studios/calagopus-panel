import { axiosInstance } from '@/api/axios.ts';
import { type FleetSettings, type FleetSettingsResponse, fleetSettingsResponseSchema } from '../../lib/fleet.ts';

// The panel sets `updated_by` to the logged-in admin; the body only carries the settings.
export default async (settings: FleetSettings): Promise<FleetSettingsResponse> => {
  const { data } = await axiosInstance.put('/api/admin/hallow/fleet/settings', { settings });
  return fleetSettingsResponseSchema.parse(data);
};
