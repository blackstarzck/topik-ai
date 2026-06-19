select table_name, view_definition
from information_schema.views
where table_schema='public' and table_name like 'topik_writing%';
