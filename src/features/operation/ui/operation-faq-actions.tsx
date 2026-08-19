import type { Dispatch, SetStateAction } from 'react';
import type { notification } from 'antd';
import type { FormInstance } from 'antd';

import {
  deleteFaqCurationSafe,
  deleteFaqSafe,
  saveFaqCurationSafe,
  saveFaqSafe,
  toggleFaqStatusSafe
} from '../api/faqs-service';
import type { AsyncState } from '@/shared/model/async-state';
import type {
  OperationFaq,
  OperationFaqCuration
} from '../model/types';
import {
  parseKeywords,
  type CurationEditorState,
  type CurationFormValues,
  type DangerState,
  type FaqEditorState,
  type FaqFormValues,
  type FaqPageParamKey
} from '../model/operation-faq-page-schema';
import {
  buildFaqAuditNoticeDescription,
  buildFaqErrorDescription
} from './operation-faq-audit-notice';

// FAQ 저장·위험 조치 실행기 — Phase 4 분해로 페이지 핸들러 본문을 이동(동작 동일).
// 페이지가 소유한 상태 setter·알림 인스턴스·URL 커밋을 컨텍스트로 주입받아 실행한다.

export type FaqActionContext = {
  notificationApi: ReturnType<typeof notification.useNotification>[0];
  syncSearchParams: (next: Partial<Record<FaqPageParamKey, string | null>>) => void;
  reload: () => void;
  closeFaqEditor: () => void;
  closeCurationEditor: () => void;
  closeFaqDrawer: () => void;
  closeCurationDrawer: () => void;
  setFaqsState: Dispatch<SetStateAction<AsyncState<OperationFaq[]>>>;
  setCurationsState: Dispatch<SetStateAction<AsyncState<OperationFaqCuration[]>>>;
  setDangerState: (next: DangerState) => void;
};

export async function runSaveFaq(
  ctx: FaqActionContext,
  faqForm: FormInstance<FaqFormValues>,
  faqEditorState: FaqEditorState
): Promise<void> {
const values = await faqForm.validateFields();
const reason =
  faqEditorState?.type === 'edit' ? 'FAQ 원문 수정' : 'FAQ 신규 등록';
const result = await saveFaqSafe({
  id: faqEditorState?.type === 'edit' ? faqEditorState.faq.id : undefined,
  question: values.question.trim(),
  answer: values.answer.trim(),
  searchKeywords: parseKeywords(values.searchKeywordsText),
  category: values.category,
  status: values.status,
  reason
});

if (!result.ok) {
  ctx.notificationApi.error({
    message:
      faqEditorState?.type === 'edit' ? 'FAQ 수정 실패' : 'FAQ 등록 실패',
  description: buildFaqErrorDescription(result.error.message, result.error.code)
  });
  return;
}

ctx.closeFaqEditor();
ctx.setFaqsState((prev) => {
  const nextData = [result.data, ...prev.data.filter((faq) => faq.id !== result.data.id)];
  return {
    status: nextData.length === 0 ? 'empty' : 'success',
    data: nextData,
    errorMessage: null,
    errorCode: null
  };
});
ctx.syncSearchParams({
  tab: 'master',
  selected: result.data.id
});
ctx.reload();

ctx.notificationApi.success({
  message:
    faqEditorState?.type === 'edit' ? 'FAQ 수정 완료' : 'FAQ 등록 완료',
  description: buildFaqAuditNoticeDescription('OperationFaq', result.data.id, [
    `사유/근거: ${reason}`
  ])
});
}

export async function runSaveCuration(
  ctx: FaqActionContext,
  curationForm: FormInstance<CurationFormValues>,
  curationEditorState: CurationEditorState
): Promise<void> {
const values = await curationForm.validateFields();
const pinnedDateRange = values.pinnedDateRange;
const reason =
  curationEditorState?.type === 'edit'
    ? 'FAQ 노출 규칙 수정'
    : 'FAQ 대표 노출 추가';

const result = await saveFaqCurationSafe({
  id:
    curationEditorState?.type === 'edit'
      ? curationEditorState.curation.id
      : undefined,
  faqId: values.faqId,
  surface: values.surface,
  curationMode: values.curationMode,
  displayRank: Number(values.displayRank),
  exposureStatus: values.exposureStatus,
  pinnedStartAt: pinnedDateRange?.[0]?.format('YYYY-MM-DD') ?? null,
  pinnedEndAt: pinnedDateRange?.[1]?.format('YYYY-MM-DD') ?? null,
  reason
});

if (!result.ok) {
  ctx.notificationApi.error({
    message:
      curationEditorState?.type === 'edit'
        ? 'FAQ 노출 수정 실패'
        : 'FAQ 노출 등록 실패',
  description: buildFaqErrorDescription(result.error.message, result.error.code)
  });
  return;
}

ctx.closeCurationEditor();
ctx.setCurationsState((prev) => {
  const nextData = [
    result.data,
    ...prev.data.filter((curation) => curation.id !== result.data.id)
  ];
  return {
    status: nextData.length === 0 ? 'empty' : 'success',
    data: nextData,
    errorMessage: null,
    errorCode: null
  };
});
ctx.syncSearchParams({
  tab: 'curation',
  curationSelected: result.data.id,
  selected: null
});
ctx.reload();

ctx.notificationApi.success({
  message:
    curationEditorState?.type === 'edit'
      ? 'FAQ 노출 수정 완료'
      : 'FAQ 노출 등록 완료',
  description: buildFaqAuditNoticeDescription('OperationFaqCuration', result.data.id, [
    `사유/근거: ${reason}`
  ])
});
}

