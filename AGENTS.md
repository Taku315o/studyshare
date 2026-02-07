
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

**設計方針（コードから読み取れる範囲）**  
- **フロントとバックエンドの責務分離**  
  課題の検索・一覧・詳細はフロントが Supabase を直接参照、投稿・削除・画像アップロードはバックエンドAPI。  
  根拠: `studyshare/frontend/src/components/AssignmentList.tsx`, `studyshare/frontend/src/app/assignments/[id]/AssignmentDetailClient.tsx`, `studyshare/frontend/src/lib/api.ts`, `studyshare/backend/src/routes/assignments.ts`

- **Supabase中心の認証/権限制御**  
  フロントは Supabase セッション管理、バックエンドは Bearer トークンを検証して `users` からロール取得。DB側はRLSと関数/トリガーで権限制御。  
  根拠: `studyshare/frontend/src/context/AuthContext.tsx`, `studyshare/backend/src/middleware/auth.ts`, `studyshare/supabase/migrations/20260203160000_init_full_schema.sql`

- **サービス層で業務ロジックを集約**  
  controller → service の構成。DB/Storage操作は service に集め、controller は入力チェックと委譲に集中。  
  根拠: `studyshare/backend/src/controllers/assignmentController.ts`, `studyshare/backend/src/services/assignmentService.ts`, `studyshare/backend/src/controllers/uploadControllers.ts`, `studyshare/backend/src/services/uploadService.ts`

- **バリデーションをミドルウェアで統一**  
  Zodスキーマを `validate` ミドルウェアで適用し、API入力の検証を統一。  
  根拠: `studyshare/backend/src/middleware/validate.ts`, `studyshare/backend/src/validators/assignment.ts`

- **検索はDB関数で最適化**  
  `search_assignments` と `search_assignments_filtered` を Supabase RPC で利用。全文検索 + ILIKE の併用。  
  根拠: `studyshare/supabase/migrations/20260203160000_init_full_schema.sql`, `studyshare/supabase/migrations/20260206140000_add_university_master_tables.sql`, `studyshare/frontend/src/components/AssignmentList.tsx`

- **画像アップロードはStorageへ**  
  画像は `assignments` バケットにアップロード、PNG/JPEG かつ 5MB 制限。  
  根拠: `studyshare/backend/src/services/uploadService.ts`, `studyshare/supabase/migrations/20260203160000_init_full_schema.sql`
