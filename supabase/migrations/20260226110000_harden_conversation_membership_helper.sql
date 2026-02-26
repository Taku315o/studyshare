-- Harden conversation membership helper used by messaging RLS.
-- Prevents arbitrary (_uid, _conversation_id) probes via direct RPC calls.

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

-- Keep the old helper for compatibility during rollout, but block direct client execution.
revoke all on function public.is_conversation_member(uuid, uuid) from public;
revoke all on function public.is_conversation_member(uuid, uuid) from anon;
revoke all on function public.is_conversation_member(uuid, uuid) from authenticated;
