import { Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';

/**
 * 평가 > TOPIK 쓰기 문항의 route-backed 탭. 탭 클릭 = 해당 라우트로 이동(URL 상태/문서
 * 소유 유지). 본문은 각 페이지가 탭 아래에 렌더한다(이 컴포넌트는 탭 바만 렌더).
 *  - 문항            → /assessment/question-bank  (조회 + 노출/태그 관리 통합)
 *  - 가져온 문항(인박스) → /assessment/question-bank/imported (외부 적재 스테이징)
 */
export type AssessmentBankTabKey = 'questions' | 'imported';

const TAB_ROUTE: Record<AssessmentBankTabKey, string> = {
  questions: '/assessment/question-bank',
  imported: '/assessment/question-bank/imported'
};

export function AssessmentBankTabs({
  active
}: {
  active: AssessmentBankTabKey;
}): JSX.Element {
  const navigate = useNavigate();
  return (
    <Tabs
      activeKey={active}
      onChange={(key) => navigate(TAB_ROUTE[key as AssessmentBankTabKey])}
      items={[
        { key: 'questions', label: '문항' },
        { key: 'imported', label: '가져온 문항(인박스)' }
      ]}
    />
  );
}
