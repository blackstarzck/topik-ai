export type QuestionDetailTab = 'current' | 'history';

function createQuestionDetailParams(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

export function buildQuestionBankListHref(search: string): string {
  const params = createQuestionDetailParams(search);
  params.delete('detailTab');
  params.delete('versionId');

  const nextSearch = params.toString();
  return nextSearch ? `/assessment/question-bank?${nextSearch}` : '/assessment/question-bank';
}

export function buildQuestionDetailHref(
  questionId: string,
  search: string,
  tab: QuestionDetailTab,
  versionId?: number
): string {
  const params = createQuestionDetailParams(search);

  if (tab === 'history') {
    params.set('detailTab', 'history');
    if (versionId == null) {
      params.delete('versionId');
    } else {
      params.set('versionId', String(versionId));
    }
  } else {
    params.delete('detailTab');
    params.delete('versionId');
  }

  const nextSearch = params.toString();
  const pathname = `/assessment/question-bank/${encodeURIComponent(questionId)}`;
  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
}

export function parseQuestionVersionId(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
