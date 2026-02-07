**テスト戦略**

**現状**
- frontend: Jest + React Testing Libraryの基盤あり
- backend: テスト未整備（`npm run test` はplaceholder）

**優先テスト**
- UI
- `AssignmentForm` 投稿フロー
- `AssignmentList` 検索/一覧表示
- `AuthContext` 認証状態の更新
- API
- `POST /api/assignments` バリデーション/認証
- `DELETE /api/assignments/:id` 管理者権限
- `POST /api/upload` 画像バリデーション

**方針**
- UIは振る舞い中心（ユーザー操作/表示）
- APIは入力検証・認可・エラー応答を重点
- SupabaseのRLS前提は、結合テストで境界を確認

**将来**
- E2Eは必要になってから追加
