## AGENTS.md (Project Guide for `studyshare`)

最終更新: 2026-03-15

このファイルは、`studyshare` の現状実装に合わせた作業ガイドです。  
古い「課題共有アプリ」前提だけで判断しないこと。現在は `授業/口コミ + ノート + 時間割 + コミュニティ` を中心にした大学生活アプリへ移行済みです。


## 現在のプロダクト状態（2026-02時点）

### 現行の主機能（本体導線）
- ランディング + Googleログイン (`/`)
- ホーム (`/home`) ※現在は `homeMockData` ベース
- 授業・口コミ一覧 (`/offerings`)
- 授業詳細 (`/offerings/[offeringId]`) でノート/口コミ/質問/受講者数
- ノート詳細 (`/offerings/[offeringId]/notes/[noteId]`) でコメント/返信（無制限ツリー）
- 質問詳細 (`/offerings/[offeringId]/questions/[questionId]`) で回答/返信（無制限ツリー）
- 時間割 (`/timetable`) ※表示は実データ。曜日/時限はユーザー設定に応じて動的描画し、大学ごとの標準時限数（`5限`〜`10限` など）を保持できる。セル押下で `/timetable/add` へ遷移して検索/新規作成/登録まで行え、時間割上から取消/再登録もできる
- コミュニティ (`/community`) ※候補表示/DMあり（DM制約時は警告表示、ローカル会話フォールバックなし）
- 他ユーザープロフィール (`/profile/[userId]`) ※DM + 片方向フォロー、フォロワー/フォロー中一覧モーダル
- マイページ (`/me`) ※プロフィール編集（表示名/大学/学年/学部/アバター）・投稿一覧・設定・フォロー数表示
- オンボーディング (`/onboarding`) ※大学/学年の初期設定必須、学部は任意。大学標準時間割（大学ごとの実数時限）の自動適用/プレビュー/編集モーダル対応

### 互換/移行中の機能（legacy）
- 旧 `assignments` UI は `frontend/src/legacy/assignments/` に退避済み
- backend の `assignments` API / `assignments` bucket は legacy互換として残存（APIはデフォルト無効、`ENABLE_LEGACY_ASSIGNMENTS_API=true` で有効化）
- 現行の授業詳細ノート/口コミ/質問とは責務を分離して扱う

### 現在の大きな実装方針
- 読み取りの多く: frontend -> Supabase 直接参照（RLS/RPC前提）
- 複雑な時間割登録/講義作成: frontend -> Supabase RPC
- 副作用/画像アップロード: frontend -> backend (Express) -> Supabase
- 認証: Supabase Auth
- データ中心: `course_offerings` / `enrollments` / `notes` / `reviews` / `questions` / `profiles` / `follows`

##  アーキテクチャ要約（実態ベース）

### フロントエンド (`frontend`)
- Next.js App Router (`next@15`)
- React 19
- `AuthContext` でセッション状態配布
- `AppRouteGuard` で未ログイン制御 + `profiles.university_id` / `grade_year` 未設定時の `/onboarding` 強制
- `/(app)` 配下が認証後本体UI

