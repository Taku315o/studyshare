**アーキテクチャ**

**移行メモ（2026-02-25）**
- 旧 `assignments` ベースUIは現行本体フローから切り離し、frontend では `frontend/src/legacy/assignments/` に退避済み。
- `/(app)` の投稿導線から legacy `assignments` ルートへは遷移しない。
- `POST /api/notes/upload` は legacy `assignments` ルーター配下から分離し、upload 専用ルーターで提供する。

**構成**
- frontend: Next.js(App Router)で画面と認証状態を管理
- backend: Express + TypeScriptで投稿/削除/画像アップロードAPIを提供
- Supabase: Auth/DB/Storageを統合的に利用

**データフロー**
- 検索/一覧/詳細
- frontend → Supabase RPC/SELECT（`search_assignments` / `search_assignments_filtered` / `assignments`）
- 投稿/管理者削除/アップロード
- frontend → backend API → Supabase（DB/Storage）
- マイページでの本人削除
- frontend → Supabase DELETE（RLSで `auth.uid() = user_id` を強制）
- 時間割表示（`/timetable`）
- frontend(Client Component) → Supabase SELECT（`enrollments` + `course_offerings` + `courses` + `offering_slots`）
- 表示対象は `status in ('enrolled','planned')` がデフォルト。`dropped` はUIトグルで表示
- コミュニティ表示（`/community`）
- frontend(Client Component) → Supabase RPC/SELECT（`find_match_candidates` / `conversation_members` / `messages` / `profiles`）
- DM開始は `create_direct_conversation` RPC を利用し、RLS/関数制約で失敗時はローカルstate会話へフォールバック（非永続）
- DM送信前に `auth.getUser()` で実セッションを再確認し、画面状態の `currentUserId` と不一致なら送信を中断して再ログイン/再読込を促す（同一ブラウザでのアカウント切替対策）
- Messaging系RLSは `conversation_members` policyの自己参照で再帰エラーにならないよう、メンバー判定helper関数経由で実装する
- マイページ表示（`/me`）
- frontend(Client Component) → Supabase SELECT（`profiles` / `universities` / `notes` / `reviews` / `enrollments` + 関連 `course_offerings`/`courses`/`terms`/`offering_slots`）
- 取得対象は `auth.getUser()` の `user.id` に限定し、RLSで本人データのみ参照
- `profiles` の `display_name` / `university_id` / `grade_year` / `faculty` / `avatar_url` を `upsert` で更新
- アバター画像は backend `POST /api/profiles/avatar/upload` でアップロードしてから `avatar_url` に反映
- アバター更新時は旧 `avatar_url` から同ユーザー配下の storage path を解決し、backend 側で旧オブジェクトを削除する
- プロフィール更新入力は `frontend/src/lib/validation/profile.ts` の `zod` schemaで検証（学年 `1..6`）
- `ProfileCard` モーダルは外クリックで閉じるが、保存中は閉じない
- 授業詳細（`/offerings/[offeringId]`）はUI上で「ノート/口コミ/質問は同大学スコープ表示」の説明を出す

- 初回オンボーディング（`/onboarding`）
- frontend(Client Component) → Supabase SELECT（`profiles` / `universities`）
- `profiles.university_id` / `grade_year` が未設定の認証済みユーザーに入力を要求し、保存後に元ページへ戻す
- オンボーディングの大学/学年入力は `zod` schemaで検証し、学年は `1..6` で統一
- `faculty` は任意項目として同じ保存導線で更新可能

**認証フロー**
- OAuth → `auth/callback` でセッション確立 → `AuthContext` で状態配布
- `AppRouteGuard` が認証済みユーザーの `profiles.university_id` / `grade_year` を確認し、未設定なら `/onboarding` へリダイレクト
- backend へは Bearer JWT を付与
- backend は Supabase Auth でトークン検証し、`auth.users`（JWT由来）を基準に `req.user` を構築する
- legacy 互換のため `users` テーブル参照は「存在する環境のみ上書き」にしており、不在でも認証は継続する

**主要APIと責務境界**
- `POST /api/upload` 画像アップロード（認証必須）
- `POST /api/notes/upload` ノート画像アップロード（認証必須）
- `POST /api/profiles/avatar/upload` プロフィールアバター画像アップロード（認証必須）
- `POST /api/assignments` 課題投稿（認証必須 + バリデーション）
- `GET /api/assignments/search` 検索
- `DELETE /api/assignments/:id` 課題削除（管理者のみ）
- `GET /profile` は互換リダイレクトとして `/me` へ転送
- `GET /timetable` はAPI経由ではなく、フロントからSupabaseを直接参照（RLS前提）
- `GET /community` はAPI経由ではなく、フロントからSupabaseを直接参照（RLS前提）
- `GET /me` はAPI経由ではなく、フロントからSupabaseを直接参照（RLS前提）
- `assignments` 系APIは legacy 互換のため backend に残存しているが、現行本体機能（授業詳細のノート/口コミ/質問）とは責務を分離して扱う

**前提/依存**
- Supabase RPC: `search_assignments`, `search_assignments_filtered`
- Supabase RPC: `find_match_candidates`, `create_direct_conversation`
- Storage bucket: `notes`（現行ノート画像アップロード）
- Storage bucket: `avatars`（プロフィールアバター画像アップロード）
- Storage bucket: `assignments`（legacy 互換）
