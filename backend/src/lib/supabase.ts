import { createClient } from '@supabase/supabase-js';
import { loadBackendEnv } from './env';

loadBackendEnv();

const url = process.env.SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAuth = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false }
});


export const supabaseAdmin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false }
});


export const supabaseFromToken = (token: string) =>
  createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });


  //サービスキーで管理者用APIを叩く
  // 例: supabaseAdmin.from('table').select('*')
  //ユーザーのJWTでユーザー権限APIを叩く







  //このファイルはauth.tsやservice.tsなど、バックエンド側でSupabaseクライアントを使う場合にインポートして用いられていて、現状はsupabaseAdmin中心に使われている。ここは修正する必要があるかも、、(ところどころsupabaseFromTokenに変えた方が良いかもしれない。)
  //supabaseFromTokenはバックエンドで使うもので、それを使うことで、フロントから受け取ったユーザーのトークンを使って、バックエンドからそのユーザになりすましてsupabaseにアクセスする。こうすることで、supabaseのRLSが有効になる。万が一、バックエンドのAPIにバグがあっても、supabaseのRLSが効いているので、ユーザーは自分の権限以上の操作はできない。
  //ただし、supabaseFromTokenはトークンを受け取るたびに新しいクライアントを作成するので、頻繁に使うとパフォーマンスに影響が出る可能性がある。なので、頻繁に使う場合は、トークンごとにキャッシュする仕組みを作るのもありかも。
  //supabaseAuthは認証専用で、ユーザーのトークンを検証したり、ユーザー情報を取得するために使う。例えば、JWTの署名検証や有効期限チェックなどはsupabaseAuthが内部でやってくれる。