主な実装ファイル:
- `frontend/src/components/auth/AppRouteGuard.tsx`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/app/(app)/layout.tsx`
- `frontend/src/components/layout/Sidebar.tsx`

### バックエンド (`backend`)
- Express + TypeScript
- 役割は主に:
  - 画像アップロードAPI（現行: `/api/notes/upload`, `/api/profiles/avatar/upload`）
  - legacy assignments API / 汎用 upload API は退避（デフォルト無効）
- JWT検証は Supabase Auth
- legacy互換の `users` テーブル参照は補助扱い（無くても認証継続）

主な実装ファイル:
- `backend/src/app.ts`
- `backend/src/routes/assignments.ts`
- `backend/src/routes/uploads.ts`
- `backend/src/middleware/auth.ts`

### Supabase (`supabase`)
- Auth / Postgres / Storage / RLS / RPC を使用
- スキーマの中核は `20260216132701_init_full_schema.sql`
- 追加migrationで質問/集計、可視性RPC、DM制約緩和、ノート画像、Storage bucket等を拡張

## データモデルとRLSの前提（作業前に理解必須）

詳細は `docs/db_schema.md` を優先参照。

### 中核モデル（重要）
- `universities`
- `terms`
- `courses`
- `course_offerings`
- `offering_slots`
- `profiles`
- `enrollments`
- `notes`
- `note_comments`
- `reviews`
- `questions`
- `question_answers`
- `follows`
- `timetable_presets`
- `profile_timetable_settings`
- `conversations`
- `conversation_members`
- `messages`

### 設計の核
- 授業情報は `Course`（恒久） と `Offering`（学期の実体）を分離
- 時間割は `enrollments`（user x offering）
- 他人の履修生データは直接読ませず、マッチングはRPCの集計結果で返す
- ノート/口コミ/質問は `offering_id` に紐付く

### RLSの重要前提
- `enrollments`: 本人のみ参照/更新（プライバシーの中核）
- `courses` / `course_offerings` / `offering_slots`: crowd insert を避け、ユーザー追加はRPC経由に寄せる
- `notes/reviews/questions`: 本人または同大学（`profiles.university_id`）中心の可視性制御
- `profiles.university_id` 未設定ユーザーは授業系投稿の閲覧に制約がかかるため、`/onboarding` 必須化で整合
- Messaging系は `conversation_members` policyの自己再帰に注意（helper関数経由）

### 主要RPC（現行）
- `find_match_candidates`
- `create_direct_conversation`
- `offering_enrollment_count`
- `offering_review_stats`
- `search_timetable_offerings`
- `suggest_offering_duplicates`
- `upsert_enrollment`
- `create_offering_and_enroll`
- `follow_user`
- `unfollow_user`
- `get_follow_summary`
- `list_follow_profiles`
- `update_visibility_settings`（`SettingsPanel` から利用）
- legacy: `search_assignments`, `search_assignments_filtered`

### Storage bucket 前提
- `notes`（現行ノート画像）
  - 現行は private bucket 前提。`notes.image_url` には公開URLではなく storage 参照を保存し、表示時に signed URL 化する
- `avatars`（プロフィールアバター画像）
- `assignments`（legacy互換）

bucket未作成時:
- backend `/api/notes/upload` で `Bucket not found` が出る
- backend `/api/profiles/avatar/upload` でも同様に `Bucket not found` が出る
- migration適用状況を確認すること

環境変数:
- frontend の upload 系 API は `NEXT_PUBLIC_BACKEND_API_URL` を本番必須とする。server-side route handler では `BACKEND_API_URL` も利用可
- backend 本番起動時は `.env.development` を読まない。production はデプロイ環境変数を唯一の truth とする

## 現在の実装状況（できること / 未完了）

### 実装済み・反映済み（memo上の「過去の未解決」含む）
- ノート/口コミ/質問の「ログインが必要です」誤判定の修正（`OfferingTabs` 認証復元タイミング対応）
- 初回オンボーディング導入（大学/学年必須）
- `/me` で `display_name` / `university_id` / `grade_year` / `faculty` / `avatar_url` 編集
- `/profile/[userId]` と `/me` でフォロワー数 / フォロー中数の表示と一覧モーダル
- `/profile/[userId]` でフォロー / フォロー解除（block 関係では不可）
- follow 作成時に `notifications` へ `type='follow'` を永続化
- アバター更新時に旧画像（`avatars/{userId}/...`）をbackend側で削除
- `/me` と `/onboarding` のプロフィール入力バリデーションを `zod` schemaへ統一
- 学年入力ルールを `1..6` に統一（`ProfileCard` / `/me` / `/onboarding`）
- `/onboarding` で `faculty`（任意）保存に対応
- `ProfileCard` 編集モーダルで外クリック閉じる対応（保存中は閉じない）
- 同大学スコープの説明表示（授業詳細UI）
- マイページ設定の公開範囲保存（`update_visibility_settings` RPC 経由）
- `timetable_presets` / `profile_timetable_settings` による大学標準時間割 + 個別設定保存
- `/me` の `SettingsPanel` に「時間割の時間・曜日」モーダルを実装（`modal=timetable-settings` クエリで初期表示対応）
- `/timetable` に「時間・曜日を変更」導線を追加（`/me?modal=timetable-settings&from=timetable`）
- `/timetable/add` で文脈付き講義検索、既存 offering 登録、重複候補付き新規作成、登録成功後の戻りハイライトに対応
- `/timetable` で授業カード/重複コマ一覧から `enrollments.status='dropped'` による取消、取消済みカードからの再登録に対応
- `/onboarding` で大学選択時に標準時間割を自動適用し、プレビュー表示と同ページ編集モーダルに対応
- `timetable_presets` / `profile_timetable_settings` は大学ごとの実数時限をそのまま保持する。`preset_id` 付き設定は master data 更新後に再同期でき、ユーザーが手動編集した設定は `preset_id=null` のカスタム設定として保持する
- DM scope緩和用のmigrationあり（MVPでは `allow_dm` 優先 / `dm_scope` は将来用保持）
- `conversation_members` policy再帰エラー対策migrationあり
- DM既読機能あり（`conversation_members.last_read_at` ベース、`/community` で未読件数/既読表示/Realtime追従）
- ノート詳細ページでコメント/返信投稿（`note_comments.parent_comment_id`）
- 質問詳細ページで回答/返信投稿（`question_answers.parent_answer_id`）

### 現在のプレースホルダ / 暫定仕様（作業時に誤解しやすい）
- `/home` は `homeMockData` 使用（実データ化未完）
- `community`:
  - `reviews` / `more` タブは準備中
  - チップフィルタUIはあるが、取得クエリ条件に未反映（`activeChip` stateのみ）
  - `list_threads` 相当の専用RPC/viewは未整備（フロントで複数クエリ合成）
- `timetable`:
  - 表示は実データ (`enrollments` + `course_offerings` + `offering_slots`) + `profile_timetable_settings` / `timetable_presets`
  - セルのお気に入りはUIプレースホルダ
- `/me`:
  - `保存` タブで「いいね/ブックマーク」したノートを統合表示（解除操作は未実装）

## ディレクトリ構造（現状）

```text
studyshare/
  AGENTS.md
  memo.md
  strategy.md
  strategy_final.md
  docs/
    architecture.md
    components.md
    testing.md
    security.md
    data-model.md
    db_schema.md
    db_diagram.md
    worktree_rules.md
  backend/
    src/
      app.ts
      index.ts
      controllers/
      middleware/
      routes/
      services/
      validators/
      lib/
      scripts/          # legacy assignments seedなど
  frontend/
    src/
      app/              # Next.js App Router
      components/       # 現行UI
      context/
      lib/
      types/
      legacy/assignments/  # 旧課題共有UI（退避）
  supabase/
    migrations/        # 現行スキーマ + 拡張migration
    migrations/_broken/ # 参考用。通常作業で再適用しない
    config.toml
