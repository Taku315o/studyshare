**データモデル**

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
