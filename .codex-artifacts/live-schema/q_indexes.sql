select tablename, indexname, indexdef
from pg_indexes
where schemaname='public'
and (tablename like 'topik_writing%' or tablename like 'notification%' or tablename='user_notifications')
order by tablename, indexname;
