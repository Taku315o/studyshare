**セキュリティ**

**認証**
- Supabase Auth（OAuth）でログイン
- frontendはセッションを保持し、JWTをbackendに付与
- backendはSupabase AuthでJWTを検証

**権限制御**
- `users` テーブルに `role` を保持（`student`/`admin`）
- `is_admin(uid)` で管理者判定
- role変更はトリガーで禁止（管理者のみ許可）
- RLSで `users` / `assignments` の操作範囲を制限

**ストレージ**
- `assignments` bucket
- 読み取り: 全員
- アップロード: 認証済みかつ owner = auth.uid()
- 削除: owner または admin
