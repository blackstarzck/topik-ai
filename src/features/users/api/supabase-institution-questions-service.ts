import { supabaseClient } from '../../../shared/api/supabase-client';
import type {
  InstitutionExposableQuestion,
  InstitutionQuestionMutationResult
} from '../model/institution-questions-types';

/**
 * 기관 중심 노출 문항 Supabase 어댑터. 순환 의존 회피를 위해 assessment facade를
 * 거치지 않고 admin_add/remove/list_institution_writing_questions RPC를 직접 호출한다.
 * 모든 RPC는 private.is_content_admin 가드(platform_admin 포함) + (쓰기) admin_audit_logs.
 */

type ExposableRow = {
  question_id: string;
  item_number: number;
  topic_main: string | null;
  situation_summary: string | null;
  question_type_name: string | null;
  service_status: string | null;
  is_exposed: boolean | null;
};

function requireClient() {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  return supabaseClient;
}

function mapResult(data: unknown): InstitutionQuestionMutationResult {
  const row = (data ?? {}) as Record<string, unknown>;
  const rawDetails = Array.isArray(row.details) ? row.details : [];
  return {
    total: Number(row.total ?? 0),
    changed: Number(row.changed ?? 0),
    unchanged: Number(row.unchanged ?? 0),
    failed: Number(row.failed ?? 0),
    batchId: typeof row.batch_id === 'string' ? row.batch_id : '',
    details: rawDetails.map((entry) => {
      const detail = (entry ?? {}) as Record<string, unknown>;
      return {
        questionId: typeof detail.question_id === 'string' ? detail.question_id : '',
        message: typeof detail.message === 'string' ? detail.message : ''
      };
    })
  };
}

export async function loadInstitutionQuestionsFromSupabase(
  code: string,
  signal?: AbortSignal
): Promise<InstitutionExposableQuestion[]> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_list_institution_writing_questions', {
    p_institution_code: code
  });
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as ExposableRow[]).map((row) => ({
    questionId: row.question_id,
    itemNumber: row.item_number,
    topicMain: row.topic_main ?? '',
    situationSummary: row.situation_summary ?? '',
    questionTypeName: row.question_type_name ?? '',
    serviceStatus: row.service_status ?? '',
    isExposed: row.is_exposed === true
  }));
}

export async function addInstitutionQuestionsViaRpc(
  code: string,
  questionIds: string[],
  reason: string
): Promise<InstitutionQuestionMutationResult> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_add_institution_writing_questions', {
    p_institution_code: code,
    p_question_ids: questionIds,
    p_reason: reason
  });
  if (error) {
    throw new Error(error.message);
  }
  return mapResult(data);
}

export async function removeInstitutionQuestionsViaRpc(
  code: string,
  questionIds: string[],
  reason: string
): Promise<InstitutionQuestionMutationResult> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_remove_institution_writing_questions', {
    p_institution_code: code,
    p_question_ids: questionIds,
    p_reason: reason
  });
  if (error) {
    throw new Error(error.message);
  }
  return mapResult(data);
}
