## 2026-02-11 変更レポート

### 概要
seed 実行時のエラー解消と、admin ロールの正しい付与、Storage へのアップロード失敗の回避を目的に修正。

### 変更内容
- seed 作成時の `createUser` で `user_metadata` と `app_metadata` の両方に `role` を設定。
- `public.handle_new_user()` で `raw_user_meta_data` と `raw_app_meta_data` の両方から `role` を取得するようにするマイグレーションを追加。
- seed の `users` への `upsert` から `role` を外し、`role` 更新トリガーによる例外を回避。
- Storage のキーが無効になる日本語タイトルを避けるため、`slugify()` を ASCII のみの安全な形式に変更し、空文字の場合はハッシュで代替。

### 影響ファイル
- [backend/src/scripts/seed.ts](backend/src/scripts/seed.ts)
- [supabase/migrations/20260211090000_handle_new_user_role_from_app_metadata.sql](supabase/migrations/20260211090000_handle_new_user_role_from_app_metadata.sql)

### 期待される結果
- seed 実行時に `role change is not allowed` が発生しない。
- admin ユーザーが `student` ではなく `admin` ロールで作成される。
- Storage への画像アップロードが 400 で失敗しない。

## 2026-02-13 変更レポート

### 概要
バックエンドのテストは成功する一方、VS Code 上で `jest` / `describe` / `it` / `expect` が見つからない型エラーが表示される問題を解消。

### 原因
- `backend/tsconfig.json` で `src/**/*.test.ts` を `exclude` していたため、エディタの TypeScript 診断対象からテストファイルが外れていた。
- その結果、`@types/jest` がインストール済みでも、テストファイルで Jest グローバル型が解決されなかった。

### 変更内容
- `backend/tsconfig.json`
	- `compilerOptions.types` に `"node"` と `"jest"` を追加。
	- `exclude` から `src/**/*.test.ts` を外し、エディタ診断でテストファイルも型解決できる状態に変更。
- `backend/tsconfig.build.json` を新規作成。
	- 本番ビルド専用設定として `src/**/*.test.ts` と `jest.setup.ts` を除外。
- `backend/package.json`
	- `build` スクリプトを `tsc` から `tsc -p tsconfig.build.json` に変更。

### 影響ファイル
- [backend/tsconfig.json](backend/tsconfig.json)
- [backend/tsconfig.build.json](backend/tsconfig.build.json)
- [backend/package.json](backend/package.json)

### 検証結果
- 対象ファイル `src/services/assignmentService.test.ts` の「名前 'jest' が見つかりません」系エラーが解消。
- `pnpm --filter backend build` 成功。
- `pnpm --filter backend test` 成功（5 suites / 35 tests passed）。

## 2026-02-25 変更レポート

### 概要
アプリ方針変更（大学生活プラットフォーム化）に伴い、旧 `assignments` ベースのフロント導線を legacy 化。あわせて、現行ノート投稿の画像添付アップロード失敗を調査し、backend 認証ミドルウェアの新スキーマ互換対応・アップロードルート分離・Storage bucket 設定改善を実施。

### 背景 / 調査結果
- 旧 `AssignmentList` / `SearchForm` / `Hero` / `Header` は、現行本体 `/(app)` ではなく主に旧ランディング `/` と `assignments` ルートで利用されていた。
- `TopBar` に `/assignments/new` 導線が残っており、legacy ルートへ到達可能だった。
- 現行ノート投稿画面（`OfferingTabs`）は本文を Supabase へ直接 insert する一方、画像だけ backend `POST /api/notes/upload` を経由していたため、画像添付時のみ backend 側不具合の影響を受けていた。
- backend の `authenticate` ミドルウェアが legacy `public.users` テーブルを参照しており、新スキーマ（`public.profiles` 中心）環境で失敗しうる構造だった。
- 実ログ確認により、認証は通過後に `Bucket not found`（`assignments` bucket 不在）が画像アップロード失敗の直接原因であることを特定。

### 変更内容（Frontend / Legacy整理）
- `frontend/src/components/layout/TopBar.tsx`
	- `/assignments/new` への投稿リンクを無効化（`投稿準備中` ボタン化）。
