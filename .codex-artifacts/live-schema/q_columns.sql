select c.table_schema, c.table_name, c.ordinal_position, c.column_name,
       c.data_type, c.udt_name, c.is_nullable, c.column_default, c.character_maximum_length
from information_schema.columns c
where c.table_schema in ('public')
order by c.table_name, c.ordinal_position;
