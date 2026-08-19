import type { V13AppRole } from '../../auth/model/session-types';
import type { RoleKey } from './permission-types';

// 권한 관리 페이지의 라벨·옵션 카탈로그 — Phase 4 분해로 페이지 본문에서 이동(값 동일).

export const appRoleOptions: Array<{
  value: V13AppRole;
  label: string;
  description: string;
}> = [
  {
    value: 'platform_admin',
    label: '플랫폼 관리자',
    description: '전체 관리자 기능과 관리자 app_role 변경 권한'
  },
  {
    value: 'content_admin',
    label: '콘텐츠 관리자',
    description: '콘텐츠·평가 운영 중심 권한'
  },
  {
    value: 'org_admin',
    label: '조직 관리자',
    description: '현재 임시 매핑상 READ_ONLY로 표시'
  }
];

export const roleNameMap: Record<RoleKey, string> = {
  SUPER_ADMIN: '최고 관리자',
  OPS_ADMIN: '운영 관리자',
  CONTENT_MANAGER: '콘텐츠 관리자',
  CS_MANAGER: '고객지원 관리자',
  READ_ONLY: '읽기 전용'
};

export const appRoleLabelMap: Record<V13AppRole, string> = Object.fromEntries(
  appRoleOptions.map((option) => [option.value, option.label])
) as Record<V13AppRole, string>;

export function getRoleLabel(roleKey: RoleKey | null): string {
  return roleKey ? `${roleNameMap[roleKey]} (${roleKey})` : '관리자 접근 없음';
}

export function getStatusLabel(status: string): string {
  if (status === 'active') {
    return '활성';
  }
  if (status === 'invited') {
    return '초대됨';
  }
  if (status === 'suspended') {
    return '정지';
  }
  return status;
}
