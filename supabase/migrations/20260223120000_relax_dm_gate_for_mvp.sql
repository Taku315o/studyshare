-- MVP DM policy changes:
-- - Remove shared_offering/connections scope from DM gating (profile DM allowed)
-- - Exempt first-year students from messaging unlock gate
-- - Allow replies in an existing direct conversation even if sender is not unlocked
-- このユーザーは、自分から能動的にメッセージを送る資格を持っているか？
create or replace function public.can_send_message(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select p.grade_year from public.profiles p where p.user_id = _uid), 0) = 1. -- allow first-year students to DM without unlocking
    or coalesce((select us.contributions_count from public.user_stats us where us.user_id = _uid), 0) >= 2 -- allow users with 2 or more contributions to DM without unlocking
    or public.has_active_entitlement(_uid, 'messaging'); --特別な権利(課金など)を持っているユーザーはDMが可能
$$;

-- 新規メッセージを送る資格があるか？返信なら誰でもOKだが、新規メッセージは上のcan_dmルールを適用する
create or replace function public.can_dm(_sender uuid, _recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select p.allow_dm
    from public.profiles p
    where p.user_id = _recipient
  )
  select
    _sender is not null
    and _recipient is not null
    and _sender <> _recipient
    and not public.is_blocked(_sender, _recipient)
    and public.can_send_message(_sender)
    and coalesce((select allow_dm from r), true) = true;
$$;

--この会話ルームの中で、メッセージを書き込んでもいいか？つまり、返信なら誰でも送れるようにするが、新規メッセージは上のcan_dmルールを適用する
create or replace function public.can_send_message_in_conversation(_uid uuid, _conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _uid is not null
    and _conversation_id is not null
    and exists (
      select 1
      from public.conversation_members m
      where m.conversation_id = _conversation_id
        and m.user_id = _uid
    )
    and (
      public.can_send_message(_uid)
      or exists (
        select 1
        from public.messages msg
        where msg.conversation_id = _conversation_id
          and msg.sender_id <> _uid
          and msg.deleted_at is null
      )
    );
$$;

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id
      and m.user_id = auth.uid()
  )
  and public.can_send_message_in_conversation(auth.uid(), messages.conversation_id)
);
