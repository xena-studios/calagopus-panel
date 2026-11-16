import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { type PunishmentKind, type PunishmentTemplate, punishmentTemplateSchema } from '../../lib/moderation.ts';

export interface TemplateInput {
  name: string;
  kind: PunishmentKind;
  duration_seconds: number | null;
  reason: string;
}

const BASE = '/api/admin/hallow/punishments/templates';

export async function getTemplates(): Promise<PunishmentTemplate[]> {
  const { data } = await axiosInstance.get(BASE);
  return z.array(punishmentTemplateSchema).parse(data);
}

export async function createTemplate(template: TemplateInput): Promise<PunishmentTemplate> {
  const { data } = await axiosInstance.post(BASE, template);
  return punishmentTemplateSchema.parse(data);
}

export async function updateTemplate(id: number, template: TemplateInput): Promise<PunishmentTemplate> {
  const { data } = await axiosInstance.put(`${BASE}/${id}`, template);
  return punishmentTemplateSchema.parse(data);
}

export async function deleteTemplate(id: number): Promise<void> {
  await axiosInstance.delete(`${BASE}/${id}`);
}
