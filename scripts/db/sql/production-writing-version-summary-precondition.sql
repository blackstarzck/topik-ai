select (
  (select count(*) from public.topik_writing_schema_migrations) = 31
  and to_regclass('public.topik_writing_question_source_map') is not null
  and to_regclass('public.topik_writing_question_import') is not null
  and to_regclass('public.topik_writing_question_version_summary_view') is null
) as ok;
