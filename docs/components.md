**コンポーネント規約**

**責務分離**
- `src/app`: ルーティングとページ構成
- `src/components`: UIコンポーネントと画面の組み立て
- `src/context`: 認証状態の管理と配布
- `src/lib`: APIクライアントとSupabaseクライアント

**実装ルール**
- 1コンポーネント1責務
- 画面の状態管理はページ or 専用コンポーネントで完結
- API呼び出しは `src/lib/api.ts` に集約
- Supabase直接参照は読み取り中心とし、複雑な更新は raw table 書き込みではなく RPC / backend に寄せる
- 認証状態は `AuthContext` 経由で参照
- 入力バリデーションは `zod` を標準とし、schema は `src/lib/validation/` に集約して再利用する
- 非同期submitは `isSaving` state だけに依存せず、`isSubmittingRef` などの同期ガードを併用して二重送信を防止する

**命名・配置**
- 機能単位の命名を優先（例: `AssignmentList`, `AssignmentForm`, `SearchForm`, `Header`）
- 共通UIは `src/components` に配置
- 画面固有の構成は `src/app` に配置
- 認証後の遷移制御（ログイン済み/未ログイン、初期設定完了判定）は `src/components/auth` のガードコンポーネントに寄せる

**例**
- `AssignmentList`: 一覧表示と検索結果表示
- `AssignmentForm`: 投稿フォーム
- `Header`: 認証状態に応じたヘッダーUI

**Offering詳細ページ（追加）**
- `src/app/(app)/offerings/[offeringId]/page.tsx`: Server Componentで offering 基本情報/件数/一覧初期データを取得
- `src/app/(app)/offerings/[offeringId]/page.tsx`: ノート/口コミ/質問の同大学スコープ表示に関する説明バナーを表示
- `src/app/(app)/offerings/[offeringId]/notes/[noteId]/page.tsx`: ノート詳細 + コメントスレッド（無制限ツリー）表示・投稿
- `src/app/(app)/offerings/[offeringId]/questions/[questionId]/page.tsx`: 質問詳細 + 回答スレッド（無制限ツリー）表示・投稿
- `src/components/offerings/OfferingHeader.tsx`: タイトル表示と `upsert_enrollment` ベースの「時間割に追加」CTA
- `src/components/offerings/OfferingTabs.tsx`: タブ切替・投稿モーダル・ページング・リアクショントグル・投稿直前の認証再確認・詳細ページ遷移
- `src/components/notes/NoteCard.tsx`: ノートカード（like/bookmark/comment件数、詳細ページ導線）
- `src/components/questions/QuestionCard.tsx`: 質問カード（回答件数、詳細ページ導線）
- `src/components/reviews/ReviewCard.tsx`: 口コミカード（評価・本文・投稿者）
- `src/components/thread/ThreadPanel.tsx`: コメント/回答のツリー表示と返信投稿UI（共通）

**時間割ページ（追加）**
- `src/app/(app)/timetable/page.tsx`: Server Componentでページ骨組みを提供
- `src/app/(app)/timetable/add/page.tsx`: Server Componentで追加ページのラッパーを提供
- `src/components/timetable/TimetableGrid.tsx`: Client Componentで `enrollments` と `profile_timetable_settings` をもとに動的時間割を構築し、セル文脈を `/timetable/add` へ渡す
- `src/components/timetable/TimetableCell.tsx`: セル単位の表示責務（授業カード/空セルUI/追加導線）
- `src/components/timetable/TimetableAddPage.tsx`: 文脈付き検索、既存 offering 登録、戻り同期を扱う Client Component
- `src/components/timetable/CreateOfferingModal.tsx`: 重複候補付きの新規講義作成モーダル
- `src/components/timetable/TimetableSettingsModal.tsx`: 時間・曜日設定を編集する共有モーダル
- `src/components/timetable/TimetableConfigPreview.tsx`: 時間割設定のプレビュー表示
- `src/lib/timetable/add.ts`: 追加ページ用URL/context/sessionStorage utility
- `src/lib/timetable/enrollment.ts`: `upsert_enrollment` 呼び出しと結果整形
- `src/lib/timetable/search.ts`: 検索結果・重複候補RPCの row mapper
- `src/lib/timetable/terms.ts`: current term 解決ロジックの共通化
- `src/lib/validation/offering.ts`: 新規講義作成フォームの `zod` schema
- `src/types/timetable.ts`: 時間割用の型定義（曜日/時限/status/view model）

