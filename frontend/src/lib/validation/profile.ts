import { z, type ZodError } from 'zod';

export const GRADE_YEAR_MIN = 1;
export const GRADE_YEAR_MAX = 6;
export const GRADE_YEAR_OPTIONS = [1, 2, 3, 4, 5, 6] as const;
export const FACULTY_MAX_LENGTH = 80;

const createGradeYearSchema = (message: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === 'number' ? value : Number(value)))
    .refine(
      (value) =>
        Number.isInteger(value) && value >= GRADE_YEAR_MIN && value <= GRADE_YEAR_MAX,
      { message },
    );

const facultySchema = z
  .string()
  .trim()
  .max(FACULTY_MAX_LENGTH, {
    message: `学部は${FACULTY_MAX_LENGTH}文字以内で入力してください。`,
  });

export const profileEditSchema = z.object({
  displayName: z.string().trim().min(1, { message: '表示名を入力してください。' }),
  universityId: z.string().trim().min(1, { message: '所属大学を選択してください。' }),
  gradeYear: createGradeYearSchema('学年を選択してください。'),
  faculty: facultySchema.optional().default(''),
});

export const profileSetupSchema = z.object({
  universityId: z.string().trim().min(1, { message: '大学を選択してください' }),
  gradeYear: createGradeYearSchema('学年を選択してください'),
  faculty: facultySchema.optional().default(''),
});

export const getValidationErrorMessage = (
  error: ZodError<unknown>,
  fallback = '入力内容を確認してください。',
): string => error.issues[0]?.message ?? fallback;
