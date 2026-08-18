import type { InstructorDetail, InstructorStatus } from '../model/types';
import { mockInstructors } from './mock-instructors';
import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import { instructorsDataSource } from './instructors-data-source';
import {
  loadInstructorFromSupabase,
  loadInstructorsFromSupabase,
  setInstructorStatusViaRpc
} from './supabase-instructors-service';
import { sleep } from '@/shared/api/supabase-service-utils';

const isSupabaseSource = instructorsDataSource === 'supabase';

/** 강사 관리 화면이 Supabase 실데이터 경로인지(목록/상태변경 분기용). */
export const isInstructorsSupabase = isSupabaseSource;

export type SetInstructorStatusPayload = {
  instructorId: string;
  nextStatus: InstructorStatus;
  reason: string;
};

async function loadInstructors(signal?: AbortSignal): Promise<InstructorDetail[]> {
  if (isSupabaseSource) {
    return loadInstructorsFromSupabase(signal);
  }

  await sleep(320, signal);
  return mockInstructors;
}

async function loadInstructor(
  instructorId: string,
  signal?: AbortSignal
): Promise<InstructorDetail | null> {
  if (isSupabaseSource) {
    return loadInstructorFromSupabase(instructorId, signal);
  }

  await sleep(220, signal);
  return mockInstructors.find((item) => item.id === instructorId) ?? null;
}

async function persistInstructorStatus(
  payload: SetInstructorStatusPayload,
  signal?: AbortSignal
): Promise<InstructorDetail | null> {
  if (isSupabaseSource) {
    return setInstructorStatusViaRpc(
      payload.instructorId,
      payload.nextStatus,
      payload.reason,
      signal
    );
  }

  // mock 경로: 정적 시드라 영속화 없음. 화면이 로컬 상태로 시각 반영한다.
  await sleep(220, signal);
  return mockInstructors.find((item) => item.id === payload.instructorId) ?? null;
}

export function fetchInstructorsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadInstructors(signal), { maxRetries: 1 })
  );
}

export function fetchInstructorSafe(instructorId: string, signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadInstructor(instructorId, signal), { maxRetries: 1 })
  );
}

export function setInstructorStatusSafe(
  payload: SetInstructorStatusPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistInstructorStatus(payload, signal));
}
