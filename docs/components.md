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
- Supabase直接参照は読み取りに限定（例外: `src/app/profile/page.tsx` の本人投稿削除。RLS前提）
- 認証状態は `AuthContext` 経由で参照

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
- `src/components/offerings/OfferingHeader.tsx`: タイトル表示と「時間割に追加」CTA
- `src/components/offerings/OfferingTabs.tsx`: タブ切替・投稿モーダル・ページング・リアクショントグル・投稿直前の認証再確認
- `src/components/notes/NoteCard.tsx`: ノートカード（like/bookmark/comment件数）
- `src/components/reviews/ReviewCard.tsx`: 口コミカード（評価・本文・投稿者）

**時間割ページ（追加）**
- `src/app/(app)/timetable/page.tsx`: Server Componentでページ骨組みを提供
- `src/components/timetable/TimetableGrid.tsx`: Client Componentで `enrollments` を起点に時間割を構築
- `src/components/timetable/TimetableCell.tsx`: セル単位の表示責務（授業カード/空セルUI）
- `src/types/timetable.ts`: 時間割用の型定義（曜日/時限/status/view model）

**時間割コンポーネント実装ルール**
- Offeringを主語に表示する（`course_offerings` をUI上「Offering」として扱う）
- グリッドは固定枠（月-金、1-5限）を維持し、空セルにも追加導線を表示する
- 重複コマは「主表示1件 + `+N` バッジ」で表現し、詳細はモーダルで補完する

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
- `src/app/(app)/me/page.tsx`: Client Componentで `auth.getUser()` を起点に `profiles`/`universities`/`notes`/`reviews`/`enrollments` を取得
- `src/components/me/ProfileCard.tsx`: avatar・display_name・大学/学年・所属表示とプロフィール編集モーダル（表示名/大学/学年）
- `src/components/me/MyAssetsTabs.tsx`: 「ノート/口コミ/保存」タブ切り替えと資産表示
- `src/components/me/MyNotesList.tsx`: 自分のノート一覧表示
- `src/components/me/MyReviewsList.tsx`: 自分の口コミ一覧表示
- `src/components/me/TimetableSummary.tsx`: 今学期履修数と今日の授業サマリ表示
- `src/components/me/SettingsPanel.tsx`: ログアウトと公開範囲（UI先行）設定
- `src/types/me.ts`: マイページのViewModel型定義

**マイページ実装ルール**
- `/me` は Supabase Browser Client + RLS で本人データのみ参照する
- `profiles` の主キーは `user_id` として扱う
- `ProfileCard` の編集では `display_name` だけでなく `university_id` / `grade_year` も保存し、授業系投稿の同大学スコープと整合させる
- `保存` タブと `公開範囲` 保存は Phase2 前提で、現段階はUIプレースホルダとする

**オンボーディング（追加）**
- `src/app/(app)/onboarding/page.tsx`: 認証済みユーザー向け初期設定（大学・学年）ページ
- `src/components/auth/AppRouteGuard.tsx`: 未ログイン判定に加えて `profiles.university_id` / `grade_year` の完了判定を行い、必要時に `/onboarding` へ遷移
