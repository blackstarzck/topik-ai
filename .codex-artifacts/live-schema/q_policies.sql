select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public'
and (tablename like 'topik_writing%' or tablename like 'notification%' or tablename in ('user_notifications'))
order by tablename, policyname;
