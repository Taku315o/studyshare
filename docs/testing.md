**テスト戦略**

**現状**
- frontend: Jest + React Testing Libraryの基盤あり
- backend: Jest + Supertest で API統合テスト + ユニットテストを実装

**優先テスト**
- UI
- `AssignmentForm` 投稿フロー
- `AssignmentList` 検索/一覧表示
- `AuthContext` 認証状態の更新
- `TimetableGrid` ローディング/空状態/表示切替（`dropped`トグル）
- `TimetableCell` セル表示（授業カード/空セル）と遷移動作
- `Sidebar` の `/timetable` 導線有効化
- `Sidebar` の `/community` 導線有効化
- `CommunityPane` の候補0件空状態
- `MessagesPane` のスレッド0件空状態
- `MessageComposer` の Enter送信と送信ボタン送信
- `community/page` の DM制約時ローカルフォールバック
- API
- `POST /api/assignments` バリデーション/認証
- `DELETE /api/assignments/:id` 管理者権限
- `POST /api/upload` 画像バリデーション
- backend unit
- `middleware/auth` 認証・権限判定
- `middleware/validate` 入力検証
- `services/assignmentService` 作成/検索/削除
- `services/uploadService` 画像検証/Storageアップロード

**方針**
- UIは振る舞い中心（ユーザー操作/表示）
- レスポンシブUIは desktop/mobile でDOMが併存するため、テストは `getAllBy*` を基本に評価
- APIは入力検証・認可・エラー応答を重点
- backendテストでは Supabase依存を Jest モック化して安定実行
- SupabaseのRLS前提は、将来の結合テストで境界を確認

**コマンド**
- frontend: `pnpm --filter frontend test`
- frontend watch: `pnpm --filter frontend test:watch`
- backend: `pnpm --filter backend test`
- backend watch: `pnpm --filter backend test:watch`
- backend CI: `pnpm --filter backend test:ci`

**将来**
- E2Eは必要になってから追加
