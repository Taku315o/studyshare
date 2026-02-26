select m.id, m.conversation_id, m.sender_id, m.body, m.created_at
from public.messages m
where m.conversation_id = '3d24654f-61bb-4954-86ac-1c450ca97ee8'
order by m.created_at desc;