**時間割コンポーネント実装ルール**
- Offeringを主語に表示する（`course_offerings` をUI上「Offering」として扱う）
- グリッドはユーザーの設定（`weekdays` / `periods`）をもとに動的生成する
- 時間割の描画ソースは `enrollments + offering_slots` とし、空セルタップ/授業カードの補助ボタンは `/timetable/add?day=...&period=...&termId=...` へ遷移する
- `/timetable/add` の初期一覧は `search_timetable_offerings` を一次ソースとし、同大学・同学期・同曜日限を優先表示する
- 履修登録は `upsert_enrollment` で統一し、`dropped` 再登録も同じ mutation で扱う
- 新規作成は `CreateOfferingModal` から `create_offering_and_enroll` を呼び、事前に `suggest_offering_duplicates` を表示して `exact/strong` 候補を blocking 扱いにする
- 設定外スロットに授業が存在する場合は警告表示し、設定見直しを促す
- 重複コマは「主表示1件 + `+N` バッジ」で表現し、詳細はモーダルで補完する
- 追加ページからの戻り同期は `sessionStorage` による one-shot scroll/highlight payload で行う

**コミュニティページ（追加）**
- `src/app/(app)/community/page.tsx`: Client Componentでマッチング候補・スレッド・会話状態を統合管理
- `src/components/community/CommunityPane.tsx`: 左ペイン（タブ/検索/チップ/候補一覧）
- `src/components/community/MatchCard.tsx`: 候補カード表示と「メッセージを送る」CTA
- `src/components/community/MessagesPane.tsx`: 右ペイン全体（スレッド一覧 + 会話 + Composer）
- `src/components/community/ThreadList.tsx`: スレッド一覧表示と選択制御
- `src/components/community/ChatView.tsx`: 会話バブル表示（自分/相手の左右寄せ）
- `src/components/community/MessageComposer.tsx`: 送信フォーム（Enter送信対応）
- `src/types/community.ts`: コミュニティUI専用ViewModel型

**コミュニティ実装ルール**
- マッチングは `find_match_candidates` の集計結果のみ利用し、他ユーザーの生 `enrollments` は参照しない
- DM作成は `create_direct_conversation` RPC を使い、作成/送信に失敗した場合はローカル会話モードへフォールバックする
- モバイルではメッセージペインをモーダル表示し、PCでは2ペイン表示を維持する

**マイページ（/me）（追加）**
- `src/app/(app)/me/page.tsx`: Client Componentで `auth.getUser()` を起点に `profiles`/`universities`/`notes`/`reviews`/`note_reactions`/`enrollments` を取得
- `src/components/me/ProfileCard.tsx`: avatar・display_name・大学/学年・学部・自己紹介表示とプロフィール編集モーダル（表示名/大学/学年/学部/自己紹介/アバター画像、外クリック閉じる、保存中は閉じない）
- `src/components/me/MyAssetsTabs.tsx`: 「ノート/口コミ/保存」タブ切り替えと資産表示
- `src/components/me/MyNotesList.tsx`: 自分のノート一覧表示
- `src/components/me/MyReviewsList.tsx`: 自分の口コミ一覧表示
- `src/components/me/MySavedNotesList.tsx`: いいね/ブックマークしたノートの統合一覧表示
- `src/components/me/TimetableSummary.tsx`: 今学期履修数と今日の授業サマリ表示
- `src/components/me/SettingsPanel.tsx`: ログアウト・公開範囲設定・時間割時間/曜日設定
- `src/lib/validation/profile.ts`: プロフィール編集/初期設定の `zod` schema（学年 `1..6`）
- `src/lib/timetable/config.ts`: 時間割設定のschema/プリセット解決/ユーザー設定保存ロジック
- `src/types/me.ts`: マイページのViewModel型定義

**マイページ実装ルール**
- `/me` は Supabase Browser Client + RLS で本人データのみ参照する
- `profiles` の主キーは `user_id` として扱う
- `ProfileCard` の編集では `display_name` だけでなく `university_id` / `grade_year` / `faculty` / `bio` / `avatar_url` を保存し、授業系投稿の同大学スコープと整合させる
- アバター画像は frontend 直アップロードではなく backend `POST /api/profiles/avatar/upload` 経由で保存する
- `ProfileCard` / `/me` 保存処理 / `/onboarding` は同一の `zod` schema群を使って整合性を保つ
- 学年入力のドメインは `1..6` を正とする（select/validation とも一致させる）
- `保存` タブは `note_reactions(kind in ['like','bookmark'])` を `note_id` 単位で統合し、重複表示しない
- `ProfileCard` と `SettingsPanel` の保存処理はローカル同期ガード（`useRef`）を併用し、短時間連打による重複リクエストを抑止する

**オンボーディング（追加）**
- `src/app/(app)/onboarding/page.tsx`: 認証済みユーザー向け初期設定（大学・学年必須、学部任意）+ 大学標準時間割の自動適用/プレビュー/編集モーダル
- `src/components/auth/AppRouteGuard.tsx`: 未ログイン判定に加えて `profiles.university_id` / `grade_year` の完了判定を行い、必要時に `/onboarding` へ遷移