```

## 開発コマンド（現状）

### ルート
- `pnpm dev:frontend`
- `pnpm dev:backend`
- `pnpm build`
- `pnpm test`（現状は frontend test を呼ぶ）

### frontend (`frontend/package.json`)
- `pnpm --filter frontend dev`
- `pnpm --filter frontend build`
- `pnpm --filter frontend start`
- `pnpm --filter frontend lint`
- `pnpm --filter frontend test`
- `pnpm --filter frontend test:watch`

### backend (`backend/package.json`)
- `pnpm --filter backend dev`
- `pnpm --filter backend build`
- `pnpm --filter backend start`
- `pnpm --filter backend seed`（legacy assignments系の開発用seed）
- `pnpm --filter backend test`
- `pnpm --filter backend test:watch`
- `pnpm --filter backend test:ci`

## 環境・実行時の注意

### 認証/接続
- frontend と backend はそれぞれ Supabase接続に必要な環境変数を使う
- backend は `src/index.ts` で `.env.development` を読む前提（ローカル開発時）

### ルート設計
- `/` はランディング兼ログイン導線
- 認証済みで `/` に来たら `/home` へリダイレクト
- `/profile` と `/mypage` は `/me` への互換リダイレクト

### 直接Supabase参照の原則
- 読み取り系は frontend から直接読むケースが多い
- 「他人データ」「安全性」「複雑な判定」が絡む場合は raw table SELECT / INSERT を避け、RPCやbackendへ寄せる

## DB / Supabase 運用ルール（最重要）

### 絶対ルール（worktree安全）
- `main` / `dev` 以外の worktree で `supabase db reset` や `supabase migration up` を自動実行しない
- スキーマ変更が必要でも、基本は `supabase migration new <name>` で migrationファイルのみ作成
- 既存DB適用が必要なときは、必ずユーザー確認のうえで実施

### migration運用
- DDL変更: migrationファイルで行う
- 変更後は `docs/db_schema.md` を更新
- 必要に応じて `docs/security.md` / `docs/architecture.md` / `docs/data-model.md` も更新
- `supabase/migrations/_broken/` は履歴・退避扱い。通常の変更対象にしない

### コミュニティ/DM系のSQL実装原則
- UI先行で無理に進めず、先にRLS/RPCを固める
- 特に以下はSQL/RLS側を先に設計:
  - `list_threads` 相当一覧
  - `can_dm` / `allow_dm` / block関連判定
  - 足跡/解放条件（`can_view_footprints` など）

## 実装判断ルール（このプロジェクト向け）

### frontend直叩き vs backend経由（ハイブリッド継続）

frontend -> Supabase 直でよいもの:
- 単純なSELECT
- RLSで完結する本人データ取得
- 集計RPCの呼び出し

backend or SQL RPCに寄せるべきもの:
- ファイルアップロード
- 複数テーブルをまとめて更新
- 権限判定が複雑
- 監査/通報/レート制限を挟みたい

### バリデーション方針（frontend/backend共通）
- 新規の入力バリデーション実装は `zod` を標準とする
- frontend のフォームバリデーションは `frontend/src/lib/validation/` 配下に schema を切り出して再利用する
- 手書きの分岐バリデーション追加は原則避け、`safeParse` の結果でUIエラー表示を行う

### legacyと現行の混同を避ける
- `assignments` を触る前に、それが現行導線か legacy互換か確認する
- 現行本体機能の優先は `offerings` / `timetable` / `community` / `me`
- legacy対応で本体側設計を汚さない（責務分離）

### 大学スコープの一貫性
- 授業系投稿（ノート/口コミ/質問）を触る変更では、同大学スコープ/RLS/UI説明の整合を確認
- `profiles.university_id` 未設定時の挙動も確認

### 重複講義（将来実装時の注意）
- ユーザー追加講義を安易に `course_offerings` 乱立で作らない
- 「候補検索 -> 無ければ作成 -> 近似候補提示」の流れを前提に設計する
- 現行の `/timetable/add` 新規作成では `suggest_offering_duplicates` を先に見せ、`exact/strong` 候補がある場合は override 明示なしで作成しない

## テスト方針（実務向け要点）

詳細: `docs/testing.md`

### 優先度高
- 認証復元タイミングが絡む投稿導線（`OfferingTabs`）
- `AppRouteGuard`（未ログイン / onboarding未完了）
- `TimetableGrid`（表示/空状態/`dropped`切替/取消/再登録/セル遷移/戻りハイライト/重複モーダル同期）
- `/timetable/add`（文脈ヘッダー/検索/登録/学期切替）
- `CreateOfferingModal`（必須項目/「不明」トグル/重複候補blocking）
- `OfferingHeader` の時間割追加CTA（追加済み/再登録）
- `community/page` のDM送信条件未達時警告（2年生以上は投稿2件以上）と送信抑止
- `community/page` の未読件数/既読更新/Realtime追従
- `SettingsPanel` の公開範囲保存
- backend `/api/notes/upload`（認証/バリデーション/Storage異常）

### 手動確認で必ず見る観点
- 同大学ユーザー / 別大学ユーザーで授業詳細の見え方が変わるか
- 大学未設定ユーザーが `/onboarding` に誘導されるか
- `/timetable` の空セル/埋まったセルから `/timetable/add` に正しい文脈 (`day/period/termId`) で遷移するか
- `/timetable` の授業カードと重複コマ一覧から講義を取消でき、`取消を表示` オフでは即座に消えるか
- `取消を表示` オンで取消済みカードが見え、時間割上から再登録できるか
- `/timetable/add` で登録成功後、時間割に戻って反映・スクロール復元・追加セルハイライトが行われるか
- 新規作成で重複候補が表示され、blocking候補があると override 明示なしで作成できないか
- bucket未作成時の `/api/notes/upload` エラー切り分けができるか
- コミュニティでDM送信条件未達時に警告表示され、送信/スレッド作成されないか
- コミュニティで未読件数が増減し、会話を開くと既読化されるか
- 2端末 or 2セッションで既読表示が `未読 -> 既読` に変わるか



## 作業時の更新ルール（docs / tests）

- 機能追加・仕様変更・RLS変更時は、必要に応じて docs を更新する
- プレースホルダを実装したら、`AGENTS.md` と `docs/testing.md` の該当記述を更新する
- `memo.md` の解決済み項目は残っていても、現コードに合わせて扱う（鵜呑みにしない）

## 設計方針(現状)
- アーキテクチャ: @docs/architecture.md
- コンポーネント規約: @docs/components.md
- テスト戦略: @docs/testing.md
- データモデル: @docs/data-model.md
- セキュリティ: @docs/security.md 
- db schema: @docs/db_schema.md
- Supabase運用: @docs/supabase_operations.md
- Seed運用: @docs/supabase_seeds.md
