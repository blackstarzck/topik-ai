-- down: drop the institution-code membership RPCs (assign / clear / list members).
drop function if exists public.admin_assign_institution_code(uuid[], text, text);
drop function if exists public.admin_clear_institution_code(uuid[], text);
drop function if exists public.admin_list_institution_code_members(text, text);
