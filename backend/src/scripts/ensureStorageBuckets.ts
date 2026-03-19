import { loadBackendEnv } from '../lib/env';

type BucketConfig = {
  id: string;
  public: boolean;
  fileSizeLimit: number;
  allowedMimeTypes: string[];
};

const BUCKETS: BucketConfig[] = [
  {
    id: 'notes',
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'avatars',
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'assignments',
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
];

const resolveSupabaseUrl = (): string => {
  const value = process.env.SUPABASE_URL?.trim();
  if (!value) {
    throw new Error('SUPABASE_URL is required');
  }

  return value;
};

const resolveServiceRoleKey = (): string => {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!value) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  return value;
};

const ensureBucket = async (baseUrl: string, authHeaders: HeadersInit, bucket: BucketConfig): Promise<void> => {
  const response = await fetch(`${baseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: bucket.id }),
  });

  if (response.ok) {
    console.log(`Created storage bucket: ${bucket.id}`);
    return;
  }

  const message = await response.text();
  const isDuplicate =
    response.status === 409 ||
    /"statusCode"\s*:\s*"?(409)"?/i.test(message) ||
    /duplicate/i.test(message);

  if (isDuplicate) {
    console.log(`Storage bucket already exists: ${bucket.id}`);
    return;
  }

  throw new Error(`Failed to create bucket "${bucket.id}": ${response.status} ${message}`);
};

const main = async (): Promise<void> => {
  loadBackendEnv();

  const supabaseUrl = resolveSupabaseUrl();
  const serviceRoleKey = resolveServiceRoleKey();
  const authHeaders = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
  };

  for (const bucket of BUCKETS) {
    await ensureBucket(supabaseUrl, authHeaders, bucket);
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to ensure storage buckets:', error);
    process.exitCode = 1;
  });
}
