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
- `TimetableGrid` ローディング/空状態/表示切替（`dropped`トグル）/設定依存の行列描画/設定外授業警告/セル遷移/戻りハイライト/削除/再登録/重複モーダル同期
- `TimetableCell` セル表示（授業カード/空セル）と遷移動作、削除/再登録アクション
- `TimetableAddPage` の文脈ヘッダー/検索語初期値/学期切替/slot match 優先表示
- `CreateOfferingModal` の必須項目バリデーション/「不明」トグル/重複候補 blocking/override/部分収録警告
- `OfferingHeader` の時間割追加CTA（追加済み/再登録/再追加抑止）
- `Sidebar` の `/timetable` 導線有効化
- `Sidebar` の `/community` 導線有効化
- `CommunityPane` の候補0件空状態
- `MessagesPane` のスレッド0件空状態
- `MessageComposer` の Enter送信と送信ボタン送信
- `community/page` の DM送信条件未達時警告表示と送信抑止（ローカル会話に切り替えない）
- `community/page` の未読件数算出（`conversation_members.last_read_at` 基準）
- `community/page` のスレッド選択時既読化（`conversation_members.last_read_at` update）
- `community/page` の送信メッセージ既読表示（相手 `last_read_at` 追従）
- `OfferingTabs` の投稿/リアクション時認証判定（初回マウント時未復元でも投稿直前再確認で通る）
- `buildThreadTree` の多段ツリー構築（親不在ノードfallback / created_at昇順）
- ノート詳細（`/offerings/[offeringId]/notes/[noteId]`）のコメント投稿/返信投稿/削除済み表示
- 質問詳細（`/offerings/[offeringId]/questions/[questionId]`）の回答投稿/返信投稿/削除済み表示
- 授業詳細の質問一覧で回答件数表示と詳細遷移
- `me/page` の4セクション表示（プロフィール/資産/時間割サマリ/設定）
- `ProfileCard` のプロフィール編集モーダル開閉と保存（display_name / 大学 / 学年 / 学部 / 自己紹介 / アバター画像、外クリック閉じる、保存中は閉じない）
- `ProfileFollowPanel` のフォロー作成/解除の optimistic update・二重送信防止・失敗時 rollback
- `FollowListModal` の初回20件表示 / `もっと見る` によるページング
- `me/page` のプロフィール保存で avatar upload 成功時に `avatar_url` と `bio` を含めて upsert し、upload失敗時は保存を中断する
- `onboarding/page` の大学・学年入力（必須）+ 学部入力（任意）+ 大学標準時間割プレビュー/編集モーダル/保存導線（`7限` 表示含む）
- `SettingsPanel` の時間割設定モーダル（`modal=timetable-settings` 初期表示・保存・`7限` 入力欄表示）
- `src/lib/validation/profile.ts` の `zod` schema境界値テスト（学年 `0/1/6/7`、自己紹介文字数上限）
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
- upload系APIで 5MB 超過ファイルが multer の route middleware 段階で 400 になること（DoS軽減）
- `assignments.routes.test.ts` では `createApp({ enableLegacyAssignmentsApi: true, enableLegacyUploadApi: true })` を使い、env依存なしで legacy route を明示有効化する
- SQL / RLS
- `follow_user` が自己 follow / block 関係を拒否し、重複 follow を1件に保つ
- `unfollow_user` が作成者本人の edge のみ削除する
- follow insert/delete と block insert 後に `user_stats.followers_count/following_count` が一致する
- follow insert で `notifications(type='follow')` が1件だけ作成される
- `search_timetable_offerings` が `slot_match` / `enrollment_count` / `my_status` を返す
- `search_timetable_offerings` が `course_offerings.is_active = false` を返さない
- `offering_catalog_coverages` が同大学ユーザーからのみ読める
- `list_my_timetable` が selected term の enrollments だけ返し、slot なし offering を `is_unslotted=true` で返す
- `suggest_offering_duplicates` が same title / instructor / slot / term の候補理由を返す
- `suggest_offering_duplicates` が `course_offerings.is_active = false` を返さない
- `upsert_enrollment` が active 重複追加を吸収し、`dropped` を `enrolled` へ戻せる
- `upsert_enrollment(status='dropped')` で時間割ページから取消できる
- `create_offering_and_enroll` が transaction 一括成功し、blocking 候補時は reject する
- `courses` / `course_offerings` / `offering_slots` の直接 insert が client 前提になっていないこと
- importer unit
- Senshu detail parser が `term / course_code / slot_kind / raw_text` を抽出できる
- `--department` 指定が request scope に反映され、未知ラベルは reject される
- 同じ external id の再実行で `course_offerings` / `offering_slots` が増殖しない
- manual mapping が再実行で維持される
- `--retire-missing` ありの successful slice run で missing offering が inactive になる
- partial import で `offering_catalog_coverages.source_scope_labels` が和集合で保持される
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
- ノートカードからノート詳細へ遷移し、コメント/返信が投稿できる
- 質問カードから質問詳細へ遷移し、回答/返信が投稿できる
- 削除済みコメント/回答が「削除された投稿です。」表示でツリー維持される
- `/me` のプロフィール編集で大学/学年を変更後、授業詳細の見え方が変わる
- `/profile/[userId]` のフォローボタン押下で即時に状態と件数が切り替わり、再読込後も維持される
- block 済み相手では follow 操作が失敗し、レコードが作成されない
- `/me` / `/profile/[userId]` のフォロワー一覧・フォロー中一覧モーダルでページ送りできる
- `/me` と `/onboarding` の学年入力で `7` 以上が保存できないこと（UI選択肢/バリデーション一致）
- `/me` のプロフィール編集モーダルで保存ボタン連打・オーバーレイ連打をしても重複送信/保存中クローズが起きない
- 設定パネルの公開範囲保存で連打しても RPC が二重発火しない
- `/timetable` から「時間・曜日を変更」で `/me?modal=timetable-settings&from=timetable` に遷移できる
- 時間割設定を変更した内容が `/timetable` の行列（曜日・時限）に反映される
- 既存ユーザーの `5限` 設定を読み込んだ場合でも、`6限` / `7限` が補完されて `/onboarding`・`/me`・`/timetable` に表示される
- `/timetable?termId=...` で表示 term が切り替わり、別 term に切り替えても過去 term の履修が消えない
- 設定外スロットの授業がある場合に警告表示される
- slot 未設定の授業が「集中・日時未定」セクションに出る
- 空セルと授業カード補助ボタンから `/timetable/add` に文脈付き (`day/period/termId`) で遷移できる
- 時間割カードと重複モーダルの両方から講義を取消でき、`取消を表示` オフでは即座に消える
- `取消を表示` オンで取消済みカードが見え、時間割上から再登録できる
- `/timetable/add` で登録成功後、時間割へ戻って再描画・スクロール復元・追加セルまたは設定外/日時未定セクションのハイライトが見える
- 新規講義作成時に重複候補が表示され、blocking 候補がある間は override 明示なしで作成できない
- partial import 済み term では `/offerings` と `/timetable/add` に「一部区分のみ収録中」バナーが出る
- partial import 済み term で no-results のとき、未収録の可能性が明示される
- コミュニティで非選択スレッドへの新着受信時に一覧未読件数が増える
- コミュニティで会話を開くとその時点までの受信メッセージが既読になり、送信側で最新メッセージが `未読 -> 既読` に変わる
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
