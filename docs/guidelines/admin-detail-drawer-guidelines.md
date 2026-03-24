# TOPIK AI Admin 상세 Drawer 레이아웃 규칙

## 목적

- 테이블 행 클릭으로 열리는 상세 Drawer의 헤더, 본문, 푸터 구조를 일관되게 유지합니다.
- 운영 흐름 `검색 -> 상세 -> 조치 -> 감사 로그 확인`이 Drawer 안에서도 동일하게 읽히도록 고정합니다.
- 구현 기준은 `src/shared/ui/detail-drawer/detail-drawer.tsx`를 단일 공용 레이아웃으로 사용합니다.

## 적용 범위

- 대상: 목록 테이블 행 클릭으로 열리는 상세 확인용 Drawer
- 예시: `Community > 게시글 관리`, `Users > 강사 관리`, `Users > 추천인 관리`, `Message > 발송 이력`, `Operation > FAQ`
- 제외: 생성/편집/조건 설정처럼 작성 맥락이 강한 Drawer
- 단, 제외된 편집형 Drawer도 header/footer chrome은 공통 `DrawerTitle`, `DrawerHeaderMeta`, `DrawerFooter` 구조와 동일한 시각 규칙을 재사용합니다.

## 레이아웃 원칙

- 행 클릭 상세 Drawer의 시각 baseline은 `Community > 게시글 관리`의 `게시글 상세 Drawer`를 사용합니다.
- 헤더 왼쪽은 `개체명 + 상세 + 대표 식별자` 형식의 제목만 둡니다.
- 헤더 오른쪽은 상태 배지, 이상치 태그처럼 읽기 전용 메타 정보만 둡니다.
- 전역 조치 버튼은 헤더가 아니라 푸터 오른쪽에 둡니다.
- 푸터 왼쪽은 `감사 로그 확인` 링크를 기본 위치로 사용합니다.
- 푸터 오른쪽은 조회/이동/상태 변경/파괴적 액션 버튼을 모읍니다.
- 닫기 버튼은 푸터 기본 구성 요소로 두지 않고 Drawer 기본 닫기 동선을 사용합니다.
- 본문 최상단에는 현재 상태를 설명하는 `Alert`가 필요할 때만 둡니다.
- 본문 섹션은 `32px` 간격을 기본값으로 유지합니다.
- `DetailDrawerBody` 안의 `Descriptions`는 label(`th`) 폭을 전역 `130px`로 통일하고, 페이지별 inline width override는 예외 사유가 없으면 두지 않습니다.

## 헤더 규칙

- 제목은 `게시글 상세 · POST-001`, `추천 코드 상세 · TOPIK-3215`처럼 한 줄에서 의미가 닫히게 작성합니다.
- 상태 배지와 보조 태그는 제목과 분리해 헤더 오른쪽 슬롯에 둡니다.
- 숨김/삭제/재시도/활성화 같은 액션 버튼은 헤더에 올리지 않습니다.
- 헤더 제목과 우측 메타는 수직 중앙 정렬을 기본값으로 유지하고, 우측 메타는 오른쪽 정렬 + 줄바꿈 허용 구조를 사용합니다.
- 헤더 메타 안 상태 배지/태그 간 간격은 `8px`을 기본값으로 유지합니다.

## 본문 규칙

- 본문 최상위 래퍼는 `DetailDrawerBody`를 사용합니다.
- 각 섹션은 `DetailDrawerSection`으로 감싸 제목과 우측 보조 액션 위치를 고정합니다.
- 섹션 내부의 로컬 액션만 섹션 헤더 우측에 둡니다.
  - 예: `메모 히스토리` 섹션의 `메모 등록`
- `Descriptions`, `Table`, `Paragraph`, `Tag` 조합은 섹션 단위로 묶어 의미를 분리합니다.
- `Descriptions`는 공통 Drawer 스타일을 그대로 사용하고, 특정 페이지에서만 별도 `styles.label.width`를 주는 방식은 지양합니다.
- Drawer 내부 테이블 규칙은 `docs/specs/admin-page-tables.md`와 `docs/guidelines/admin-ux-ui-design.md`를 함께 따릅니다.

## 푸터 규칙

- 왼쪽: `AuditLogLink`
- 오른쪽: `Button` 묶음
- 푸터는 좌우 슬롯이 `space-between`으로 벌어지고, 폭이 부족할 때는 wrap되는 구조를 기본값으로 사용합니다.
- 푸터 좌측 슬롯은 링크 기준 수직 중앙 정렬과 최소 높이 `32px`를 유지합니다.
- 푸터 우측 버튼 묶음은 오른쪽 정렬, wrap 허용, 버튼 간 간격 `8px`을 기본값으로 유지합니다.
- 푸터 패딩은 `26px 16px`, 좌우 슬롯 간 간격은 `12px 16px`을 기본값으로 유지합니다.
- 푸터 액션 버튼 크기는 공통 `large`를 기본값으로 사용합니다.
- 버튼 우선순위는 `조회/이동 -> 보조 조치 -> 주요 조치 -> 파괴적 조치` 순서로 둡니다.
- 파괴적 액션은 빨간 강조 버튼을 마지막에 두고, 확인 단계와 사유 입력은 별도 `ConfirmAction` 또는 Modal에서 처리합니다.

## 코드 적용 기준

- 신규 상세 Drawer는 `antd`의 `Drawer`를 직접 조합하지 않고 우선 `DetailDrawer` 조합 가능 여부를 검토합니다.
- 공통 구조를 벗어나야 하면 이유를 코드와 문서에 함께 남깁니다.
- 상세 Drawer 안 섹션 제목/액션 정렬을 위해 임시 inline layout을 반복 추가하지 않습니다.

## 문서 갱신 규칙

- 아래 중 하나라도 바뀌면 이 문서를 같은 작업에서 반드시 갱신합니다.
  - 헤더/본문/푸터 슬롯의 위치 규칙
  - 제목 포맷 규칙
  - 감사 로그 링크 위치
  - 섹션 제목/보조 액션 배치 방식
  - `DetailDrawer` 공용 컴포넌트 API 또는 사용 원칙
  - 행 클릭 상세 Drawer가 새로 추가되거나 기존 페이지가 다른 패턴으로 바뀌는 경우
- 이 문서를 갱신하는 작업은 다음 문서도 함께 평가하고 필요 시 같은 요청에서 수정합니다.
  - `AGENTS.md`
  - `docs/guidelines/admin-ux-ui-design.md`
  - `docs/specs/admin-page-tables.md`
  - 영향받는 `docs/specs/page-ia/*.md`
  - `docs/specs/admin-page-ia-change-log.md`
  - `docs/README.md`(문서 추가/이동 시)
  - `logs/admin-doc-update-log.md`
