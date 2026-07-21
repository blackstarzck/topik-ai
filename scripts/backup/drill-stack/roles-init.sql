-- 내부 서비스 롤 비밀번호를 POSTGRES_PASSWORD와 일치시킨다.
-- 이미지 버전에 따라 없는 롤이 있으므로 존재하는 롤만 조건부로 처리한다
-- (실패 시 initdb 전체가 exit 3으로 중단되기 때문).
\set pgpass `echo "$POSTGRES_PASSWORD"`
select set_config('drill.pgpass', :'pgpass', false);
do $$
declare r text;
begin
  foreach r in array array['authenticator','pgbouncer','supabase_auth_admin','supabase_functions_admin','supabase_storage_admin'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('alter role %I with login password %L', r, current_setting('drill.pgpass'));
    end if;
  end loop;
end $$;
