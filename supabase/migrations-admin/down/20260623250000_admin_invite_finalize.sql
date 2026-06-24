-- down: drop the admin invite finalizer RPC.
drop function if exists public.admin_finalize_invite(uuid, uuid, text, text, text, text[]);
