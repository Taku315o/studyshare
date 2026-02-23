import cors from 'cors';
import express from 'express';
import assignmentRoutes from './routes/assignments';
import uploadRoutes from './routes/uploads';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.send('Hello from Express + TypeScript!');
});

app.use('/api', uploadRoutes);
app.use('/api', assignmentRoutes);

export default app;
