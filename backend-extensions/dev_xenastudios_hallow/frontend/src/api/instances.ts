import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import {
  type InstanceList,
  instanceListSchema,
  type KindInfo,
  type KindInput,
  kindInfoSchema,
} from '../lib/instances.ts';

export async function getInstances(): Promise<InstanceList> {
  const { data } = await axiosInstance.get('/api/admin/hallow/instances');
  return instanceListSchema.parse(data);
}

export async function endInstance(name: string): Promise<void> {
  await axiosInstance.delete(`/api/admin/hallow/instances/${encodeURIComponent(name)}`);
}

const KINDS = '/api/admin/hallow/kinds';

export async function getKinds(): Promise<KindInfo[]> {
  const { data } = await axiosInstance.get(KINDS);
  return z.array(kindInfoSchema).parse(data);
}

export async function saveKind(name: string, kind: KindInput): Promise<KindInfo> {
  const { data } = await axiosInstance.put(`${KINDS}/${encodeURIComponent(name)}`, kind);
  return kindInfoSchema.parse(data);
}

export async function deleteKind(name: string): Promise<void> {
  await axiosInstance.delete(`${KINDS}/${encodeURIComponent(name)}`);
}
