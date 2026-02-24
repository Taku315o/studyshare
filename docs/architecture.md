**アーキテクチャ**

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
- `profiles` の `display_name` / `university_id` / `grade_year` を `upsert` で更新
- 授業詳細（`/offerings/[offeringId]`）はUI上で「ノート/口コミ/質問は同大学スコープ表示」の説明を出す

- 初回オンボーディング（`/onboarding`）
- frontend(Client Component) → Supabase SELECT（`profiles` / `universities`）
- `profiles.university_id` / `grade_year` が未設定の認証済みユーザーに入力を要求し、保存後に元ページへ戻す

**認証フロー**
- OAuth → `auth/callback` でセッション確立 → `AuthContext` で状態配布
- `AppRouteGuard` が認証済みユーザーの `profiles.university_id` / `grade_year` を確認し、未設定なら `/onboarding` へリダイレクト
- backend へは Bearer JWT を付与
- backend は Supabase Auth でトークン検証し、`users` から role を取得

**主要APIと責務境界**
- `POST /api/upload` 画像アップロード（認証必須）
- `POST /api/assignments` 課題投稿（認証必須 + バリデーション）
- `GET /api/assignments/search` 検索
- `DELETE /api/assignments/:id` 課題削除（管理者のみ）
- `GET /profile` は互換リダイレクトとして `/me` へ転送
- `GET /timetable` はAPI経由ではなく、フロントからSupabaseを直接参照（RLS前提）
- `GET /community` はAPI経由ではなく、フロントからSupabaseを直接参照（RLS前提）
- `GET /me` はAPI経由ではなく、フロントからSupabaseを直接参照（RLS前提）

**前提/依存**
- Supabase RPC: `search_assignments`, `search_assignments_filtered`
- Supabase RPC: `find_match_candidates`, `create_direct_conversation`
- Storage bucket: `assignments`
