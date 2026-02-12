import dotenv from 'dotenv';
import app from './app';

dotenv.config({ path: '.env.development', override: true });

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

console.log('NODE_ENV =', process.env.NODE_ENV);
console.log('SUPABASE_URL =', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY =', process.env.SUPABASE_ANON_KEY ? '存在します' : '設定されていません');
console.log('SUPABASE_SERVICE_ROLE_KEY =', process.env.SUPABASE_SERVICE_ROLE_KEY ? '存在します' : '設定されていません');
