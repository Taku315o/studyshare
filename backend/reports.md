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
