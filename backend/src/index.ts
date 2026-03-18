import app from './app';
import { loadBackendEnv } from './lib/env';

loadBackendEnv();

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
