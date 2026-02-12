process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-role-key';

if (process.env.TEST_LOG_SILENT !== 'false') {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
}
