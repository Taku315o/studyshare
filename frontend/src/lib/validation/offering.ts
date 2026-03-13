import { z, type ZodError } from 'zod';

const PERIOD_MIN = 1;
const PERIOD_MAX = 30;
const TEXT_MAX = 120;
const COURSE_CODE_MAX = 40;

const normalizedOptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `${max}文字以内で入力してください。` })
    .optional()
    .default('');

const createNumericRangeSchema = (min: number, max: number, message: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === 'number' ? value : Number(value)))
    .refine((value) => Number.isInteger(value) && value >= min && value <= max, { message });

export const createOfferingSchema = z
  .object({
    termId: z.string().trim().min(1, { message: '学期を選択してください。' }),
    courseTitle: z.string().trim().min(1, { message: '講義名を入力してください。' }).max(TEXT_MAX, {
      message: `講義名は${TEXT_MAX}文字以内で入力してください。`,
    }),
    courseCode: normalizedOptionalText(COURSE_CODE_MAX),
    dayOfWeek: createNumericRangeSchema(1, 7, '曜日を選択してください。'),
    period: createNumericRangeSchema(PERIOD_MIN, PERIOD_MAX, '時限を選択してください。'),
    instructorName: normalizedOptionalText(TEXT_MAX),
    instructorUnknown: z.boolean().default(false),
    room: normalizedOptionalText(TEXT_MAX),
    roomUnknown: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.instructorUnknown && value.instructorName.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['instructorName'],
        message: '教員名を入力するか「不明」にしてください。',
      });
    }

    if (!value.roomUnknown && value.room.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['room'],
        message: '教室を入力するか「不明」にしてください。',
      });
    }
  });

export const getOfferingValidationErrorMessage = (
  error: ZodError<unknown>,
  fallback = '入力内容を確認してください。',
) => error.issues[0]?.message ?? fallback;
