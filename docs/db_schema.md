# StudyShare schema v1（Supabase/Postgres）

## このDBが解いている問題（設計の核）
- 「授業（Course）」と「その学期の実体（Offering）」と「自分の時間割（Enrollment）」を分離し、誤マッチやUX破綻を防ぐ。
- ノート/レビューは「授業名」ではなく `Offering` に紐づけ、同名別クラス問題を防止する。
- マッチングは「他人の履修情報を直接見せない」方針で、集計結果のみ返す安全設計にする。

## 主要概念（3層モデル + Enrollment）

### A. University（大学）
- `universities`: 大学マスタ（`name` は一意）

### B. Term（学期）
- `terms`: `(university_id, year, season)` が一意
- 例: 専修大学 2026 spring

### C. Course（科目の恒久枠）
- `courses`: 「科目コード / 科目名」の恒久枠
- `course_code` は存在する場合のみ一意制約（`university_id + course_code`）

### D. Offering（その学期の授業実体）
- `course_offerings`: `course_id + term_id` に紐づく「その学期のクラス」
- `section` / `instructor` / `syllabus_url` を保持
- `offering_slots`: 曜日・時限・教室などの時間割スロット（`intensive` は `null` 許容）

### E. Enrollment（ユーザーの時間割）
- `enrollments`: `(user_id, offering_id)` 複合PK
- `status`: `enrolled` / `planned` / `dropped`
- `visibility`: `private` / `match_only` / `public`
- 時間割は「ユーザー × Offering の関係」として表現し、入力UXやシラバス検索導線と接続する。

## ユーザー領域（プロフィール・統計）
- `profiles`: `auth.users` と1:1の公開プロフィール
	- `university_id`, `display_name`, `handle`, `dm_scope`, `allow_dm` など
- `user_stats`: 投稿数を保持（`notes_count` / `reviews_count`）
	- `contributions_count` は generated（`notes + reviews`）
	- ノート/レビューの INSERT・soft-delete をトリガーに更新

## コンテンツ（ノート・レビュー）

### A. Notes
- `notes`: `offering_id` に紐づく（授業実体単位）
- `visibility`: `public` / `university` / `offering_only` / `private`
- `search_tsv`: `title` / `body` / `tags` を tsvector 化（`unaccent + simple`）
- `deleted_at` によるソフトデリート
- 関連テーブル
	- `note_assets`: 添付（`storage_path`）
	- `note_reactions`: リアクション（PK: `note_id, user_id, kind`）
	- `note_comments`: コメント（`deleted_at` あり）

### B. Reviews（ラク単想定）
- `reviews`: `offering_id` に紐づく（授業実体単位）
- `rating (1..5)` + `difficulty` / `content` / `attendance` / `grading` + `comment`
- `deleted_at` によるソフトデリート
- 「同一ユーザー × 同一offeringは1件のみ（`deleted_at is null` の間）」をユニーク制約で保証

### C. Questions
- `questions`: `offering_id` に紐づく質問
- カラム: `title`, `body`, `author_id`, `created_at`, `updated_at`, `deleted_at`
- RLS:
	- `select`: `can_view_question()`（同大学 or author）
	- `insert`: `author_id = auth.uid()` かつ `is_enrolled(auth.uid(), offering_id)`
	- `update/delete`: author のみ

## 安全機能（ブロック・通報・足跡）
- `blocks`: 相互遮断判定 `is_blocked(a, b)` を提供
- `reports`: `target_type(user/note/review/message)` + `target_id` + `reason`
- `profile_views`: 足跡（`viewer_id -> viewed_id`）

## マッチング（履修情報の漏洩を避ける）

### 重要ポイント
- `enrollments` はRLSで本人しか読めない。
- 代わりに「共有offering数」などの集計だけをRPC/関数で返す。

### 関数
- `shared_offering_count(a, b)`
	- 共通履修（`enrolled` 同士）数を返す。
- `find_match_candidates(limit, min_shared)`
	- `auth.uid` と共通Offeringがあるユーザーを返す。
	- 返却情報は `profiles` の最小限（`display_name` / `avatar` / `faculty` / `department`）+ 共有数のみ。
- `offering_enrollment_count(offering_id)`
	- `enrollments` の `status='enrolled'` 件数のみ返す（受講者一覧は返さない）。
- `offering_review_stats(offering_id)`
	- `avg_rating` / `review_count` / `rating_1..5_count` を返す。

## DM（権限ゲーティング込み）

### A. 収益化/解放の考え方（entitlements）
- `entitlements`: 権限キー（`messaging` / `footprints`）
- `user_entitlements`: ユーザー単位の付与（期限あり）
- `subscriptions`: サブスク状態

### B. ゲート条件（スパム対策）
- 「投稿2件以上」または「entitlement/subscriptionあり」で機能解放
- `can_send_message(uid)`
- `can_view_footprints(uid)`

### C. DM許可判定（最重要）
- `can_dm(sender, recipient)`
	- ブロックされていない
	- 送信者が `can_send_message` を満たす
	- 受信者が `allow_dm = true`
- `dm_scope`
	- `any`
	- `shared_offering`（共通offeringが1以上）
	- `connections`（友達承認済みのみ）

### D. データモデル
- `conversations`: directのみ（`direct_key = small_uid:large_uid` で決定的）
- `conversation_members`: 参加者（`last_read_at` あり）
- `messages`: 本文（`deleted_at` あり）

### E. 会話作成はRPCのみ
- `create_direct_conversation(other_user_id)`
	- `can_dm` 通過後、既存 `direct_key` を探索し、なければ作成
	- `members` に2人を insert

## RLS設計（ざっくり）

### マスタ系（universities / terms / courses / offerings / slots）
- `SELECT`: 全員可
- `INSERT`: `authenticated` が投稿（`created_by = auth.uid` など）
- `UPDATE / DELETE`: adminのみ（`is_admin`）

### 個人データ系（profiles / user_stats / enrollments）
- `profiles`: authユーザーのみ閲覧、本人のみ更新
- `user_stats`: authユーザーは閲覧可（UI用）
- `enrollments`: 本人のみ閲覧/更新（プライバシー要件の中核）

### コンテンツ系（notes / reviews）
- `notes`
	- `select`: `can_view_note()` で可視性制御（`public` / `author` / `same-university`）
	- `insert`: author本人かつ `offering` を `enrolled/planned`
	- `update/delete`: authorのみ
- `reviews`
	- `select`: 同大学またはauthor
	- `insert`: `enrolled/planned`
	- `update`: authorのみ

### 安全/管理系
- `blocks`: 本人が管理
- `reports`: insertはユーザー、selectはadminのみ
- `footprints`: insertはviewer、selectはviewed本人かつ解放済み

## 典型フロー
1. シラバス検索 → `courses / course_offerings` を作成 or 既存を選択
2. 追加ボタン → `enrollments` に `(user_id, offering_id, status=enrolled/planned)`
3. マッチング → `find_match_candidates()`（履修の中身は漏れない）
4. ノート投稿 → `notes`（`offering_id` 紐付けでクラス誤爆防止）
5. 質問投稿 → `questions`（`offering_id` 紐付け）
6. DM → `create_direct_conversation()` → `messages` insert（`can_send_message` でゲート）
