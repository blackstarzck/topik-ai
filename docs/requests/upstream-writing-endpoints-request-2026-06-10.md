# [발신 요청서] 상류 TalkPik Writing API — 업로드/노출 토글 엔드포인트 신설 요청

| 항목 | 내용 |
| :---- | :---- |
| 작성일 | 2026-06-10 (P0, D-11) |
| 수신 | TalkPik AI Service(상류 Writing API) 담당 팀 |
| 발신 | topik-ai admin 팀 (프로젝트 오너 채널 경유 발신 예정) |
| 배경 | 메타데이터·태그 스키마 전환(P6)에서 검수 완료 문항을 상류로 업로드(배포)하고 노출을 동기화하는 계약이 필요 (POL-017, `docs/specs/admin-policy-source-map.md`) |

## 요청 사항

1. **문항 업로드(upsert) 엔드포인트 신설**: admin이 검수 완료 문항을 과제로 업로드/갱신할 수 있는 인증된 upsert 엔드포인트. 요청 본문은 `GenerateProblemResponse` 호환(`task_type`/`title`/`instruction`/`topic`/`difficulty`/`max_score` + 과제별 추가 키), 응답에 상류 과제 식별자(`task_id`) 포함 요청 — admin은 이를 `published_task_id`로 영구 매핑(역추적·재배포).
2. **노출 토글 엔드포인트 신설**: 업로드된 과제의 사용자 노출 on/off 토글(또는 soft delete). admin `service_status`(노출 가능/노출 제외) 변경과 동기화 대상.
3. **task52 부재 이슈 확인 요청**: 현행 스냅샷(`docs/specs/topik-ai-service-api-reference.md`) 기준 `WritingGenerateRequest`/`SaveDraftRequest`의 `task_type` enum이 `task51|task53|task54`로 **task52가 없음**. 52번 문항 배포를 위해 enum 확장(또는 대체 계약) 확인 필요.
4. 회신 시 admin 측은 API 스냅샷을 재생성하고(P6-1) 신규 스키마→`GenerateProblemResponse` 매핑 계약(P6-2)을 확정한다.

## 비고

- 본 요청 미확정이어도 전환 P1~P5는 진행 가능하며 P6만 게이트된다(실행 계획안 D-11).
- 발신 상태 추적: `logs/metadata-tag-schema-transition-evidence.md` 스코어카드 메모.
