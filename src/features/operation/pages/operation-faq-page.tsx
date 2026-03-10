import { Card, Collapse } from 'antd';

import { PageTitle } from '../../../shared/ui/page-title/page-title';


const faqItems = [
  {
    key: '1',
    label: '결제 오류 문의 대응 체크',
    children: 'Billing 내역 확인 후 환불/취소 상태를 점검하고 운영 메모를 남깁니다.'
  },
  {
    key: '2',
    label: '회원 정지 처리 시 체크 항목',
    children:
      '사용자 상세에서 사유를 기록하고 조치 후 감사 로그를 확인합니다.'
  }
];

export default function OperationFaqPage(): JSX.Element {
  return (
    <div>
      <PageTitle title="자주 묻는 질문" />
      <Card>
        <Collapse items={faqItems} />
      </Card>
    </div>
  );
}



