import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export const extensionSettingsSchema = z.object({
  controlPlaneUrl: z.string(),
  controlPlaneTokenSet: z.boolean(),
});

export default async (): Promise<z.infer<typeof extensionSettingsSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/extensions/dev.xenastudios.hallow/settings');
  return parseFromApi(extensionSettingsSchema, data.settings);
};
