-- Fix infinite recursion in thread insert policies.
-- Root cause:
--   note_comments / question_answers INSERT policies queried their own relations.
--   That can re-trigger RLS evaluation recursively (42P17).

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

revoke all on function public.is_valid_note_comment_parent(uuid, uuid) from public;
revoke all on function public.is_valid_note_comment_parent(uuid, uuid) from anon;
revoke all on function public.is_valid_note_comment_parent(uuid, uuid) from authenticated;
grant execute on function public.is_valid_note_comment_parent(uuid, uuid) to authenticated;

revoke all on function public.is_valid_question_answer_parent(uuid, uuid) from public;
revoke all on function public.is_valid_question_answer_parent(uuid, uuid) from anon;
revoke all on function public.is_valid_question_answer_parent(uuid, uuid) from authenticated;
grant execute on function public.is_valid_question_answer_parent(uuid, uuid) to authenticated;

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
