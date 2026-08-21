import type { ThemeConfig } from 'antd';

/** 가시 텍스트 최소 크기(오너 지시 2026-07-14). 게이트 원문 = `scripts/check-typography-min-font.mjs`. */
export const MIN_VISIBLE_FONT_SIZE_PX = 14;

/**
 * 프로젝트 본문 글자 크기(오너 결정 2026-08-21).
 *
 * antd 기본 seed 와 같은 14 지만 **상속이 아니라 선언**이다 — 지정하지 않으면 프로젝트의
 * base 가 `node_modules/antd/lib/theme/themes/seed.js` 의 기본값이 되고, antd 가 그 값을
 * 바꾸면 우리 스케일 전체가 조용히 따라 움직인다. 앱 안의 모든 글자 크기는 이 하나에서
 * 파생한다(`FONT_SIZE` → CSS 변수 브리지 → 화면).
 *
 * 🚨 이 값을 바꾸면 sm 을 뺀 스케일 전 단계가 함께 움직인다(antd 파생은 지수 계열 —
 * `node_modules/antd/lib/theme/themes/shared/genFontSizes.js`). 16 으로 올리면
 * 14·16·18·22·28·34 가 되어 앱 전체 본문이 커진다.
 */
export const BASE_FONT_SIZE_PX = 14;

/**
 * antd 전역 테마 토큰.
 *
 * `fontSizeSM` 을 14 로 고정한 이유 — antd 는 "작은 텍스트"를 이 토큰 하나에서 파생시킨다.
 * 실측(2026-08-20 프로덕션 프리뷰 computed font-size 전수 감사)에서 우리 코드의 값은 전부
 * 14 이상인데도 `ant-tag`(Tag 본문)와 `ant-switch-inner-*`(Switch 내부 라벨)가 12px 로
 * 남았고, 원인은 antd 기본 파생값 `fontSizeSM = fontSize(14) - 2 = 12` 였다. 같은 토큰에서
 * Badge count·표 필터 빈 목록 문구처럼 DOM 을 훑어서는 잡히지 않는 표면도 파생된다.
 *
 * 소형 변형만 본문과 같은 14 로 끌어올리는 것이라 "앱 전체 본문을 키우지 말라"는 제약과
 * 충돌하지 않는다. 파생 기하값 중 실측 변화는 `.ant-badge-dot` 6→7px 하나뿐이다
 * (도형이라 규칙 대상 아님).
 *
 * 🚨 그 결과 **`sm` 단계는 base 와 같아진다**(둘 다 14). 이건 선택이 아니라 두 규칙의
 * 논리적 귀결이다 — base 14 이면 antd 자연 파생은 `sm = 12` 인데 최소 14 규칙이 12 를
 * 금지하고, 올릴 수 있는 최소가 14 = base 다. base 를 16 으로 올리면 `sm = 14` 로 단계가
 * 되살아나지만 앱 전체 본문이 커진다(오너가 base 14 로 결정).
 *
 * 컴포넌트 단위로 좁히려면 `components: { Tag: { fontSizeSM: 14 } }` 형태도 유효하지만
 * (antd `ComponentsConfig` 는 컴포넌트별 alias 토큰 덮어쓰기를 허용한다), 파생 표면을
 * 전수 열거해야 해서 전역 한 곳에 두는 편을 택했다.
 */
const BRAND_PRIMARY = '#0f4da8';

export const adminThemeToken: ThemeConfig['token'] = {
  colorPrimary: BRAND_PRIMARY,
  /**
   * antd 의 `colorLink` 는 `colorPrimary` 에서 파생되지 않는 **별도 시드**라, 지정하지 않으면
   * 브랜드색을 바꿔도 링크와 링크 Button 만 antd 기본 파랑(`#1677ff`)으로 남는다.
   * 실측(프로덕션 프리뷰 computed style): `/dashboard` 에서 링크 계열 요소 33개가 그랬다.
   *
   * 브랜드색으로 맞추면 접근성도 같이 개선된다 — 흰 배경 대비비가
   * `#1677ff` **4.10:1**(본문 크기 WCAG AA 4.5:1 미달) → `#0f4da8` **7.93:1**(AAA) 이다.
   *
   * `colorInfo`(정보 상태색)는 일부러 건드리지 않는다 — 브랜드색과 같아지면 정보 Alert 이
   * 주요 액션과 구분되지 않는다. **2026-08-20 분리 유지로 결정 완료**(gap-register §3.17).
   * 아이콘 용도의 대비 기준은 3:1 이라 antd 기본 파랑(4.10:1)도 충족한다 — 다만 이 색을
   * 본문 텍스트나 링크에 쓰면 4.5:1 을 못 넘기므로 그때는 브랜드색을 써야 한다.
   * 결정은 `tests/unit/admin-theme-token.test.ts` 가 고정한다.
   */
  colorLink: BRAND_PRIMARY,
  borderRadius: 10,
  fontFamily: "'Freesentation', 'Noto Sans KR', 'Segoe UI', sans-serif",
  fontSize: BASE_FONT_SIZE_PX,
  fontSizeSM: MIN_VISIBLE_FONT_SIZE_PX
};
