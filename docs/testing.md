**テスト戦略**

**移行メモ（2026-02-25）**
- 旧 `AssignmentForm` / `AssignmentList` / `SearchForm` / `Header` / `Hero` のテストは `frontend/src/legacy/assignments/tests/` へ退避（参照用）。
- 現行の優先テスト対象は `/(app)` フロー（授業詳細・ノート・口コミ・コミュニティ）を中心にする。

**現状**
- frontend: Jest + React Testing Libraryの基盤あり
- backend: Jest + Supertest で API統合テスト + ユニットテストを実装

**優先テスト**
- UI
- `AssignmentForm` 投稿フロー
- `AssignmentList` 検索/一覧表示
- `AuthContext` 認証状態の更新
- `AppRouteGuard` の未ログイン時リダイレクト / 初期設定未完了時 `onboarding` リダイレクト / 完了時通過
- `TimetableGrid` ローディング/空状態/表示切替（`dropped`トグル）
- `TimetableCell` セル表示（授業カード/空セル）と遷移動作
- `Sidebar` の `/timetable` 導線有効化
- `Sidebar` の `/community` 導線有効化
- `CommunityPane` の候補0件空状態
- `MessagesPane` のスレッド0件空状態
- `MessageComposer` の Enter送信と送信ボタン送信
- `community/page` の DM送信条件未達時警告表示と送信抑止（ローカル会話に切り替えない）
- `OfferingTabs` の投稿/リアクション時認証判定（初回マウント時未復元でも投稿直前再確認で通る）
- `me/page` の4セクション表示（プロフィール/資産/時間割サマリ/設定）
- `ProfileCard` のプロフィール編集モーダル開閉と保存（display_name / 大学 / 学年 / 学部 / アバター画像、外クリック閉じる、保存中は閉じない）
- `me/page` のプロフィール保存で avatar upload 成功時に `avatar_url` を含めて upsert し、upload失敗時は保存を中断する
- `onboarding/page` の大学・学年入力（必須）+ 学部入力（任意）と保存導線
- `src/lib/validation/profile.ts` の `zod` schema境界値テスト（学年 `0/1/6/7`）
- `MyAssetsTabs` のタブ切替（ノート/口コミ/保存）と保存件数表示
- `MySavedNotesList` の空状態/バッジ表示（いいね・ブックマーク）/重複統合表示
- `TimetableSummary` の空状態/授業表示
- `/profile` と `/mypage` の `/me` リダイレクト
- API
- `POST /api/assignments` バリデーション/認証
- `DELETE /api/assignments/:id` 管理者権限
- `POST /api/upload` 画像バリデーション
- `POST /api/notes/upload` 画像バリデーション/認証（現行ノート画像添付）
- `POST /api/notes/upload` で legacy `users` テーブル不在でも認証継続できること
- `POST /api/profiles/avatar/upload` 画像バリデーション/認証/idempotency
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
- RLSで可視性が変わる機能（ノート/口コミ/質問）は、UIテストだけでなく「同大学 / 別大学 / 大学未設定」の手動確認観点を必ず残す

**手動確認チェック（追加）**
- 授業詳細（`/offerings/[offeringId]`）
- 同大学ユーザー: ノート/口コミ/質問が見える
- 別大学ユーザー: 他人投稿が見えない（仕様どおり）
- 大学未設定ユーザー: `/onboarding` に誘導される
- `/me` のプロフィール編集で大学/学年を変更後、授業詳細の見え方が変わる
- `/me` と `/onboarding` の学年入力で `7` 以上が保存できないこと（UI選択肢/バリデーション一致）
- 投稿導線（ノート/口コミ/質問）
- ログイン直後（セッション復元直後）でも「ログインが必要です」誤判定にならない
- ノート画像添付アップロード
- Storage bucket 未作成時に backend ログへ `Bucket not found` が出ることを確認できる（原因切り分け）
- bucket 作成後に `image_url` 付きで `notes` insert が成功する
- プロフィール画像アップロード
- `/me` で学部とアバターを保存後、再読込しても表示が維持される
- アバター更新後、旧 `avatars/{userId}/...` オブジェクトが残存しないこと
- `avatars` bucket 未作成時に `/api/profiles/avatar/upload` が失敗し、原因切り分けできる

**コマンド**
- frontend: `pnpm --filter frontend test`
- frontend watch: `pnpm --filter frontend test:watch`
- backend: `pnpm --filter backend test`
- backend watch: `pnpm --filter backend test:watch`
- backend CI: `pnpm --filter backend test:ci`

**将来**
- E2Eは必要になってから追加
