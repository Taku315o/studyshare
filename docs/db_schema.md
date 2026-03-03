# StudyShare schema v1（Supabase/Postgres）

## 実装メモ（2026-02-25）
- 現行のノート画像添付は frontend から backend `POST /api/notes/upload` を呼び出し、Supabase Storage に保存して公開URLを `notes.image_url` に保存する構成。
- プロフィールのアバター画像は frontend から backend `POST /api/profiles/avatar/upload` を呼び出し、公開URLを `profiles.avatar_url` に保存する構成。
- アバター画像更新時は、同ユーザー配下の旧オブジェクト（`avatars/{userId}/...`）を backend 側で削除する。
- backend の upload エンドポイントは `assignments` ルーターから分離済み（`uploads` ルーター）。
- 旧 `assignments` 機能は frontend 本体導線から切り離し済みだが、backend には legacy 互換として一部残存。
- Storage bucket は少なくとも `notes`（現行ノート画像）、`avatars`（プロフィール画像）、`assignments`（legacy互換）を用意する前提。
- bucket 未作成時は backend ログに `Bucket not found` が出るため、Storage bucket 作成 migration の適用を確認すること。

## このDBが解いている問題（設計の核）
- 「授業（Course）」と「その学期の実体（Offering）」と「自分の時間割（Enrollment）」を分離し、誤マッチやUX破綻を防ぐ。
- ノート/レビューは「授業名」ではなく `Offering` に紐づけ、同名別クラス問題を防止する。
- マッチングは「他人の履修情報を直接見せない」方針で、集計結果のみ返す安全設計にする。

## 主要概念（3層モデル + Enrollment）

### A. University（大学）
- `universities`: 大学マスタ（`name` は一意）

### B. Term（学期）
- `terms`: `(university_id, year, season)` が一意
- 例: 専修大学 2026 first_half（前期）

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
	- `university_id`, `display_name`, `faculty`, `avatar_url`, `handle`, `dm_scope`, `allow_dm` など
	- `enrollment_visibility_default`: 履修登録時の初期公開範囲（`private` / `match_only` / `public`）
- `user_stats`: 投稿数を保持（`notes_count` / `reviews_count`）
	- `contributions_count` は generated（`notes + reviews`）
	- ノート/レビューの INSERT・soft-delete をトリガーに更新

## コンテンツ（ノート・レビュー）

### A. Notes
- `notes`: `offering_id` に紐づく（授業実体単位）
- `image_url`: ノート画像添付の公開URL（backend upload API 経由で生成）
- `visibility`: `public` / `university` / `offering_only` / `private`
- `search_tsv`: `title` / `body` / `tags` を tsvector 化（`unaccent + simple`）
- `deleted_at` によるソフトデリート
- 関連テーブル
	- `note_assets`: 添付（`storage_path`）
	- `note_reactions`: リアクション（PK: `note_id, user_id, kind`）
	- `note_comments`: コメント（`deleted_at` あり、`parent_comment_id` で無制限ツリー）

### B. Reviews（ラク単想定）
- `reviews`: `offering_id` に紐づく（授業実体単位）
- `rating (1..5)` + `difficulty` / `content` / `attendance` / `grading` + `comment`
- `deleted_at` によるソフトデリート
- 「同一ユーザー × 同一offeringは1件のみ（`deleted_at is null` の間）」をユニーク制約で保証

### C. Questions
- `questions`: `offering_id` に紐づく質問
- カラム: `title`, `body`, `author_id`, `created_at`, `updated_at`, `deleted_at`
- `question_answers`: 質問への回答（`parent_answer_id` で無制限ツリー、`deleted_at` あり）
- RLS:
	- `select`: `can_view_question()`（同大学 or author）
	- `insert`: `author_id = auth.uid()` かつ `is_enrolled(auth.uid(), offering_id)`
	- `update/delete`: author のみ
	- `question_answers`:
		- `select`: 回答先の `questions` が `can_view_question()` を満たす場合のみ
		- `insert`: `author_id = auth.uid()` かつ回答先質問を閲覧可能な場合
		- `update`: author のみ（soft-delete含む）

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

### UI実装メモ（community）
- `/community` は `find_match_candidates()` を利用して候補表示する（共有件数のみ）。
- `conversations` / `conversation_members` / `messages` を使って会話を表示・送信する。
- `create_direct_conversation()` が `can_dm` 制約で失敗した場合、MVPではローカル会話（非永続）にフォールバックする。
- 本実装でも `enrollments` の他者生データは参照しない。

## DM（権限ゲーティング込み）

