select conrelid::regclass::text as table_name, conname, contype,
       pg_get_constraintdef(oid) as def
from pg_constraint
where connamespace='public'::regnamespace
and conrelid::regclass::text ~ '^(public\.)?(topik_writing|notification|user_notifications)'
order by conrelid::regclass::text, contype, conname;
