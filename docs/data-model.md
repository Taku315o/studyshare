**データモデル**

**移行メモ（2026-02-25）**
- このページは旧 `assignments` 中心のデータモデルを主に記載している。
- 現行アプリの中心モデルは `profiles` / `notes` / `reviews` / `course_offerings` / `enrollments` など（詳細は `docs/db_schema.md` を優先参照）。
- `assignments` 関連は legacy 互換として backend に一部残存しているが、frontend 本体フローからは切り離している。

**主要テーブル**
- `users`
- `assignments`
- `universities`
- `faculties`
- `departments`

**主要カラム**
- `users`: `id`, `email`, `role`, `created_at`, `updated_at`
- `assignments`: `id`, `title`, `description`, `image_url`, `user_id`, `university`, `faculty`, `department`, `course_name`, `teacher_name`, `created_at`, `updated_at`
- `universities`: `id`, `name`, `created_at`
- `faculties`: `id`, `university_id`, `name`, `created_at`
- `departments`: `id`, `faculty_id`, `name`, `created_at`

**リレーション**
- `assignments.user_id` → `users.id`
- `faculties.university_id` → `universities.id`
- `departments.faculty_id` → `faculties.id`

**検索関数**
- `search_assignments(search_query text)`
- `search_assignments_filtered(search_query text, university_filter text, faculty_filter text, department_filter text)`

**開発用seedデータ注記**
- `backend/src/scripts/seed.ts` は開発環境向けに、専修大学中心（12件）+ 明治大学（4件）の課題データを投入する。
- seed投入時は `assignments.image_url` に Supabase Storage (`assignments` バケット) の公開URLを保存する。
- `universities` / `faculties` / `departments` は seed から明示的に upsert され、検索フィルタ検証に必要なマスタが空にならないようにしている。
