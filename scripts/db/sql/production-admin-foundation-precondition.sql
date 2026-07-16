select (
  (select count(*) from public.admin_schema_migrations) = 8
  and (select count(*) from public.topik_writing_schema_migrations) = 32
  and (select count(*) from public.profiles where app_role <> 'learner') = 0
  and not exists (
    select 1
    from public.admin_audit_logs audit
    left join auth.users auth_user on auth_user.id = audit.admin_user_id
    where auth_user.id is null
  )
  and to_regclass('public.topik_writing_question_source_map') is not null
  and to_regclass('public.topik_writing_question_import') is not null
  and to_regclass('public.topik_writing_problem_question_map') is not null
  and to_regprocedure('private.ensure_writing_problem_identity(uuid,text,smallint)') is not null
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'topik_writing_question_source_map'
      and column_name = 'learner_problem_id'
  )
) as ok;
