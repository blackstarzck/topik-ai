# Antigravity 디자인 가이드 (Admin)

## 문서 계약
- **기준 모듈**: Dashboard, Users, Community, Message, Operation, Commerce, Assessment, Content, Analytics, System
- **메뉴명 고정**: `Users`(복수형)로 표기하며, `User` 단수형 사용을 금지합니다. (참조: `docs/architecture/admin-information-architecture.md:63`)
- **감사 로그 용어**: `감사 로그`로 통일하며, `시스템 로그`(기술 로그)와 엄격히 구분합니다. (참조: `docs/architecture/admin-information-architecture.md:64`, `docs/specs/admin-action-log.md:4`)
- **회원 상세 탭 고정**: `프로필`, `활동`, `결제`, `커뮤니티`, `로그`, `관리자 메모` 순서를 유지합니다. (참조: `docs/architecture/admin-information-architecture.md:66`)
- **확장 범위 포함**: `Commerce`, `Assessment`, `Content` 모듈을 포함합니다. (참조: `docs/architecture/admin-information-architecture.md`)

## 근거 문서
- [docs/architecture/admin-information-architecture.md](../architecture/admin-information-architecture.md)
- [docs/specs/admin-page-analysis.md](../specs/admin-page-analysis.md)
- [docs/specs/admin-page-tables.md](../specs/admin-page-tables.md)
- [docs/specs/admin-user-detail-page-structure.md](../specs/admin-user-detail-page-structure.md)
- [docs/specs/admin-action-log.md](../specs/admin-action-log.md)
- https://5x.ant.design/docs/react/customize-theme
- https://ant.design/theme-editor
- https://5x.ant.design/components/layout/
- https://5x.ant.design/docs/spec/alignment/
- https://5x.ant.design/docs/spec/contrast/
- https://5x.ant.design/docs/spec/navigation/
- https://ant.design/docs/blog/virtual-table/
- https://ant.design/components/table/#api

## 적용 범위
- TOPIK AI Admin 전 모듈 및 Ant Design 5.x 기반 프론트엔드 구현체

## Do
- 모든 테마 설정은 `ConfigProvider`와 디자인 토큰(Design Tokens)을 통해 제어한다.
- 테이블은 서버 사이드 페이징, 필터링, 정렬을 기본으로 구현한다.
- 데이터 변경 액션은 반드시 `감사 로그`에 기록되도록 UI/UX를 설계한다.
- 상태 값은 `정상/정지/탈퇴`, `게시/숨김`, `완료/취소/환불` 등 정의된 세트를 사용한다.
- 대용량 테이블 렌더링 시 `virtual` 속성과 `scroll.y`를 사용하여 성능을 확보한다.

## Do Not
- `User`(단수형) 메뉴명을 사용하지 않는다.
- 인라인 스타일이나 커스텀 CSS를 남발하지 않고 AntD 토큰 우선 원칙을 지킨다.
- `시스템 로그` 화면에 관리자 조치 내역을 노출하지 않는다.
- 로딩 상태나 에러 피드백 없이 비동기 작업을 수행하지 않는다.

## Checklist
- [ ] 메뉴명이 `Users` 복수형으로 정확히 기입되었는가?
- [ ] 테이블 컬럼과 필터 라벨이 `docs/specs/admin-page-tables.md`와 일치하는가?
- [ ] `ConfigProvider`를 통해 브랜드 컬러와 토큰이 적용되었는가?
- [ ] 모든 상태 값(Status)의 컬러가 가이드라인을 따르는가?
- [ ] 감사 로그로 연결되는 액션이 누락되지 않았는가?

## 레이아웃 규칙
- **GNB/LNB**: 좌측 LNB에 8개 모듈을 배치하며, 상단 GNB에는 유저 정보와 시스템 알림을 배치한다.
- **GNB 토글**: 상단 GNB 좌측 첫 아이콘은 LNB 접기/펼치기 전용 토글로 사용하며, 축약 상태에서도 현재 메뉴 선택과 이동 동선은 유지한다.
- **간격(Spacing)**: 8px 그리드 시스템을 사용하며, 컴포넌트 간 기본 간격은 16px(MD) 또는 24px(LG)을 권장한다.
- **정렬**: [Ant Design Alignment](https://5x.ant.design/docs/spec/alignment/) 기준에 따라 레이블은 좌측, 숫자는 우측 정렬을 원칙으로 한다.

## 타이포그래피
- **폰트**: Pretendard 등 가독성이 높은 고딕 계열 시스템 폰트를 사용한다.
- **크기**: 기본 본문은 14px, 페이지 타이틀은 24px(Heading 2)을 사용한다.
- **색상**: 기본 텍스트는 `colorText`, 설명글은 `colorTextDescription` 토큰을 할당한다.

## 컬러/대비
- **브랜드 컬러**: `colorPrimary`를 통해 시스템 전반의 주요 색상을 결정한다.
- **상태 컬러**:
  - Success (Green): 정상, 게시, 활성, 완료
  - Warning (Orange): 처리 전, 부분 실패
  - Error (Red): 정지, 숨김, 비활성, 취소, 환불, 실패
- **대비**: [WCAG Contrast](https://5x.ant.design/docs/spec/contrast/) 가이드를 준수하여 가독성을 보장한다.

## 컴포넌트 규칙 (Ant Design)
- **ConfigProvider**: 전역 테마 설정을 위해 반드시 사용하며, `theme.token`을 통해 커스터마이징한다.
- **Button**: 액션의 중요도에 따라 `primary`, `default`, `dashed`, `text`, `link`를 구분하여 사용한다.
- **입력 레이아웃**: Modal, Drawer, 보조 패널의 항목형 입력은 `Descriptions` 기반 입력 테이블을 기본으로 사용하고, `Form`은 검증과 상태 관리 용도로만 감싼다. 단일 본문 에디터처럼 표 구조가 맞지 않는 캔버스형 입력만 예외로 둔다.

## 테이블/필터 UI 규칙
- **필터**: 테이블 상단에 배치하며, 검색어 입력과 셀렉트 박스, 기간 선택(RangePicker)을 조합한다.
- **컬럼**: `docs/specs/admin-page-tables.md`에 정의된 순서와 명칭을 그대로 유지한다.
- **상태 표현**: `Badge` 또는 `Tag`를 사용하여 상태를 시각적으로 구분한다.
- **성능**: 대용량 데이터 처리 시 `virtual` 테이블 모드를 검토한다.

## 상태/피드백(로딩/성공/오류) 표현 규칙
- **로딩**: `Spin` 또는 테이블의 `loading` 프롭을 사용하여 사용자에게 진행 상태를 알린다.
- **성공**: 조치 성공 시 `message.success()`를 사용하여 간결하게 알린다.
- **오류**: 시스템 오류나 유효성 검사 실패 시 `notification.error()` 또는 `Form`의 에러 메시지를 활용한다.

