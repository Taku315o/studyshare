// backend/src/scripts/seed.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.development' }); // .env.developmentファイルを読み込み

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // バックエンドなのでサービスキーを使う
);

/**
 * Seeds Supabase with fixture users and assignments for local development and testing.
 *
 * @returns A promise that resolves when the bootstrap process completes.
 */
async function main() {
  // 1. テスト用ユーザーを作成（一般ユーザー）
  console.log('テスト用ユーザー（一般）を作成中...');
  const { data: authDataStudent, error: authErrorStudent } = await supabase.auth.admin.createUser({
    email: 'student@example.com',
    password: 'password123',
    email_confirm: true
  });

  if (authErrorStudent) {
    console.error('一般ユーザー作成エラー:', authErrorStudent);
    return;
  }

  const studentId = authDataStudent.user.id;
  console.log('一般ユーザー作成成功! ID:', studentId);

  // users テーブルにロールを設定
  const { error: profileErrorStudent } = await supabase.from('users').insert({
    id: studentId,
    email: 'student@example.com',
    role: 'student'
  });

  if (profileErrorStudent) {
    console.error('一般ユーザープロフィール作成エラー:', profileErrorStudent);
  }

  // 2. 管理者ユーザーを作成
  console.log('管理者ユーザーを作成中...');
  const { data: authDataAdmin, error: authErrorAdmin } = await supabase.auth.admin.createUser({
    email: 'admin@example.com',
    password: 'password123',
    email_confirm: true
  });

  if (authErrorAdmin) {
    console.error('管理者ユーザー作成エラー:', authErrorAdmin);
    return;
  }

  const adminId = authDataAdmin.user.id;
  console.log('管理者ユーザー作成成功! ID:', adminId);

  // users テーブルにロールを設定
  const { error: profileErrorAdmin } = await supabase.from('users').insert({
    id: adminId,
    email: 'admin@example.com',
    role: 'admin'
  });

  if (profileErrorAdmin) {
    console.error('管理者プロフィール作成エラー:', profileErrorAdmin);
  }

  // 3. 作成したユーザーIDで課題データを投入（一般ユーザーの課題）
  console.log('課題データを投入中...');
  const assignments = [
    { title: '微積分の課題1', description: '教科書p.30の問1-5', user_id: studentId },
    { title: '線形代数のレポート', description: '行列式に関する考察', user_id: studentId },
    { title: 'プログラミング演習', description: '再帰関数についての課題', user_id: studentId },
  ];

  const { data, error } = await supabase.from('assignments').insert(assignments);

  if (error) {
    console.error('データ投入エラー:', error);
  } else {
    console.log('データ投入成功:', data);
    console.log('シードデータの投入が完了しました！');
  }
}

main();