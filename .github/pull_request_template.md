## 작업 연속성

- 세션 유형: <!-- 신규 변경 / 기존 작업 연속 / detached 조사 -->
- worktree ID·manifest: <!-- ~/.agent-sessions/topik-ai/<id>.json -->
- 관련 브랜치·PR: <!-- 없으면 없음 -->
- 연속 작업 판정 근거: <!-- 같은 요구사항/브랜치/PR인지 -->

## 변경 및 영향 범위

- 변경 요약:
- 영향 모듈:
- 데이터 계약·공통 UI·운영 정책 영향: <!-- 없으면 없음 -->

## GitHub 실행 계정

- 대상 remote·작업: <!-- origin main PR merge / collab push·merge / 해당 없음 -->
- 실행 GitHub 계정: <!-- origin main merge는 blackstarzck, collab은 guestkeduall-design -->
- Git commit author: <!-- collab은 guestkeduall-design <guestkeduall@gmail.com> -->
- [ ] `AGENTS.md` §11.1 계정 라우팅 확인 또는 해당 없음

## 검증

- [ ] `npm run harness:check`
- [ ] `npm run test:unit`
- [ ] `npm run build`
- [ ] 변경 영향 핵심 E2E 및 공통 UI baseline
- 미실행·실패·예외:

## 머지 후 cleanup

- 담당자:
- [ ] 원격 head 브랜치 자동 삭제 또는 삭제 확인
- [ ] `npm run git:sessions:cleanup -- --apply`
- [ ] `npm run git:sessions:audit -- --json --strict`
- 남은 `ACTIVE`·`DIRTY_BLOCKED`·`ORPHAN_REVIEW`·`RECOVERY_REQUIRED` 항목과 후속 담당: <!-- 없으면 없음 -->
