import type { SystemAuditLogRow } from '../model/system-log-types';

const systemAuditLogs: SystemAuditLogRow[] = [
  {
    logId: 'AL-10001',
    targetType: 'Users',
    targetId: 'U00001',
    action: '계정 정지',
    actor: 'admin_park',
    reason: '정책 위반 반복',
    createdAt: '2026-03-27 09:42:10'
  },
  {
    logId: 'AL-10002',
    targetType: 'Commerce',
    targetId: 'RF-002',
    action: '환불 승인',
    actor: 'admin_kim',
    reason: '서비스 미이용 확인',
    createdAt: '2026-03-27 10:15:02'
  },
  {
    logId: 'AL-10003',
    targetType: 'Community',
    targetId: 'POST-002',
    action: '게시글 숨김',
    actor: 'admin_lee',
    reason: '정책 위반 콘텐츠',
    createdAt: '2026-03-27 10:33:51'
  },
  {
    logId: 'AL-10004',
    targetType: 'Message',
    targetId: 'MAIL-AUTO-001',
    action: '메일 발송',
    actor: 'admin_han',
    reason: '봄 시즌 뉴스레터 발송',
    createdAt: '2026-03-27 17:15:00'
  }
];

export function createMockSystemAuditLogs(): SystemAuditLogRow[] {
  return systemAuditLogs.map((log) => ({ ...log }));
}
