import { z } from 'zod';

export const createAssignmentSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'タイトルは必須です'),
    description: z.string().min(1, '説明は必須です'),
    image_url: z.string().url('正しいURLではありません').optional(),
  }),
});
