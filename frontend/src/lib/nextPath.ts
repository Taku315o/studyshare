const SAFE_NEXT_PATH_PATTERN = /^[a-zA-Z0-9\-._~\/?#[\]@!$&'()*+,;=%]*$/;

export const isSafeNextPath = (path: string | null | undefined): path is string => {
  if (typeof path !== 'string' || !path) return false;
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  if (path.includes('\0')) return false;
  if (!SAFE_NEXT_PATH_PATTERN.test(path)) return false;
  return true;
};

export const resolveSafeNextPath = (
  path: string | null | undefined,
  options?: {
    fallback?: string;
    blockedPrefixes?: string[];
  },
): string => {
  const fallback = options?.fallback ?? '/home';
  const blockedPrefixes = options?.blockedPrefixes ?? ['/onboarding'];

  if (!isSafeNextPath(path)) return fallback;

  const isBlocked = blockedPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}?`),
  );

  return isBlocked ? fallback : path;
};