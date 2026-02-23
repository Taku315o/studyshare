## Legacy Assignments Module

このディレクトリは、旧「課題/ノート共有（assignments）」機能を退避したものです。

- 現行の `/(app)` フローでは使用しません
- Next.js のルーティング対象から外すため、旧 `app/assignments` はこの配下へ移動しています
- 再利用する場合は、UI/ロジックを新しい `notes` / `posts` / `offerings` モデルに合わせて移植してください

含まれるもの:

- `components/`: 旧 UI コンポーネント (`AssignmentList`, `AssignmentForm`, `SearchForm`, `Header`, `Hero`)
- `app/assignments/`: 旧ルート実装（参照用）
- `tests/`: 旧コンポーネントのテスト（参照用）
