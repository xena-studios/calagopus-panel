import { axiosInstance } from '@/api/axios.ts';
import { type PunishmentSearchResult, punishmentSearchSchema } from '../../lib/moderation.ts';

export interface PunishmentFilters {
  player: string;
  kind: string | null;
  active: boolean | null;
  page: number;
  perPage: number;
}

export default async (filters: PunishmentFilters): Promise<PunishmentSearchResult> => {
  const { data } = await axiosInstance.get('/api/admin/hallow/punishments/search', {
    params: {
      player: filters.player || undefined,
      kind: filters.kind ?? undefined,
      active: filters.active ?? undefined,
      page: filters.page,
      per_page: filters.perPage,
    },
  });
  return punishmentSearchSchema.parse(data);
};
