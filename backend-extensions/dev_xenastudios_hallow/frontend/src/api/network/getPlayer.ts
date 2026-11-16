import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { type PlayerLocation, playerLocationSchema } from '../../lib/network.ts';

// Null when the player isn't online.
export default async (name: string): Promise<PlayerLocation | null> => {
  const { data } = await axiosInstance.get('/api/admin/hallow/players', { params: { name } });
  return z.object({ player: playerLocationSchema.nullable() }).parse(data).player;
};
