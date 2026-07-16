-- 관리자 문항 목록용 현재 버전 포인터·승격 이력 요약.
-- raw/held/mapped 인박스 행은 문항관리 이력에서 제외하고 인박스에서만 확인한다.
create or replace view public.topik_writing_question_version_summary_view
with (security_invoker = true) as
select
  source_map.question_id,
  source_map.canonical_import_id,
  count(question_import.import_id)::bigint as version_count,
  greatest(count(question_import.import_id) - 1, 0)::bigint as revision_count
from public.topik_writing_question_source_map as source_map
left join public.topik_writing_question_import as question_import
  on question_import.promoted_question_id = source_map.question_id
 and question_import.mapping_status = 'promoted'
group by source_map.question_id, source_map.canonical_import_id;

comment on view public.topik_writing_question_version_summary_view is
  '관리자 문항 버전 요약. canonical_import_id가 현재 정식 버전의 유일한 포인터이며 version_count/revision_count는 promoted 버전만 집계한다.';

revoke all on public.topik_writing_question_version_summary_view from public;
revoke all on public.topik_writing_question_version_summary_view from anon;
grant select on public.topik_writing_question_version_summary_view to authenticated;
