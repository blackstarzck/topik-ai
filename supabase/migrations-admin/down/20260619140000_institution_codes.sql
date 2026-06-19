-- down: drop institution code catalog RPCs + table.
drop function if exists public.admin_update_institution_code(text, text, text, text, text, text);
drop function if exists public.admin_create_institution_code(text, text, text, text);
drop function if exists public.admin_list_institution_codes(text, text);
drop table if exists public.institution_codes;
