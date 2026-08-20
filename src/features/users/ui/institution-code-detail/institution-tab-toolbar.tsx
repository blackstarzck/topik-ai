import type { ReactNode } from 'react';
import { SPACE } from '@/shared/styles/design-tokens';

type InstitutionTabToolbarProps = {
  /** 왼쪽 요약 — 이 탭의 "지금 상태"를 한 줄로. 편집은 여기 두지 않는다. */
  summary: ReactNode;
  /** 오른쪽 액션 — 주요 작업 버튼과 설정 Drawer 트리거. */
  actions?: ReactNode;
};

/**
 * 기관 코드 상세 탭 공용 툴바.
 *
 * 각 탭은 **툴바(요약 + 액션) + 본문(현황)** 구조를 쓴다. 이전에는 설정 폼이 탭 맨 위에
 * 있어 매일 보는 현황(회원 로스터·배정 목록)이 스크롤 아래로 밀렸다 — 회원 130명 기관에서
 * 첫 화면에 회원이 한 명도 안 보였다. 그래서 **값 요약은 같은 화면(툴바)에 남기고 편집만
 * Drawer 로 옮긴다**: 판단에 필요한 수치는 계속 보이면서 본문이 앞으로 온다.
 *
 * 신규 CSS 를 만들지 않고 `AdminListCard` 툴바 클래스 3종을 그대로 쓴다
 * (선례: `operation-pdf-quota-page.tsx` 의 "항상 1개인 운영 설정" 탭).
 */
export function InstitutionTabToolbar({
  summary,
  actions
}: InstitutionTabToolbarProps): JSX.Element {
  return (
    <div className="admin-list-card-toolbar-side" style={{ marginBottom: SPACE.base }}>
      <div className="admin-list-card-toolbar-summary">{summary}</div>
      {actions ? <div className="admin-list-card-toolbar-actions">{actions}</div> : null}
    </div>
  );
}
