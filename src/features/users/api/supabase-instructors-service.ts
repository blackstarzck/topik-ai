import type {
  InstructorActivityStatus,
  InstructorAssignmentStatus,
  InstructorCountry,
  InstructorCourseSummary,
  InstructorDetail,
  InstructorMessageHistory,
  InstructorOrganization,
  InstructorStatus
} from '../model/types';
import { requireClient, requireReason, throwIfAborted } from '@/shared/api/supabase-service-utils';

/**
 * Users > 강사 관리 Supabase 어댑터.
 * admin_list_instructors(전체 상세)/admin_get_instructor/admin_set_instructor_status RPC를
 * 호출하고 결과를 화면 모델(InstructorDetail)로 매핑한다. 모든 RPC는 private.is_admin 가드.
 */
type InstructorRow = {
  id: string;
  real_name: string;
  email: string;
  nickname: string;
  organization: string;
  country: string;
  status: string;
  activity_status: string;
  assignment_status: string;
  course_count: number | null;
  student_count: number | null;
  last_activity_at: string | null;
  last_action_at: string | null;
  message_group_id: string | null;
  message_group_name: string | null;
  specialties: unknown;
  introduction: string | null;
  assigned_courses: unknown;
  recent_messages: unknown;
  admin_notes: unknown;
};

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function mapInstructorRow(row: InstructorRow): InstructorDetail {
  return {
    id: row.id,
    realName: row.real_name,
    email: row.email,
    nickname: row.nickname,
    organization: row.organization as InstructorOrganization,
    country: row.country as InstructorCountry,
    status: row.status as InstructorStatus,
    activityStatus: row.activity_status as InstructorActivityStatus,
    assignmentStatus: row.assignment_status as InstructorAssignmentStatus,
    courseCount: row.course_count ?? 0,
    studentCount: row.student_count ?? 0,
    lastActivityAt: row.last_activity_at ?? '',
    lastActionAt: row.last_action_at ?? '',
    messageGroupId: row.message_group_id ?? '',
    messageGroupName: row.message_group_name ?? '',
    specialties: asArray(row.specialties).map((item) => String(item)),
    introduction: row.introduction ?? '',
    assignedCourses: asArray(row.assigned_courses) as InstructorCourseSummary[],
    recentMessages: asArray(row.recent_messages) as InstructorMessageHistory[],
    adminNotes: asArray(row.admin_notes) as InstructorDetail['adminNotes']
  };
}

export async function loadInstructorsFromSupabase(
  signal?: AbortSignal
): Promise<InstructorDetail[]> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_list_instructors', {
    p_search: null,
    p_status: null,
    p_activity_status: null,
    p_organization: null,
    p_country: null
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as InstructorRow[]).map(mapInstructorRow);
}

export async function loadInstructorFromSupabase(
  instructorId: string,
  signal?: AbortSignal
): Promise<InstructorDetail | null> {
  const client = requireClient();
  const { data, error } = await client.rpc('admin_get_instructor', {
    p_instructor_id: instructorId
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as InstructorRow[];
  return rows.length > 0 ? mapInstructorRow(rows[0]) : null;
}

export async function setInstructorStatusViaRpc(
  instructorId: string,
  nextStatus: InstructorStatus,
  reason: string | undefined,
  signal?: AbortSignal
): Promise<InstructorDetail | null> {
  const client = requireClient();
  const confirmedReason = requireReason(reason);
  const { error } = await client.rpc('admin_set_instructor_status', {
    p_instructor_id: instructorId,
    p_status: nextStatus,
    p_reason: confirmedReason
  });

  throwIfAborted(signal);
  if (error) {
    throw new Error(error.message);
  }

  return loadInstructorFromSupabase(instructorId, signal);
}
