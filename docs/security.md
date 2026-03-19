**セキュリティ**

**移行メモ（2026-03-18）**
- backend 認証ミドルウェアは新スキーマ互換のため、`public.users` が存在しない環境でも `auth.getUser(token)` の結果だけで認証を継続する。
- `users` テーブル参照は legacy 互換の補助情報取得として扱う（存在時のみ利用）。
- legacy assignments API と汎用 `/api/upload` は退避済みで、デフォルト無効（必要時のみ `ENABLE_LEGACY_ASSIGNMENTS_API=true` / `ENABLE_LEGACY_UPLOAD_API=true` で有効化）。

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
- `note_comments` の投稿は `author_id = auth.uid()` に加えて、対象ノートを `can_view_note()` で閲覧可能な場合に限定
- `question_answers` は対象質問を `can_view_question()` で閲覧可能な認証ユーザーのみ `select/insert` を許可
- `timetable_presets` は `select` のみ認証ユーザーに開放し、`insert/update/delete` は `is_admin(auth.uid())` に限定
- `profile_timetable_settings` は `auth.uid() = user_id` のみ `select/insert/update/delete` を許可
- `profiles.university_id` 未設定ユーザーは、他ユーザーの授業系投稿（ノート/口コミ/質問）を閲覧できないため、UIで初期設定を必須化して整合を取る
- `follow_user` / `unfollow_user` は `security definer` RPC でのみ操作し、direct table mutate を許可しない
- フォローは自己 follow 不可、block 関係では作成不可、block insert 時は既存 follow を双方向削除する
- `notifications` は recipient 本人のみ `select/update` を許可し、client からの direct insert は持たない
- フォロー一覧取得は `authenticated` のみ `list_follow_profiles` RPC を実行可能

**ストレージ**
- `notes` bucket（現行ノート画像添付）
- `avatars` bucket（プロフィールアバター画像）
- `assignments` bucket（legacy 互換）
- `notes` bucket は private。`notes.image_url` には `storage://notes/...` を保存し、閲覧時に認可済みユーザー向け signed URL を発行する
- `avatars` / `assignments` は現状 public 運用
- アップロード: 認証済みかつ owner = auth.uid()
- 削除: owner または admin
- backend の `/api/notes/upload` は Storage bucket が未作成だと `Bucket not found` で失敗するため、bucket 作成 migration の適用を前提とする
- backend の `/api/profiles/avatar/upload` も同様に bucket 未作成時は失敗するため、`avatars` bucket migration の適用を前提とする
- backend の legacy `/api/upload` は `ENABLE_LEGACY_UPLOAD_API=true` で有効化した場合のみ利用可能
- upload系ルートは `multer` の route middleware で `fileSize=5MB` / `files=1` を先に適用し、メモリバッファ肥大化のリスクを抑制する

**API運用**
- backend 本番起動時は `.env.development` を読まない。production はデプロイ環境変数を唯一の truth とする
- upload API を含む backend CORS は `CORS_ALLOWED_ORIGINS` で許可 origin を明示し、本番で未設定なら起動時に失敗させる
- Render / uptime monitor 向けに `/healthz` と `/api/health` は 2xx を返す軽量エンドポイントとして用意する
- Storage bucket の provisioning は SQL migration に置かず、local は `supabase/config.toml`、remote は `backend/src/scripts/ensureStorageBuckets.ts` で管理する
- `/api` 配下には最低限の security headers と IP ベースの rate limit を適用する
- rate limit の client key は `req.ip` を使い、`x-forwarded-for` を直接読まない
- `req.ip` を正しく解決するため、`TRUST_PROXY` を運用環境に合わせて設定する。本番で未設定だと起動に失敗する
- `TRUST_PROXY=false` は direct access / proxy なし、`TRUST_PROXY=1` は 1 段の trusted proxy / load balancer / CDN の後ろを想定する
- rate limit の in-memory store はリクエスト時に期限切れエントリを掃除するが、プロセス間共有はしないため、厳密な制御が必要なら Redis などへ移行する
- 認証/セッションの詳細ログ（token 長、user id、auth event、Supabase URL など）は本番ログへ出さない
