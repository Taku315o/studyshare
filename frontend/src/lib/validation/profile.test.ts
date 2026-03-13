import {
  getValidationErrorMessage,
  profileEditSchema,
  profileSetupSchema,
} from './profile';

describe('profile validation schemas', () => {
  it.each([
    { gradeYear: 0, expected: false },
    { gradeYear: 1, expected: true },
    { gradeYear: 6, expected: true },
    { gradeYear: 7, expected: false },
  ])('validates gradeYear boundary for profile edit: $gradeYear', ({ gradeYear, expected }) => {
    const result = profileEditSchema.safeParse({
      displayName: 'テストユーザー',
      universityId: 'uni-1',
      gradeYear,
    });
    expect(result.success).toBe(expected);
  });

  it('rejects displayName with only spaces', () => {
    const result = profileEditSchema.safeParse({
      displayName: '   ',
      universityId: 'uni-1',
      gradeYear: 2,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected validation failure');
    }
    expect(getValidationErrorMessage(result.error)).toBe('表示名を入力してください。');
  });

  it('rejects empty universityId in profile setup', () => {
    const result = profileSetupSchema.safeParse({
      universityId: '',
      gradeYear: 2,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected validation failure');
    }
    expect(getValidationErrorMessage(result.error)).toBe('大学を選択してください');
  });

  it('accepts empty faculty and normalizes to empty string', () => {
    const result = profileEditSchema.safeParse({
      displayName: 'テストユーザー',
      universityId: 'uni-1',
      gradeYear: 2,
      faculty: '',
      bio: '',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected validation success');
    }
    expect(result.data.faculty).toBe('');
    expect(result.data.bio).toBe('');
  });

  it('rejects too long faculty name', () => {
    const result = profileEditSchema.safeParse({
      displayName: 'テストユーザー',
      universityId: 'uni-1',
      gradeYear: 2,
      faculty: 'a'.repeat(81),
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected validation failure');
    }
    expect(getValidationErrorMessage(result.error)).toBe('学部は80文字以内で入力してください。');
  });

  it('rejects too long bio', () => {
    const result = profileEditSchema.safeParse({
      displayName: 'テストユーザー',
      universityId: 'uni-1',
      gradeYear: 2,
      bio: 'a'.repeat(301),
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected validation failure');
    }
    expect(getValidationErrorMessage(result.error)).toBe('自己紹介は300文字以内で入力してください。');
  });
});
