-- =====================================================================
-- topik-ai admin · 외부 API 문항 적재 P6 · 0001
-- topik_writing_question_import: 외부 공급 API(/api/writing/tasks 등) 응답을
--   무손실(lossless)·버전 보존으로 적재하는 인박스(staging) 테이블.
--
-- 배경(2026-06-22 오너 결정): ① 외부 API 응답 값은 "모두" Supabase에 기록되어야
--   사용자 제출 시 상류 API 재호출 없이 동작한다(상류 장애 비의존). ② 상류 팀이
--   아직 response 값을 전부 확정하지 못해 응답 형태가 불완전·가변이다.
--
-- 설계(GPT-5.5 공동검토 반영): §7 문항 테이블(topik_writing_5x_questions)은
--   NOT NULL/FK가 엄격해 불완전 응답을 받을 수 없다. 따라서 응답 원문을
--   raw_response_text(verbatim) + raw_payload(jsonb, 질의 편의)로 보관하는 별도
--   인박스를 둔다. 행은 여기 먼저 착지하고(무손실), 응답이 충분히 완성되면 §7로
--   승격(promote)한다. 동결된 4테이블 공통 컬럼 계약(§3.2-2)은 건드리지 않는다.
--
-- 버전 보존: 같은 source_task_id가 내용이 바뀐 채 다시 와도 덮어쓰지 않고 새
--   버전 행으로 보존한다(unique(source_task_id, payload_hash)). "모두 기록"이 시간
--   축으로도 성립하며, 상류가 응답을 점진적으로 보강해 재전송하는 상황을 흡수한다.
--   현재 버전은 is_latest=true 하나뿐이도록 RPC가 관리한다.
--
-- 쓰기: RLS 전면 차단 — service_role 또는 admin_ingest_writing_task RPC 단일 경로만
--   적재한다(브라우저 anon/auth 키는 INSERT 불가). 읽기: admin select(기본 grant 상속).
-- down: supabase/migrations/down/20260622160000_topik_writing_question_import.sql
-- =====================================================================

create table if not exists public.topik_writing_question_import (
  import_id            bigserial primary key,
  -- 상류 task.id — 멱등(idempotency) 기준 키. 누락 시 서버가 파생 id 부여(id_strategy).
  source_task_id       text not null,
  -- 적재 단위 원문(raw_response_text)의 md5. 버전 식별 + 변경 감지용.
  payload_hash         text not null,
  -- 파싱된 응답(jsonb) — 질의/매핑 편의. 모든 값 보존(중복 키 제외).
  raw_payload          jsonb not null,
  -- 응답 원문 텍스트(verbatim). 진짜 무손실 기록의 단일 진실 — jsonb 정규화 이전 원본.
  raw_response_text    text,
  -- 상류 응답에서 파생(task_type→51/52/53/54). 응답 미확정이라 nullable.
  item_number          smallint check (item_number is null or item_number in (51, 52, 53, 54)),
  -- 출처 엔드포인트(예: /api/writing/tasks). 다중 소스 추적용.
  source_endpoint      text,
  -- 같은 source_task_id의 여러 버전 중 현재 버전 표시(RPC가 단일 true 유지).
  is_latest            boolean not null default true,
  -- raw(원문만) | mapped(구조화 매핑 완료) | promoted(§7 적재됨) | held(승격 보류)
  mapping_status       text not null default 'raw'
                       check (mapping_status in ('raw', 'mapped', 'promoted', 'held')),
  -- 승격 보류 사유(필수 칸 부재·주제 미해소·난이도 범위초과 등). NULL이면 보류 아님.
  hold_reason          text,
  -- §7 승격 후 할당된 question_id(topik-writing-5x-NNNN). 단일 FK 불가(4테이블)라 text.
  promoted_question_id text,
  first_seen_at        timestamptz not null default now(),
  last_seen_at         timestamptz not null default now(),
  -- 동일 (task,버전) 재수신 횟수.
  ingest_count         integer not null default 1,
  -- 같은 내용(해시) 재수신은 새 행이 아니라 last_seen/ingest_count만 갱신.
  constraint topik_writing_question_import_version_uniq
    unique (source_task_id, payload_hash)
);

comment on table public.topik_writing_question_import is
  '외부 공급 API 응답 무손실·버전보존 인박스(P6, 2026-06-22, GPT-5.5 공동검토). raw_response_text=원문 verbatim, raw_payload=파싱본. 변경 재전송은 새 버전으로 보존(unique source_task_id+payload_hash), is_latest가 현재본. 충분히 완성되면 §7로 승격. 쓰기는 service_role/RPC 단일 경로.';
comment on column public.topik_writing_question_import.raw_response_text is
  '외부 API 응답 적재 단위 원문 텍스트(verbatim). jsonb 정규화(키정렬·공백·중복키) 이전의 무손실 기록.';
comment on column public.topik_writing_question_import.is_latest is
  '같은 source_task_id의 최신 버전 1건만 true. 목록/승격은 is_latest=true 기준. 이전 버전은 false로 보존.';

create unique index if not exists topik_writing_question_import_latest_idx
  on public.topik_writing_question_import (source_task_id)
  where is_latest;
create index if not exists topik_writing_question_import_status_idx
  on public.topik_writing_question_import (mapping_status);
create index if not exists topik_writing_question_import_item_number_idx
  on public.topik_writing_question_import (item_number);
create index if not exists topik_writing_question_import_promoted_idx
  on public.topik_writing_question_import (promoted_question_id)
  where promoted_question_id is not null;

-- RLS: 읽기 = admin(private.is_admin), 쓰기 = 전면 차단(정책 없음 → service-role/RPC 단일 경로).
-- (기존 topik_writing 테이블과 동일하게 명시 grant 없이 Supabase 기본 select grant + RLS 정책.)
alter table public.topik_writing_question_import enable row level security;

create policy topik_writing_question_import_admin_select
  on public.topik_writing_question_import
  for select to authenticated
  using (private.is_admin((select auth.uid())));
