import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { type PlayerRanks, playerRanksSchema, type RankInfo, rankInfoSchema } from '../../lib/moderation.ts';

export interface RankInput {
  display_prefix: string;
  weight: number;
  permissions: string[];
  is_default: boolean;
}

const BASE = '/api/admin/hallow/ranks';

export async function getRanks(): Promise<RankInfo[]> {
  const { data } = await axiosInstance.get(BASE);
  return z.array(rankInfoSchema).parse(data);
}

export async function saveRank(name: string, rank: RankInput): Promise<RankInfo> {
  const { data } = await axiosInstance.put(`${BASE}/${encodeURIComponent(name)}`, rank);
  return rankInfoSchema.parse(data);
}

export async function deleteRank(name: string): Promise<void> {
  await axiosInstance.delete(`${BASE}/${encodeURIComponent(name)}`);
}

// `null` when nobody by that name has joined.
export async function getPlayerRanks(name: string): Promise<PlayerRanks | null> {
  const { data } = await axiosInstance.get(`${BASE}/players`, { params: { name } });
  return z.object({ player: playerRanksSchema.nullable() }).parse(data).player;
}

export async function grantRank(player: string, rank: string, durationSeconds: number | null): Promise<PlayerRanks> {
  const { data } = await axiosInstance.post(`${BASE}/players`, { player, rank, duration_seconds: durationSeconds });
  return playerRanksSchema.parse(data);
}

export async function revokeRank(player: string, rank: string): Promise<PlayerRanks> {
  const { data } = await axiosInstance.post(`${BASE}/players/revoke`, { player, rank });
  return playerRanksSchema.parse(data);
}
