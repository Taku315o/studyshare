// backend/src/index.ts

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// 新しく作るassignmentsルーターをインポート
import assignmentRoutes from './routes/assignments'; 

dotenv.config();//.envファイルから環境変数をロード.それ以外の.env.developmentは読まれてない。

const app = express();
const PORT = process.env.PORT || 3001;


app.use(cors()); 
app.use(express.json());

// ルートを定義
app.get('/', (req, res) => {
  res.send('Hello from Express + TypeScript!');
});

// '/api' パスにルーターを適用
///api パスに assignmentRoutes ルーターをマウントしている。ex) GET /assignments/search → 実際のエンドポイント: /api/assignments/search
app.use('/api', assignmentRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


console.log('NODE_ENV =', process.env.NODE_ENV);
console.log('SUPABASE_URL =', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY =', process.env.SUPABASE_ANON_KEY ? '存在します' : '設定されていません');
console.log('SUPABASE_SERVICE_ROLE_KEY =', process.env.SUPABASE_SERVICE_ROLE_KEY ? '存在します' : '設定されていません');