-- Messaging refinements:
-- - Remove shared_offering/connections scope from DM gating (profile DM allowed)
-- - Exempt first-year students from the messaging unlock gate
-- - Allow replies in an existing direct conversation even if sender is not unlocked
-- - Replace recursive conversation-membership policy checks with helper functions

create or replace function public.can_send_message(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select p.grade_year from public.profiles p where p.user_id = _uid), 0) = 1
    or coalesce((select us.contributions_count from public.user_stats us where us.user_id = _uid), 0) >= 2
    or public.has_active_entitlement(_uid, 'messaging');
$$;

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

create or replace function public.is_conversation_member(_uid uuid, _conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = _conversation_id
      and m.user_id = _uid
  );
$$;

create or replace function public.is_current_conversation_member(_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and _conversation_id is not null
    and exists (
      select 1
      from public.conversation_members m
      where m.conversation_id = _conversation_id
        and m.user_id = auth.uid()
    );
$$;

revoke all on function public.is_conversation_member(uuid, uuid) from public;
revoke all on function public.is_conversation_member(uuid, uuid) from anon;
revoke all on function public.is_conversation_member(uuid, uuid) from authenticated;

revoke all on function public.is_current_conversation_member(uuid) from public;
revoke all on function public.is_current_conversation_member(uuid) from anon;
revoke all on function public.is_current_conversation_member(uuid) from authenticated;
grant execute on function public.is_current_conversation_member(uuid) to authenticated;

drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations
for select to authenticated
using (
  public.is_current_conversation_member(conversations.id)
);

drop policy if exists conversation_members_select_member on public.conversation_members;
create policy conversation_members_select_member on public.conversation_members
for select to authenticated
using (
  public.is_current_conversation_member(conversation_members.conversation_id)
);

drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages
for select to authenticated
using (
  public.is_current_conversation_member(messages.conversation_id)
);

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_current_conversation_member(messages.conversation_id)
  and public.can_send_message_in_conversation(auth.uid(), messages.conversation_id)
);
