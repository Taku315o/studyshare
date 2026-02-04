import { z } from 'zod';

/**
 * Zod schema that validates the payload for creating a new assignment via the API.
 *
 * @returns Parsed request data containing a title, description, and optional image URL.
 */
export const createAssignmentSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'タイトルは必須です'),
    description: z.string().min(1, '説明は必須です'),
    image_url: z.string().url('正しいURLではありません').optional(),
    university: z.string().optional(),
    faculty: z.string().optional(),
    department: z.string().optional(),
    course_name: z.string().optional(),
    teacher_name: z.string().optional(),
  }),
});
