**セキュリティ**

**移行メモ（2026-02-25）**
- backend 認証ミドルウェアは新スキーマ互換のため、`public.users` が存在しない環境でも `auth.getUser(token)` の結果だけで認証を継続する。
- `users` テーブル参照は legacy 互換の補助情報取得として扱う（存在時のみ利用）。

**認証**
- Supabase Auth（OAuth）でログイン
- frontendはセッションを保持し、JWTをbackendに付与
- backendはSupabase AuthでJWTを検証
- 認証後のアプリ導線では `profiles.university_id` / `grade_year` の初期設定を必須化（未設定時は `/onboarding` へ誘導）
- `next` クエリでの遷移は安全な内部パスのみ許可し、`/onboarding` への戻りループも拒否（`src/lib/nextPath.ts`）

**権限制御**
- `role` は現行フロントでは `auth.users.app_metadata.role` を主に参照
- backend は JWT 検証後に `app_metadata.role` をフォールバック値として使用し、legacy 環境では `users.role` を追加参照
- `is_admin(uid)` で管理者判定
- role変更はトリガーで禁止（管理者のみ許可）
- RLSで `users` / `assignments` の操作範囲を制限
- `notes` / `reviews` / `questions` は「本人 or 同大学（`profiles.university_id` ベース）」の可視性制御を採用
- `profiles.university_id` 未設定ユーザーは、他ユーザーの授業系投稿（ノート/口コミ/質問）を閲覧できないため、UIで初期設定を必須化して整合を取る

**ストレージ**
- `notes` bucket（現行ノート画像添付）
- `avatars` bucket（プロフィールアバター画像）
- `assignments` bucket（legacy 互換）
- 読み取り: 全員
- アップロード: 認証済みかつ owner = auth.uid()
- 削除: owner または admin
- backend の `/api/notes/upload` は Storage bucket が未作成だと `Bucket not found` で失敗するため、bucket 作成 migration の適用を前提とする
- backend の `/api/profiles/avatar/upload` も同様に bucket 未作成時は失敗するため、`avatars` bucket migration の適用を前提とする
