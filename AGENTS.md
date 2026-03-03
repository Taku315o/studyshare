## AGENTS.md (Project Guide for `studyshare`)

最終更新: 2026-03-02

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
- 時間割 (`/timetable`) ※表示は実データ、検索/追加の一部はプレースホルダ
- コミュニティ (`/community`) ※候補表示/DMあり（DM制約時は警告表示、ローカル会話フォールバックなし）
- マイページ (`/me`) ※プロフィール編集（表示名/大学/学年/学部/アバター）・投稿一覧・設定
- オンボーディング (`/onboarding`) ※大学/学年の初期設定必須、学部は任意

### 互換/移行中の機能（legacy）
- 旧 `assignments` UI は `frontend/src/legacy/assignments/` に退避済み
- backend の `assignments` API / `assignments` bucket は legacy互換として残存（APIはデフォルト無効、`ENABLE_LEGACY_ASSIGNMENTS_API=true` で有効化）
- 現行の授業詳細ノート/口コミ/質問とは責務を分離して扱う

### 現在の大きな実装方針
- 読み取りの多く: frontend -> Supabase 直接参照（RLS/RPC前提）
- 副作用/画像アップロード: frontend -> backend (Express) -> Supabase
- 認証: Supabase Auth
- データ中心: `course_offerings` / `enrollments` / `notes` / `reviews` / `questions` / `profiles`

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
- `notes/reviews/questions`: 本人または同大学（`profiles.university_id`）中心の可視性制御
- `profiles.university_id` 未設定ユーザーは授業系投稿の閲覧に制約がかかるため、`/onboarding` 必須化で整合
- Messaging系は `conversation_members` policyの自己再帰に注意（helper関数経由）

### 主要RPC（現行）
- `find_match_candidates`
- `create_direct_conversation`
- `offering_enrollment_count`
- `offering_review_stats`
- `update_visibility_settings`（`SettingsPanel` から利用）
- legacy: `search_assignments`, `search_assignments_filtered`

### Storage bucket 前提
- `notes`（現行ノート画像）
- `avatars`（プロフィールアバター画像）
- `assignments`（legacy互換）

bucket未作成時:
- backend `/api/notes/upload` で `Bucket not found` が出る
- backend `/api/profiles/avatar/upload` でも同様に `Bucket not found` が出る
- migration適用状況を確認すること

## 現在の実装状況（できること / 未完了）

### 実装済み・反映済み（memo上の「過去の未解決」含む）
- ノート/口コミ/質問の「ログインが必要です」誤判定の修正（`OfferingTabs` 認証復元タイミング対応）
- 初回オンボーディング導入（大学/学年必須）
- `/me` で `display_name` / `university_id` / `grade_year` / `faculty` / `avatar_url` 編集
- アバター更新時に旧画像（`avatars/{userId}/...`）をbackend側で削除
- `/me` と `/onboarding` のプロフィール入力バリデーションを `zod` schemaへ統一
- 学年入力ルールを `1..6` に統一（`ProfileCard` / `/me` / `/onboarding`）
- `/onboarding` で `faculty`（任意）保存に対応
- `ProfileCard` 編集モーダルで外クリック閉じる対応（保存中は閉じない）
- 同大学スコープの説明表示（授業詳細UI）
- マイページ設定の公開範囲保存（`update_visibility_settings` RPC 経由）
- DM scope緩和用のmigrationあり（MVPでは `allow_dm` 優先 / `dm_scope` は将来用保持）
- `conversation_members` policy再帰エラー対策migrationあり
- ノート詳細ページでコメント/返信投稿（`note_comments.parent_comment_id`）
- 質問詳細ページで回答/返信投稿（`question_answers.parent_answer_id`）

### 現在のプレースホルダ / 暫定仕様（作業時に誤解しやすい）
- `/home` は `homeMockData` 使用（実データ化未完）
- `community`:
  - `reviews` / `more` タブは準備中
  - チップフィルタUIはあるが、取得クエリ条件に未反映（`activeChip` stateのみ）
  - DM作成/送信失敗時に `local:*` スレッドへフォールバック（非永続）
  - `list_threads` 相当の専用RPC/viewは未整備（フロントで複数クエリ合成）
- `timetable`:
  - 表示は実データ (`enrollments` + `course_offerings` + `offering_slots`)
  - 検索/追加モーダル/受講者探索CTAは準備中
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
- 「他人データ」「安全性」「複雑な判定」が絡む場合は raw table SELECT を避け、RPCやbackendへ寄せる

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

## テスト方針（実務向け要点）

詳細: `docs/testing.md`

### 優先度高
- 認証復元タイミングが絡む投稿導線（`OfferingTabs`）
- `AppRouteGuard`（未ログイン / onboarding未完了）
- `TimetableGrid`（表示/空状態/`dropped`切替）
- `community/page` のDM送信条件未達時警告（2年生以上は投稿2件以上）と送信抑止
- `SettingsPanel` の公開範囲保存
- backend `/api/notes/upload`（認証/バリデーション/Storage異常）

### 手動確認で必ず見る観点
- 同大学ユーザー / 別大学ユーザーで授業詳細の見え方が変わるか
- 大学未設定ユーザーが `/onboarding` に誘導されるか
- bucket未作成時の `/api/notes/upload` エラー切り分けができるか
- コミュニティでDM送信条件未達時に警告表示され、送信/スレッド作成されないか



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
