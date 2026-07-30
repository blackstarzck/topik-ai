// System > 사용자 리포트 표시 모델.
// v13 정본 private.system_reports 의 컬럼을 1:1로 옮긴 읽기 전용 모델이며,
// 상태·담당자·처리 메모 같은 파생 필드는 두지 않는다(정본 변형 금지).

export type SystemReportCategory = 'bug' | 'question' | 'suggestion';
export type SystemReportBrowser = 'chrome' | 'safari' | 'firefox' | 'edge' | 'other';
export type SystemReportOs = 'windows' | 'macos' | 'ios' | 'android' | 'linux' | 'other';
export type SystemReportDeviceType = 'desktop' | 'tablet' | 'mobile' | 'unknown';
export type SystemReportLocale = 'ko' | 'en' | 'vi';

export type SystemReport = {
  reportId: string;
  referenceCode: string;
  category: SystemReportCategory;
  email: string;
  title: string;
  message: string;
  pathname: string;
  browser: SystemReportBrowser;
  os: SystemReportOs;
  deviceType: SystemReportDeviceType;
  viewportWidth: number;
  viewportHeight: number;
  locale: SystemReportLocale;
  appVersion: string | null;
  reporterUserId: string | null;
  createdAt: string;
};

export type SystemReportPage = {
  rows: SystemReport[];
  totalCount: number;
};

export type SystemReportQuery = {
  category?: SystemReportCategory;
  createdFrom?: string;
  createdTo?: string;
  keyword?: string;
  page: number;
  pageSize: number;
};

export const systemReportCategoryLabels: Record<SystemReportCategory, string> = {
  bug: '오류 신고',
  question: '문의',
  suggestion: '제안'
};

export const systemReportDeviceTypeLabels: Record<SystemReportDeviceType, string> = {
  desktop: '데스크톱',
  tablet: '태블릿',
  mobile: '모바일',
  unknown: '확인 불가'
};

export const systemReportLocaleLabels: Record<SystemReportLocale, string> = {
  ko: '한국어',
  en: '영어',
  vi: '베트남어'
};

export function formatSystemReportDateTime(value: string | null): string {
  if (!value) return '기록 없음';
  return value.slice(0, 19).replace('T', ' ');
}

export function formatSystemReportViewport(report: SystemReport): string {
  if (report.viewportWidth === 0 && report.viewportHeight === 0) {
    return '기록 없음';
  }
  return `${report.viewportWidth.toLocaleString('ko-KR')} × ${report.viewportHeight.toLocaleString('ko-KR')}`;
}

export function formatSystemReportEnvironment(report: SystemReport): string {
  return `${report.browser} · ${report.os} · ${systemReportDeviceTypeLabels[report.deviceType]}`;
}

export function formatSystemReportReporter(report: SystemReport): string {
  return report.reporterUserId ? '로그인 사용자' : '비로그인 사용자';
}
