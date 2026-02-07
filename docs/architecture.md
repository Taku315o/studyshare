**アーキテクチャ**

**構成**
- frontend: Next.js(App Router)で画面と認証状態を管理
- backend: Express + TypeScriptで投稿/削除/画像アップロードAPIを提供
- Supabase: Auth/DB/Storageを統合的に利用

**データフロー**
- 検索/一覧/詳細
- frontend → Supabase RPC/SELECT（`search_assignments` / `search_assignments_filtered` / `assignments`）
- 投稿/削除/アップロード
- frontend → backend API → Supabase（DB/Storage）

**認証フロー**
- OAuth → `auth/callback` でセッション確立 → `AuthContext` で状態配布
- backend へは Bearer JWT を付与
- backend は Supabase Auth でトークン検証し、`users` から role を取得

**主要APIと責務境界**
- `POST /api/upload` 画像アップロード（認証必須）
- `POST /api/assignments` 課題投稿（認証必須 + バリデーション）
- `GET /api/assignments/search` 検索
- `DELETE /api/assignments/:id` 課題削除（管理者のみ）

**前提/依存**
- Supabase RPC: `search_assignments`, `search_assignments_filtered`
- Storage bucket: `assignments`
