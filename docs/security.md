**セキュリティ**

**認証**
- Supabase Auth（OAuth）でログイン
- frontendはセッションを保持し、JWTをbackendに付与
- backendはSupabase AuthでJWTを検証
- 認証後のアプリ導線では `profiles.university_id` / `grade_year` の初期設定を必須化（未設定時は `/onboarding` へ誘導）

**権限制御**
- `users` テーブルに `role` を保持（`student`/`admin`）
- `is_admin(uid)` で管理者判定
- role変更はトリガーで禁止（管理者のみ許可）
- RLSで `users` / `assignments` の操作範囲を制限
- `notes` / `reviews` / `questions` は「本人 or 同大学（`profiles.university_id` ベース）」の可視性制御を採用
- `profiles.university_id` 未設定ユーザーは、他ユーザーの授業系投稿（ノート/口コミ/質問）を閲覧できないため、UIで初期設定を必須化して整合を取る

**ストレージ**
- `assignments` bucket
- 読み取り: 全員
- アップロード: 認証済みかつ owner = auth.uid()
- 削除: owner または admin
