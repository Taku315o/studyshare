import cors from 'cors';
import express from 'express';
import assignmentRoutes from './routes/assignments';
import uploadRoutes from './routes/uploads';

const app = express();
const enableLegacyAssignmentsApi = process.env.ENABLE_LEGACY_ASSIGNMENTS_API === 'true';

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.send('Hello from Express + TypeScript!');
});

app.use('/api', uploadRoutes);

if (enableLegacyAssignmentsApi) {
  app.use('/api', assignmentRoutes);
}

export default app;
