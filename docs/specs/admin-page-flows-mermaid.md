# TOPIK AI Admin 페이지 흐름도 (Page Flows)

## 문서 계약

- 고정 8개 모듈: Dashboard, Users, Community, Message, Operation, Billing, Analytics, System
- 메뉴명은 `Users`(복수형)로 표기하며, `User` 단수형 사용을 금지합니다. (참조: `docs/architecture/admin-information-architecture.md:63`)
- 감사 로그 용어는 `감사 로그`로 통일합니다. (참조: `docs/architecture/admin-information-architecture.md:64`, `docs/specs/admin-action-log.md:4`)
- `시스템 로그`는 기술 로그로 감사 로그와 구분합니다. (참조: `docs/architecture/admin-information-architecture.md:65`)
- Users 상세 탭 고정: `프로필`, `활동`, `결제`, `커뮤니티`, `로그`, `관리자 메모` (참조: `docs/architecture/admin-information-architecture.md:66`)
- 금지 범위 및 용어: `Learning`, `Content/Course` (참조: `docs/architecture/admin-information-architecture.md:67`)

## 근거 문서

- `docs/architecture/admin-information-architecture.md`
- `docs/specs/admin-page-analysis.md`
- `docs/specs/admin-page-tables.md`
- `docs/specs/admin-user-detail-page-structure.md`
- `docs/specs/admin-action-log.md`

## 페이지 흐름도 개요

- 본 문서는 `docs/guidelines/admin-ux-ui-design.md`의 UX 내러티브를 다이어그램으로 고정합니다.
- 공통 흐름은 `검색/필터 -> 상세/확인 -> 조치 -> 피드백 -> 감사 로그 확인`입니다.
- 파괴적 조치(정지/삭제/숨김/사용자 정지)는 의사결정 노드로 확인 단계를 명시합니다.

## 주요 사용자 시나리오 흐름

### Users > 회원 목록

```mermaid
flowchart LR
  A[회원 목록 진입] --> B[검색/필터 적용]
  B --> C[결과 테이블 확인]
  C -->|행 클릭| E[회원 상세로 이동]
  C -->|더보기: 회원 정지/회원 정지 해제| F{확인 모달}
  C -->|더보기: 관리자 메모 작성| G[메모 저장]
  F -->|확인| H[조치 실행]
  F -->|취소| C
  H --> I[성공/실패 피드백]
  G --> I
  I --> J[System > 감사 로그 확인]
```

### Users > 회원 상세

```mermaid
flowchart LR
  A[회원 상세 진입] --> B[상단 요약 카드 확인]
  B --> C[탭 선택 프로필/활동/결제/커뮤니티/로그/관리자 메모]
  C --> D{조치 필요 여부}
  D -->|없음| E[다음 회원 확인]
  D -->|있음| F{조치 유형}
  F -->|회원 정지/회원 정지 해제/회원 탈퇴 처리| G{확인 모달}
  F -->|게시글 숨김/게시글 삭제| G
  G -->|확인| H[조치 실행]
  G -->|취소| C
  H --> I[결과 피드백]
  I --> J[System > 감사 로그 확인]
```

### Community > 게시글 관리

```mermaid
flowchart LR
  A[게시글 관리 진입] --> B[제목/작성자/게시판/신고 여부 검색]
  B --> C[게시글 목록 확인]
  C -->|행 클릭| D[게시글 상세보기]
  C -->|작성자 클릭| G[작성자 상세 이동]
  C -->|더보기: 게시글 숨김/게시글 삭제| E{조치 선택}
  E -->|게시글 숨김| F{확인 모달}
  E -->|게시글 삭제| F
  F -->|확인| H[조치 실행]
  F -->|취소| C
  H --> I[성공/실패 피드백]
  I --> J[System > 감사 로그 확인]
```

### Community > 신고 관리

```mermaid
flowchart LR
  A[신고 관리 진입] --> B[처리 전 신고 필터]
  B --> C[신고 항목 상세 확인]
  C -->|대상 사용자 ID 클릭| J[사용자 상세 이동]
  C --> D{조치 선택}
  D -->|게시글 숨김| E{확인 모달}
  D -->|사용자 정지| E
  D -->|신고 처리 완료| F[상태 처리 완료 변경]
  E -->|확인| G[조치 실행]
  E -->|취소| C
  G --> H[결과 피드백]
  F --> H
  H --> I[System > 감사 로그 확인]
```

### Message > 메일 / 푸시 발송

```mermaid
flowchart LR
  A[메시지 화면 진입] --> B[채널 선택 메일 또는 푸시]
  B --> C[자동 발송 또는 수동 발송 탭 선택]
  C --> D[템플릿 입력/수정]
  D --> E[미리보기 및 유효성 검증]
  E --> F{발송 방식 선택}
  F -->|즉시 발송| G{확인 모달}
  F -->|예약 발송| H[예약 시간 설정]
  H --> G
  G -->|확인| I[발송 실행]
  G -->|취소| D
  I --> J[성공/부분 실패/실패 피드백]
  J --> K[Message > 발송 이력 확인]
  K --> L[System > 감사 로그 확인]
```

### Message > 대상 그룹

```mermaid
flowchart LR
  A[대상 그룹 진입] --> B[그룹 목록 확인]
  B -->|행 클릭 또는 그룹 추가| C[우측 Drawer 열기]
  C --> D[정적 그룹 또는 조건 기반 그룹 설정]
  D --> E[조회하기로 예상 발송 인원 계산]
  E --> F{저장 또는 삭제}
  F -->|저장| G[그룹 저장]
  F -->|삭제| H{확인 모달}
  H -->|확인| I[그룹 삭제]
  H -->|취소| C
  G --> J[성공 피드백]
  I --> J
  J --> K[메일/푸시 화면에서 그룹 재사용]
  K --> L[System > 감사 로그 확인]
```

### Message > 발송 이력

```mermaid
flowchart LR
  A[발송 이력 진입] --> B[채널 탭 메일/푸시 선택]
  B --> C[보조 탭 전체/자동/수동 선택]
  C --> D[검색 및 상태 필터 적용]
  D --> E[발송건 목록 확인]
  E -->|행 클릭 또는 미리보기| F[우측 상세 Drawer 열기]
  F --> G[기본 정보 및 수신자 샘플 확인]
  G --> H{후속 조치 필요}
  H -->|재시도| I{확인 모달}
  H -->|복제 발송| J{확인 모달}
  H -->|없음| M[검토 종료]
  I -->|확인| K[재시도 발송 등록]
  J -->|확인| L[복제 발송 등록]
  I -->|취소| F
  J -->|취소| F
  K --> N[성공 피드백]
  L --> N
  N --> O[System > 감사 로그 확인]
```

### System > 감사 로그

```mermaid
flowchart LR
  A[감사 로그 진입] --> B[관리자/Action/Target/기간 필터]
  B --> C[로그 목록 확인]
  C --> D[로그 상세 열기]
  D --> E[Before/After 및 Target ID 확인]
  E --> F{추가 확인 필요}
  F -->|예| G[원본 화면으로 이동]
  F -->|아니오| H[검증 완료]
  G --> I[조치 맥락 재검토]
  I --> H
```

