# TOPIK AI Admin Claude 실행 지침

이 저장소의 에이전트 실행 규약은 루트 `AGENTS.md`가 단일 원문이다. Claude는 작업 시작 전에 `AGENTS.md` 전체를 읽고 사용자 직접 요청 다음 우선순위로 준수한다. 이 파일에 별도 구현·문서·Git 규칙을 복제하지 않는다.

새 세션은 `npm run git:session -- start --agent claude --task "<작업 요약>"`으로 최신 `origin/main` 기반 detached worktree와 외부 manifest를 만든다. 정확히 이어지는 작업은 기존 branch/worktree를 재사용하고, 신규 브랜치는 사용자 승인 후에만 생성한다. commit·push·PR 권한은 각각 기존 정책을 따른다.

PR 머지가 확인되면 `AGENTS.md` §11.3의 post-merge cleanup을 완료 조건으로 적용한다. cleanup은 기본 dry-run이며 실제 변경에는 `--apply`가 필요하다. dirty, 미병합, foreign repository, source·`.env.local`·invalid Git metadata가 포함된 항목은 자동 삭제하지 않는다.
