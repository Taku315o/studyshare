import app from './app';
import { loadBackendEnv } from './lib/env';

loadBackendEnv();

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
