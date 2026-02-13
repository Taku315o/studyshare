**コンポーネント規約**

**責務分離**
- `src/app`: ルーティングとページ構成
- `src/components`: UIコンポーネントと画面の組み立て
- `src/context`: 認証状態の管理と配布
- `src/lib`: APIクライアントとSupabaseクライアント

**実装ルール**
- 1コンポーネント1責務
- 画面の状態管理はページ or 専用コンポーネントで完結
- API呼び出しは `src/lib/api.ts` に集約
- Supabase直接参照は読み取りに限定（例外: `src/app/profile/page.tsx` の本人投稿削除。RLS前提）
- 認証状態は `AuthContext` 経由で参照

**命名・配置**
- 機能単位の命名を優先（例: `AssignmentList`, `AssignmentForm`, `SearchForm`, `Header`）
- 共通UIは `src/components` に配置
- 画面固有の構成は `src/app` に配置

**例**
- `AssignmentList`: 一覧表示と検索結果表示
- `AssignmentForm`: 投稿フォーム
- `Header`: 認証状態に応じたヘッダーUI
