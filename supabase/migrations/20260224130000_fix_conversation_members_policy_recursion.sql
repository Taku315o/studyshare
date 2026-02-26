-- Fix infinite recursion in conversation_members RLS policies.
-- Root cause:
--   conversation_members SELECT policy queried public.conversation_members again,
--   which re-triggered the same policy recursively.
-- Impact:
--   - GET /conversation_members returns 500 (42P17)
--   - messages INSERT can also fail because its policy checks conversation membership

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

drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations
for select to authenticated
using (
  public.is_conversation_member(auth.uid(), conversations.id)
);

drop policy if exists conversation_members_select_member on public.conversation_members;
create policy conversation_members_select_member on public.conversation_members
for select to authenticated
using (
  public.is_conversation_member(auth.uid(), conversation_members.conversation_id)
);

drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages
for select to authenticated
using (
  public.is_conversation_member(auth.uid(), messages.conversation_id)
);

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_member(auth.uid(), messages.conversation_id)
  and public.can_send_message_in_conversation(auth.uid(), messages.conversation_id)
);
