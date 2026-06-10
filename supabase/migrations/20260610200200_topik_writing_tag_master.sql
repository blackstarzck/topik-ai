-- =====================================================================
-- topik-ai admin · 메타데이터·태그 스키마 전환 P1 · 0002
-- topik_writing_tag_master: 태그 값 사전 (v0.8 §7.6 + §2.2 시드)
--
-- 시드 범위(D-6/E3): 추천사용/대표문제/추천목적/반복방지/학습흐름/운영주의 그룹.
-- '서비스_노출상태' 그룹은 제외한다 — service_status 컬럼이 유일한 물리 노출 상태이며
-- 태그로 이중 기록하지 않는다(결정 기록 D-6). 운영주의 그룹에 '운영 제외' 값 추가(E3).
-- down: supabase/migrations/down/20260610200200_topik_writing_tag_master.sql
-- =====================================================================

create table if not exists public.topik_writing_tag_master (
  tag_code            text primary key,
  tag_name_ko         text not null,
  tag_group           text not null,
  description         text not null,
  usage_rule          text,
  example_question_id text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz
);

comment on table public.topik_writing_tag_master is
  'TOPIK 쓰기 태그 값 사전 (v0.8 §7.6). 서비스_노출상태 그룹은 시드 제외(D-6: service_status 컬럼과 이중 기록 방지).';

insert into public.topik_writing_tag_master (tag_code, tag_name_ko, tag_group, description, usage_rule)
values
  -- 추천_사용상태 (v0.8 §2.2)
  ('rec_use',                '추천 사용',       '추천사용', '추천 엔진에서 사용할 수 있는 문제.', '검수 완료 + 노출 가능 문항 중 추천 후보로 쓸 문제에 부여한다.'),
  ('rec_exclude',            '추천 제외',       '추천사용', '추천 엔진에서 제외하는 문제.', '품질·중복·운영 사유로 추천 후보에서 빼야 할 때 부여한다.'),
  ('rec_wrong_answer_only',  '오답 추천만 사용', '추천사용', '오답 후 추천 상황에서만 사용하는 문제.', '일반 추천에는 부적합하지만 오답 보강용으로 유효할 때 부여한다.'),
  -- 대표문제_여부
  ('representative_question','대표 문제',       '대표문제', '해당 유형을 대표하는 좋은 문제.', '유형 첫 노출·예시 노출 우선순위가 필요한 문제에 부여한다.'),
  ('general_question',       '일반 문제',       '대표문제', '대표 문제가 아닌 일반 문제.', '기본값 성격의 값으로, 명시적 구분이 필요할 때만 부여한다.'),
  -- 추천목적_태그
  ('rec_first_entry',        '첫 진입용',       '추천목적', '처음 진입한 학습자에게 적합한 문제.', '난이도가 낮고 상황이 보편적인 문제에 부여한다.'),
  ('rec_wrong_answer_retry', '오답 후 추천',    '추천목적', '오답 이후 보강 추천에 적합한 문제.', '같은 기능을 다른 상황으로 연습시키고 싶을 때 부여한다.'),
  ('rec_review_use',         '복습용',          '추천목적', '복습 추천에 적합한 문제.', '학습 후 일정 기간 뒤 재노출할 가치가 있는 문제에 부여한다.'),
  ('rec_advanced_use',       '심화용',          '추천목적', '심화 단계 추천에 적합한 문제.', '난이도 상위 또는 복합 기능 문제에 부여한다.'),
  -- 반복방지_태그
  ('avoid_same_situation',   '같은상황주의',    '반복방지', '비슷한 상황 문제의 연속 노출을 피해야 하는 문제.', '동일 시나리오(예: 상담 시간 변경)가 많은 풀에서 부여한다.'),
  ('avoid_same_answer',      '같은정답주의',    '반복방지', '비슷한 정답 표현의 연속 노출을 피해야 하는 문제.', '대표 정답 표현이 겹치는 문제군에 부여한다.'),
  ('avoid_same_data_type',   '같은자료형주의',  '반복방지', '같은 자료 유형의 연속 노출을 피해야 하는 문제.', '53번 등 자료 기반 문항에서 같은 차트 유형 연속 노출을 막을 때 부여한다.'),
  -- 학습흐름_태그
  ('flow_basic_check',       '기초 확인',       '학습흐름', '기초 확인 단계에 적합한 문제.', '학습 흐름의 진입 단계 문제에 부여한다.'),
  ('flow_same_function',     '같은 기능 반복',  '학습흐름', '같은 기능을 반복 연습시키는 문제.', '직전 학습 기능을 반복 강화할 때 부여한다.'),
  ('flow_next_step',         '다음 단계',       '학습흐름', '다음 단계 진행에 적합한 문제.', '학습 흐름상 한 단계 위 난이도/기능으로 넘어갈 때 부여한다.'),
  -- 운영주의_태그 (D-6 노출 제외 기준과 연동, E3: '운영 제외' 추가)
  ('ops_needs_review',       '검수 필요',       '운영주의', '내용 재검수가 필요한 문제.', '노출 제외 기준 ②: 이 태그가 활성인 문항의 available 전환은 사유 입력이 필수다. 해소 전 노출을 권하지 않는다.'),
  ('ops_expression_caution', '표현 주의',       '운영주의', '표현·어감에 주의가 필요한 문제.', '노출 제외 기준 ②: 이 태그가 활성인 문항의 available 전환은 사유 입력이 필수다.'),
  ('ops_difficulty_ambiguous','난이도 애매',    '운영주의', '난이도 판정이 애매한 문제.', '난이도 재산정 대상. available 전환 시 사유를 남긴다.'),
  ('ops_operation_excluded', '운영 제외',       '운영주의', '운영상 영구 제외로 결정한 문제(E3).', 'service_status=excluded와 함께 부여해 "일시 제외"와 "운영 제외"를 구분한다(D-6). 중복 과다 문항의 excluded 권고(노출 제외 기준 ③)에도 사용한다.')
on conflict (tag_code) do nothing;
