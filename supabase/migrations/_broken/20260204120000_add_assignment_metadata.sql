alter table public.assignments
  add column if not exists university text,
  add column if not exists faculty text,
  add column if not exists department text,
  add column if not exists course_name text,
  add column if not exists teacher_name text;
