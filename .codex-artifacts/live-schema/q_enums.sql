select t.typname as enum_name, e.enumlabel as label, e.enumsortorder
from pg_type t join pg_enum e on e.enumtypid=t.oid
join pg_namespace n on n.oid=t.typnamespace
where n.nspname='public'
order by t.typname, e.enumsortorder;
