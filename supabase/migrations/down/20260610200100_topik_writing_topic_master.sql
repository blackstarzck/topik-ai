-- down: 0001 topik_writing_topic_master 완전 제거 (additive 신규 오브젝트이므로 DROP으로 완전 복귀)
drop table if exists public.topik_writing_topic_master cascade;
