select t.table_name, t.table_type,
       (select count(*) from information_schema.columns col where col.table_schema='public' and col.table_name=t.table_name) as ncols
from information_schema.tables t
where t.table_schema='public'
order by t.table_type, t.table_name;
