import { messageDataSource } from '../api/message-data-source';
import { NotificationDispatchHistoryPage } from './message-history-dispatch-page';
import { MockMessageHistoryPage } from './message-history-mock-page';

// 발송 이력 라우트 진입점 — 데이터소스에 따라 변형 페이지를 선택한다.
// 두 변형은 Phase 4 분해로 파일을 나눴다(동작 동일):
//   mock = message-history-mock-page.tsx / supabase = message-history-dispatch-page.tsx
export default function MessageHistoryPage(): JSX.Element {
  if (messageDataSource === 'supabase') {
    return <NotificationDispatchHistoryPage />;
  }

  return <MockMessageHistoryPage />;
}
