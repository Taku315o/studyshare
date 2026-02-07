
**プロジェクト概要**  
- Next.js(App Router)のフロントエンドと、Express + TypeScript のバックエンドで構成された課題共有アプリ。  
- 認証は Supabase Auth を利用し、フロント側は Supabase クライアントでセッション管理・ユーザー情報取得を行う。  
- 課題の検索・一覧・詳細はフロントから Supabase 直接参照、投稿・画像アップロード・削除はバックエンドAPI経由。  
根拠: `studyshare/frontend/src/context/AuthContext.tsx`, `studyshare/frontend/src/components/AssignmentList.tsx`, `studyshare/frontend/src/app/assignments/[id]/AssignmentDetailClient.tsx`, `studyshare/frontend/src/lib/api.ts`, `studyshare/backend/src/routes/assignments.ts`

**ディレクトリ構造**  
```text
studyshare/
backend/
  src/
    controllers/        # APIの入口（リクエスト/レスポンス）
    services/           # ビジネスロジック・Supabase操作
    middleware/         # 認証/バリデーション
    validators/         # Zodスキーマ
    routes/             # ルーティング
    lib/                # Supabaseクライアント
    scripts/            # シードスクリプト
frontend/
  src/
    app/                # Next.js App Router（ページ/ルート）
    components/         # UIコンポーネント
    context/            # 認証コンテキスト
    lib/                # API/Supabaseクライアント
    types/              # Supabase型定義
supabase/
  migrations/           # DBスキーマ/関数/RLS/Storageポリシー
  config.toml
```
根拠: `studyshare/backend/src`, `studyshare/frontend/src`, `studyshare/supabase/migrations`

**開発コマンド**  
フロントエンド (`studyshare/frontend/package.json`)  
- `npm run dev`  
- `npm run build`  
- `npm run start`  
- `npm run lint`  
- `npm run test`  
- `npm run test:watch`

バックエンド (`studyshare/backend/package.json`)  
- `npm run dev`  
- `npm run build`  
- `npm run start`  
- `npm run seed`  
- `npm run test`（現在は placeholder）

**設計方針**  
アーキテクチャ: @docs/architecture.md  
コンポーネント規約: @docs/components.md  
テスト戦略: @docs/testing.md  
データモデル: @docs/data-model.md  
セキュリティ: @docs/security.md