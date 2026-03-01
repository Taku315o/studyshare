import cors from 'cors';
import express from 'express';
import assignmentRoutes from './routes/assignments';
import { createUploadRoutes } from './routes/uploads';

type CreateAppOptions = {
  enableLegacyAssignmentsApi?: boolean;
  enableLegacyUploadApi?: boolean;
};

//ファクトリ関数を作成して、オプションを受け取れるようにする。これにより、テスト時にレガシーAPIを無効化できる。
export const createApp = (options: CreateAppOptions = {}) => {
  const app = express();
  const enableLegacyAssignmentsApi =
    options.enableLegacyAssignmentsApi ??
    process.env.ENABLE_LEGACY_ASSIGNMENTS_API === 'true';

  app.use(cors());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.send('Hello from Express + TypeScript!');
  });

  app.use('/api', createUploadRoutes({ enableLegacyUploadApi: options.enableLegacyUploadApi }));

  if (enableLegacyAssignmentsApi) {
    app.use('/api', assignmentRoutes);
  }

  return app;
};

const app = createApp();

export default app;
