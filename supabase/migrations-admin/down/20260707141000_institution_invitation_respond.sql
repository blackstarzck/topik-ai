-- down: drop the institution invitation user-respond RPC.
drop function if exists public.respond_institution_invitation(uuid, boolean);
