select c.relname as table_name, t.tgname as trigger_name,
       pg_get_triggerdef(t.oid) as def
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal
and (c.relname like 'topik_writing%' or c.relname like 'notification%' or c.relname='user_notifications')
order by c.relname, t.tgname;