- `frontend/src/app/page.tsx`
	- 旧 `assignments` ランディング（`Header` / `Hero` / `SearchForm` / `AssignmentList`）を撤去。
	- 新方針に合わせたゲスト向けランディングへ置換（ログイン済みの `/home` リダイレクトは維持）。
- 旧 `assignments` 関連 UI / 旧ルート / 関連テストを `frontend/src/legacy/assignments/` 配下へ退避。
	- `components/`
	- `app/assignments/`
	- `tests/`
- `frontend/src/legacy/assignments/README.md` を追加し、legacy 扱い・参照用であることを明示。

### 変更内容（Backend / 画像アップロード修正）
- `backend/src/middleware/auth.ts`
	- 認証後の `req.user` はまず `auth.getUser(token)` の結果（`auth.users` 情報）で構築するよう変更。
	- legacy `users` テーブル参照は「存在する環境では上書き、存在しない場合は warning を出して継続」に変更。
	- これにより、新スキーマ環境でも `/api/upload` / `/api/notes/upload` が認証ミドルウェアで落ちないように修正。
- `backend/src/routes/uploads.ts`（新規）
	- `/api/upload` と `/api/notes/upload` を `assignments` ルーターから分離。
- `backend/src/routes/assignments.ts`
	- assignment CRUD のみを保持するよう整理（upload 系エンドポイントを削除）。
- `backend/src/app.ts`
	- `uploadRoutes` を `/api` に mount。
	- `assignmentRoutes` 依存から `notes/upload` を切り離し、将来の `assignments` legacy 削除に備えた。
- `backend/src/services/uploadService.ts`
	- アップロード先 bucket を環境変数で切り替え可能に変更。
		- `SUPABASE_NOTES_IMAGE_BUCKET`
		- `SUPABASE_ASSIGNMENTS_IMAGE_BUCKET`
		- `SUPABASE_STORAGE_BUCKET`（共通 fallback）
	- `notes` アップロードのデフォルト bucket を `assignments` ではなく `notes` に変更。
	- アップロード失敗時ログに `bucketName` / `objectPath` を出力するよう改善。

### 変更内容（Supabase / Migration追加）
- `supabase/migrations/20260223183000_create_image_storage_buckets.sql` を追加。
	- `notes` bucket（現行ノート画像用）
	- `assignments` bucket（legacy 互換用）
	- `public`, `file_size_limit=5MB`, `allowed_mime_types` を設定
- 注意:
	- マイグレーションファイルのみ追加。`supabase migration up` / `db reset` は実行していない（運用ルール順守）。

### テスト / 検証
- backend テスト追加:
	- legacy `users` テーブル lookup が失敗しても `/api/notes/upload` が成功するケースを追加。
- 実行コマンド:
	- `pnpm --filter backend test -- assignments.routes.test.ts uploadService.test.ts`
- 結果:
	- 2 suites / 20 tests passed
- 実地ログで確認した失敗原因:
	- `Bucket not found`（`assignments` bucket 不在）
	- 認証ミドルウェアは通過済み（`getUser result: { hasUser: true }`）

### 影響ファイル（主なもの）
- Frontend
	- `frontend/src/app/page.tsx`
	- `frontend/src/components/layout/TopBar.tsx`
	- `frontend/src/legacy/assignments/README.md`
	- `frontend/src/legacy/assignments/components/*`
	- `frontend/src/legacy/assignments/app/assignments/*`
	- `frontend/src/legacy/assignments/tests/*`
- Backend
	- `backend/src/app.ts`
	- `backend/src/middleware/auth.ts`
	- `backend/src/routes/assignments.ts`
	- `backend/src/routes/uploads.ts`
	- `backend/src/services/uploadService.ts`
	- `backend/src/routes/assignments.routes.test.ts`
	- `backend/src/services/uploadService.test.ts`
- Supabase
	- `supabase/migrations/20260223183000_create_image_storage_buckets.sql`

### 今後の対応（推奨）
- 追加した migration を適用して `notes` / `assignments` bucket を作成する。
- `notes` 投稿本体も backend API 化する場合は、`notes.routes.ts` / `notes.controller.ts` / `notes.service.ts` を新設して `assignments` legacy と完全分離する。
- `assignments` backend（route/controller/service）は、現行機能からの依存を確認後に段階的に撤去する。
