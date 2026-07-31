-- down: 20260624110000_sync_available_writing_problems.sql
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sync-writing-problems') then
    perform cron.unschedule('sync-writing-problems');
  end if;
exception
  when undefined_table or undefined_function or insufficient_privilege then null;
end $$;

drop function if exists public.sync_available_writing_problems();
