import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

let hasLoadedEnv = false;

const resolveEnvFiles = (nodeEnv: string): string[] => {
  if (nodeEnv === 'development') {
    return ['.env.development.local', '.env.development', '.env.local', '.env'];
  }

  if (nodeEnv === 'test') {
    return ['.env.test.local', '.env.test', '.env'];
  }

  return [];
};

export const loadBackendEnv = (): void => {
  if (hasLoadedEnv) {
    return;
  }

  hasLoadedEnv = true;

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  for (const fileName of resolveEnvFiles(nodeEnv)) {
    const filePath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    dotenv.config({ path: filePath, override: false });
  }
};
