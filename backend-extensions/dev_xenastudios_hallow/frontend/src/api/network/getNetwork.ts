import { axiosInstance } from '@/api/axios.ts';
import { type NetworkOverview, networkOverviewSchema } from '../../lib/network.ts';

export default async (): Promise<NetworkOverview> => {
  const { data } = await axiosInstance.get('/api/admin/hallow/network');
  return networkOverviewSchema.parse(data);
};
