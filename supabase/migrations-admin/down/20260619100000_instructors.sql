-- down: drop instructor admin RPCs + tables.
drop function if exists public.admin_delete_instructor_note(text, text);
drop function if exists public.admin_add_instructor_note(text, text, text);
drop function if exists public.admin_set_instructor_status(text, text, text);
drop function if exists public.admin_get_instructor(text);
drop function if exists public.admin_list_instructors(text, text, text, text, text);
drop table if exists public.instructor_admin_notes;
drop table if exists public.instructors;
