// 프리뷰·e2e 전용 고정 시드. playwright 는 VITE_SUPABASE_DISABLED 로 실행되므로
// 이 시드가 없으면 화면이 빈 상태로만 검증된다. 실제 접수 데이터는 쓰지 않는다.

import type {
  SystemReport,
  SystemReportPage,
  SystemReportQuery
} from '../model/system-report-types';

const MOCK_REPORTS: SystemReport[] = [
  {
    reportId: '11111111-1111-4111-8111-111111111111',
    referenceCode: 'SR-0A1B2C3D4E5F6071',
    category: 'bug',
    email: 'learner.one@example.com',
    title: '쓰기 제출 후 결과 화면이 계속 로딩됩니다',
    message: '51번 문항을 제출하고 3분 넘게 기다렸는데 채점 결과가 나오지 않습니다. 새로고침하면 처음 화면으로 돌아갑니다.',
    pathname: '/writing/51',
    browser: 'chrome',
    os: 'windows',
    deviceType: 'desktop',
    viewportWidth: 1920,
    viewportHeight: 1080,
    locale: 'ko',
    appVersion: '2026.07.28',
    reporterUserId: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-07-28T14:32:11+00:00'
  },
  {
    reportId: '33333333-3333-4333-8333-333333333333',
    referenceCode: 'SR-1B2C3D4E5F607182',
    category: 'question',
    email: 'learner.two@example.com',
    title: '구독 결제일을 바꿀 수 있나요',
    message: '매월 결제일을 말일로 바꾸고 싶습니다. 어디에서 변경하는지 찾지 못했습니다.',
    pathname: '/mypage/subscription',
    browser: 'safari',
    os: 'ios',
    deviceType: 'mobile',
    viewportWidth: 390,
    viewportHeight: 844,
    locale: 'ko',
    appVersion: '2026.07.28',
    reporterUserId: null,
    createdAt: '2026-07-27T02:05:47+00:00'
  },
  {
    reportId: '44444444-4444-4444-8444-444444444444',
    referenceCode: 'SR-2C3D4E5F60718293',
    category: 'suggestion',
    email: 'learner.three@example.com',
    title: 'Xin thêm bản dịch tiếng Việt cho phần hướng dẫn',
    message: '학습 안내 문구가 한국어만 있어서 이해하기 어렵습니다. 베트남어 번역이 있으면 좋겠습니다.',
    pathname: '/library',
    browser: 'other',
    os: 'android',
    deviceType: 'tablet',
    viewportWidth: 800,
    viewportHeight: 1280,
    locale: 'vi',
    appVersion: null,
    reporterUserId: null,
    createdAt: '2026-07-25T23:41:02+00:00'
  }
];

export function loadMockSystemReports(query: SystemReportQuery): SystemReportPage {
  const keyword = query.keyword?.trim().toLowerCase() ?? '';
  const filtered = MOCK_REPORTS.filter((report) => {
    if (query.category && report.category !== query.category) return false;
    if (query.createdFrom && report.createdAt < query.createdFrom) return false;
    if (query.createdTo && report.createdAt >= query.createdTo) return false;
    if (!keyword) return true;
    return [report.referenceCode, report.title, report.message, report.email]
      .some((field) => field.toLowerCase().includes(keyword));
  });

  const start = (query.page - 1) * query.pageSize;
  return {
    rows: filtered.slice(start, start + query.pageSize),
    totalCount: filtered.length
  };
}

export function deleteMockSystemReport(reportId: string): string {
  const found = MOCK_REPORTS.find((report) => report.reportId === reportId);
  if (!found) throw new Error('선택한 리포트를 찾을 수 없습니다.');
  return found.referenceCode;
}
