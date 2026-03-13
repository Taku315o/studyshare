-- Add unlimited threading to note comments and introduce question answers.

alter table public.note_comments
  add column if not exists parent_comment_id uuid references public.note_comments(id) on delete cascade;

create index if not exists note_comments_note_created_asc_idx
  on public.note_comments(note_id, created_at asc);

create index if not exists note_comments_parent_created_asc_idx
  on public.note_comments(parent_comment_id, created_at asc);

create or replace function public.is_valid_note_comment_parent(_note_id uuid, _parent_comment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _parent_comment_id is null
    or exists (
      select 1
      from public.note_comments parent
      where parent.id = _parent_comment_id
        and parent.note_id = _note_id
    );
$$;

revoke all on function public.is_valid_note_comment_parent(uuid, uuid) from public;
revoke all on function public.is_valid_note_comment_parent(uuid, uuid) from anon;
revoke all on function public.is_valid_note_comment_parent(uuid, uuid) from authenticated;
grant execute on function public.is_valid_note_comment_parent(uuid, uuid) to authenticated;

drop policy if exists note_comments_insert_self on public.note_comments;
create policy note_comments_insert_self on public.note_comments
for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.notes n
    where n.id = note_comments.note_id
      and public.can_view_note(auth.uid(), n)
  )
  and public.is_valid_note_comment_parent(note_comments.note_id, note_comments.parent_comment_id)
);

create table if not exists public.question_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  parent_answer_id uuid null references public.question_answers(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists question_answers_question_created_asc_idx
  on public.question_answers(question_id, created_at asc);

create index if not exists question_answers_parent_created_asc_idx
  on public.question_answers(parent_answer_id, created_at asc);

alter table public.question_answers enable row level security;

create or replace function public.is_valid_question_answer_parent(_question_id uuid, _parent_answer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _parent_answer_id is null
    or exists (
      select 1
      from public.question_answers parent
      where parent.id = _parent_answer_id
        and parent.question_id = _question_id
    );
$$;

revoke all on function public.is_valid_question_answer_parent(uuid, uuid) from public;
revoke all on function public.is_valid_question_answer_parent(uuid, uuid) from anon;
revoke all on function public.is_valid_question_answer_parent(uuid, uuid) from authenticated;
grant execute on function public.is_valid_question_answer_parent(uuid, uuid) to authenticated;

drop policy if exists question_answers_select_same_scope on public.question_answers;
create policy question_answers_select_same_scope on public.question_answers
for select to authenticated
using (
  exists (
    select 1
    from public.questions q
    where q.id = question_answers.question_id
      and public.can_view_question(auth.uid(), q)
  )
);

drop policy if exists question_answers_insert_self on public.question_answers;
create policy question_answers_insert_self on public.question_answers
for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.questions q
    where q.id = question_answers.question_id
      and public.can_view_question(auth.uid(), q)
  )
  and public.is_valid_question_answer_parent(question_answers.question_id, question_answers.parent_answer_id)
);

drop policy if exists question_answers_update_self on public.question_answers;
create policy question_answers_update_self on public.question_answers
for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());
