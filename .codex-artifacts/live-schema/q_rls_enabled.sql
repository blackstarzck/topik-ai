select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
and (c.relname like 'topik_writing%' or c.relname like 'notification%' or c.relname='user_notifications')
order by c.relname;
