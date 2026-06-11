# [공지 초안] v13 `problems` read-only 동결 선언 (P3 컷오버 후속, §7.1-6)

| 항목 | 내용 |
| :---- | :---- |
| 작성일 | 2026-06-11 (P3 PASS 직후 — 실행계획안 §7.1-6, 결정 기록 §2.3-2 이행) |
| 수신 | v13 채널(오너/v13 — v13 오너 = admin 오너 동일인, 결정 기록 §2.2) |
| 발신 | topik-ai admin 팀 (프로젝트 오너 채널 경유 발신) |
| 성격 | 운영 공지·기록 — **코드 변경 0줄**(admin 코드는 이미 `problems`에 쓰지 않음, legacy 어댑터도 읽기 전용) |

## 공지 본문

1. **선언**: 2026-06-11 P3 컷오버(커밋 `202f905`, 0013 적용 `5262685`) 완료에 따라, v13 `problems` 테이블은 admin 기준 **read-only 레거시로 동결**한다(결정 기록 §2.3-2). 이후 admin의 신규 write는 없다(컷오버 전에도 admin write 경로는 부재 — 구 admin RPC는 2026-06-09 v13 admin island 제거로 삭제됨).
2. **admin 문항·운영 SoT**: `topik_writing_51/52/53/54_questions` + 마스터/태그/`question_source_map`(결정 기록 §2.3-3). admin 읽기 기본 경로도 신규 스키마다(스위치 기본 `topik_writing`).
3. **`problems` 보존 의무**: v13 사용자 기능이 `problems`를 읽는 동안 행 삭제/아카이브는 금지(§2.3-3). 일몰(드롭/아카이브)은 P6 PASS + v13 신규 소비 경로 전환 확인 후 **별도 오너 결정**으로만 진행(§2.3-4 — 본 전환 비범위).
4. **롤백 경로 안내**: admin 구 읽기 어댑터는 env `VITE_QUESTION_BANK_SOURCE=legacy` 봉인으로 P4 종료까지 보존된다(실행계획안 §12.2 — 읽기 전용, 쓰기 불가).
5. **델타 정합 근거**: 컷오버 시 freeze 윈도 → ETL 델타 재적재 → 발산 0건 대사를 완료했고(P3-1 증적), 동결 선언 이후 `problems` 변경분은 admin 신규 스키마에 따라잡기 의무가 없다(외부 공급 API 가동 후 수신 경로로만 신규 유입 — POL-017).

## 발신·기록 상태

- 발신: 오너 채널 경유(발신 자체는 오너 수행). 발신 완료 시 본 표에 일시 추기.
- 기록: `logs/metadata-tag-schema-transition-evidence.md` "problems read-only 동결 선언" 절, `docs/architecture/admin-data-source-transition.md` §10.3.
