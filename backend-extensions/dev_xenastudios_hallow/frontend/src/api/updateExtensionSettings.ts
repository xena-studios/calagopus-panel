import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export const updateExtensionSettingsSchema = z.object({
  controlPlaneUrl: z.string().optional(),
  // Left out (undefined) keeps the stored token.
  controlPlaneToken: z.string().optional(),
});

export default async (data: z.infer<typeof updateExtensionSettingsSchema>): Promise<void> => {
  await axiosInstance.put(
    '/api/admin/extensions/dev.xenastudios.hallow/settings',
    serializeForApi(updateExtensionSettingsSchema, data),
  );
};
