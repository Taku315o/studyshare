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

**例**
- `AssignmentList`: 一覧表示と検索結果表示
- `AssignmentForm`: 投稿フォーム
- `Header`: 認証状態に応じたヘッダーUI

**Offering詳細ページ（追加）**
- `src/app/(app)/offerings/[offeringId]/page.tsx`: Server Componentで offering 基本情報/件数/一覧初期データを取得
- `src/components/offerings/OfferingHeader.tsx`: タイトル表示と「時間割に追加」CTA
- `src/components/offerings/OfferingTabs.tsx`: タブ切替・投稿モーダル・ページング・リアクショントグル
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
