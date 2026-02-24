select conversation_id, user_id, joined_at
from public.conversation_members
where conversation_id = '3d24654f-61bb-4954-86ac-1c450ca97ee8'
order by user_id;
