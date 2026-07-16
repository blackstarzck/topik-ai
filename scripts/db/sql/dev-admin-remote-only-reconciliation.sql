do $$
begin
  if not exists (
    select 1
    from public.admin_schema_migrations
    where name = '20260713140000_admin_learning_analytics_dual_id_coverage.sql'
  ) then
    raise exception 'expected superseded dev migration history is missing';
  end if;
end
$$;

update public.admin_schema_migrations
set checksum_sha256 = '14e0d0d72733cd4f751b7ac902d4159a4914bb4f54210eb33dd37cf6cb48649c',
    apply_mode = 'superseded-remote-only',
    batch_id = 'adopt-untracked',
    applied_by = coalesce(applied_by, 'codex')
where name = '20260713140000_admin_learning_analytics_dual_id_coverage.sql'
  and checksum_sha256 is null;