export async function runFaqDangerAction(
  ctx: FaqActionContext,
  dangerState: NonNullable<DangerState>,
  reason: string
): Promise<void> {
if (!dangerState) {
  return;
}

if (dangerState.type === 'deleteFaq') {
  const result = await deleteFaqSafe(dangerState.faq.id, reason);
  if (!result.ok) {
    ctx.notificationApi.error({
      message: 'FAQ 삭제 실패',
  description: buildFaqErrorDescription(result.error.message, result.error.code)
    });
    return;
  }

  ctx.closeFaqDrawer();
  ctx.reload();
  ctx.setDangerState(null);
  ctx.notificationApi.success({
    message: 'FAQ 삭제 완료',
  description: buildFaqAuditNoticeDescription('OperationFaq', result.data.id, [
    `사유/근거: ${reason}`
  ])
  });
  return;
}

if (dangerState.type === 'toggleFaqStatus') {
  const result = await toggleFaqStatusSafe({
    faqId: dangerState.faq.id,
    nextStatus: dangerState.nextStatus,
    reason
  });

  if (!result.ok) {
    ctx.notificationApi.error({
      message:
        dangerState.nextStatus === '공개'
          ? 'FAQ 공개 전환 실패'
          : 'FAQ 비공개 전환 실패',
  description: buildFaqErrorDescription(result.error.message, result.error.code)
    });
    return;
  }

  ctx.reload();
  ctx.setDangerState(null);
  ctx.notificationApi.success({
    message:
      dangerState.nextStatus === '공개'
        ? 'FAQ 공개 전환 완료'
        : 'FAQ 비공개 전환 완료',
  description: buildFaqAuditNoticeDescription('OperationFaq', result.data.id, [
    `사유/근거: ${reason}`
  ])
  });
  return;
}

if (dangerState.type === 'deleteCuration') {
  const result = await deleteFaqCurationSafe(
    dangerState.curation.id,
    reason
  );
  if (!result.ok) {
    ctx.notificationApi.error({
      message: 'FAQ 노출 삭제 실패',
  description: buildFaqErrorDescription(result.error.message, result.error.code)
    });
    return;
  }

  ctx.closeCurationDrawer();
  ctx.reload();
  ctx.setDangerState(null);
  ctx.notificationApi.success({
    message: 'FAQ 노출 삭제 완료',
  description: buildFaqAuditNoticeDescription('OperationFaqCuration', result.data.id, [
    `사유/근거: ${reason}`
  ])
  });
  return;
}

const result = await saveFaqCurationSafe({
  id: dangerState.curation.id,
  faqId: dangerState.curation.faqId,
  surface: dangerState.curation.surface,
  curationMode: dangerState.curation.curationMode,
  displayRank: dangerState.curation.displayRank,
  exposureStatus: dangerState.nextStatus,
  pinnedStartAt: dangerState.curation.pinnedStartAt,
  pinnedEndAt: dangerState.curation.pinnedEndAt,
  reason
});

if (!result.ok) {
  ctx.notificationApi.error({
    message:
      dangerState.nextStatus === 'active'
        ? 'FAQ 노출 재개 실패'
        : 'FAQ 노출 일시중지 실패',
  description: buildFaqErrorDescription(result.error.message, result.error.code)
  });
  return;
}

ctx.reload();
ctx.setDangerState(null);
ctx.notificationApi.success({
  message:
    dangerState.nextStatus === 'active'
      ? 'FAQ 노출 재개 완료'
      : 'FAQ 노출 일시중지 완료',
  description: buildFaqAuditNoticeDescription('OperationFaqCuration', result.data.id, [
    `사유/근거: ${reason}`
  ])
});
}
