const LOCAL_BACKEND_API_URL = 'http://localhost:3001/api';

const normalizeApiUrl = (value: string): string => value.replace(/\/+$/, '');

const resolveConfiguredUrl = (...values: Array<string | undefined>): string | null => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return normalizeApiUrl(trimmed);
    }
  }

  return null;
};

const isProduction = process.env.NODE_ENV === 'production';

export const getBrowserBackendApiUrl = (): string => {
  const configured = resolveConfiguredUrl(process.env.NEXT_PUBLIC_BACKEND_API_URL);
  if (configured) {
    return configured;
  }

  if (!isProduction) {
    return LOCAL_BACKEND_API_URL;
  }

  throw new Error('NEXT_PUBLIC_BACKEND_API_URL is required in production');
};

export const getServerBackendApiUrl = (): string => {
  const configured = resolveConfiguredUrl(
    process.env.BACKEND_API_URL,
    process.env.NEXT_PUBLIC_BACKEND_API_URL,
  );

  if (configured) {
    return configured;
  }

  if (!isProduction) {
    return LOCAL_BACKEND_API_URL;
  }

  throw new Error('BACKEND_API_URL or NEXT_PUBLIC_BACKEND_API_URL is required in production');
};