### A. 収益化/解放の考え方（entitlements）
- `entitlements`: 権限キー（`messaging` / `footprints`）
- `user_entitlements`: ユーザー単位の付与（期限あり）
- `subscriptions`: サブスク状態

### B. ゲート条件（スパム対策）
- 基本は「投稿2件以上」または「entitlement/subscriptionあり」で機能解放
- ただし **一年生（`profiles.grade_year = 1`）はDM制約を免除**（MVP例外）
- `can_send_message(uid)`
- `can_view_footprints(uid)`

### C. DM許可判定（最重要）
- `can_dm(sender, recipient)`
	- ブロックされていない
	- 送信者が `can_send_message` を満たす
	- 受信者が `allow_dm = true`
- MVPでは **共通授業(`shared_offering`)はDM制約に使わない**
	- マッチング表示のための概念としては維持
	- プロフィール/口コミ/掲示板経由で任意ユーザーへDM開始できる設計
- 返信例外（MVP）
	- 相手から先に届いたDMがある既存会話では、送信者が未解放でも返信可（ローカルDMに落とさない）
- `dm_scope`
	- スキーマ上は保持（将来の再導入用）
	- MVPでは `can_dm` 判定では実質未使用（`allow_dm` を優先）

### D. データモデル
- `conversations`: directのみ（`direct_key = small_uid:large_uid` で決定的）
- `conversation_members`: 参加者（`last_read_at` あり）
- `messages`: 本文（`deleted_at` あり）

### E. 会話作成はRPCのみ
- `create_direct_conversation(other_user_id)`
	- `can_dm` 通過後、既存 `direct_key` を探索し、なければ作成
	- `members` に2人を insert
- `messages` insert（RLS）
	- 通常送信: `can_send_message`
	- 返信送信: 既存会話に相手メッセージがあれば未解放でも許可（MVP）
- `conversation_members` / `messages` / `conversations` のRLS注意点
	- `conversation_members` のpolicy内で `conversation_members` を直接 `exists(...)` 再参照すると、RLS評価の自己再帰で `42P17 (infinite recursion)` が発生しうる
	- メンバー判定は `security definer` 関数（例: `is_conversation_member(uid, conversation_id)`）経由に寄せる

## RLS設計（ざっくり）

### マスタ系（universities / terms / courses / offerings / slots）
- `SELECT`: 全員可
- `INSERT`: `authenticated` が投稿（`created_by = auth.uid` など）
- `UPDATE / DELETE`: adminのみ（`is_admin`）

### 個人データ系（profiles / user_stats / enrollments）
- `profiles`: authユーザーのみ閲覧、本人のみ更新
- `user_stats`: authユーザーは閲覧可（UI用）
- `enrollments`: 本人のみ閲覧/更新（プライバシー要件の中核）

### コンテンツ系（notes / reviews / questions）
- `notes`
	- `select`: `can_view_note()` で可視性制御（`public` / `author` / `same-university`）
	- `insert`: author本人かつ `offering` を `enrolled/planned`
	- `update/delete`: authorのみ
	- `note_comments.insert`: `author_id = auth.uid()` かつ対象ノートを `can_view_note()` できる場合のみ
- `reviews`
	- `select`: 同大学またはauthor
	- `insert`: `enrolled/planned`
	- `update`: authorのみ
- `questions`
	- `select`: `can_view_question()`（同大学 or author）
	- `insert`: `is_enrolled(auth.uid(), offering_id)`
	- `update/delete`: authorのみ
- `question_answers`
	- `select`: 回答先質問が `can_view_question()` を満たす場合のみ
	- `insert`: 回答先質問を閲覧可能な認証ユーザー
	- `update`: authorのみ

### 安全/管理系
- `blocks`: 本人が管理
- `reports`: insertはユーザー、selectはadminのみ
- `footprints`: insertはviewer、selectはviewed本人かつ解放済み
- Messaging系RLSは `conversation_members` 自己参照による再帰を避ける（helper関数経由）

## 典型フロー
1. シラバス検索 → `courses / course_offerings` を作成 or 既存を選択
2. 追加ボタン → `enrollments` に `(user_id, offering_id, status=enrolled/planned)`
3. マッチング → `find_match_candidates()`（履修の中身は漏れない）
4. ノート投稿 → `notes`（`offering_id` 紐付けでクラス誤爆防止）
   - 画像添付あり: 先に backend `POST /api/notes/upload` で Storage へアップロードし、返却URLを `notes.image_url` に保存
5. 質問投稿 → `questions`（`offering_id` 紐付け）
6. DM → `create_direct_conversation()` → `messages` insert（開始は `can_dm`、返信は既存会話例外あり）
