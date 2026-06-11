import type { SystemLogRow } from '../model/system-log-types';

const systemLogs: SystemLogRow[] = [
  {
    id: 'SYS-001',
    level: 'INFO',
    component: 'notification-worker',
    message: 'dispatch batch completed',
    createdAt: '2026-03-11 09:11:42'
  },
  {
    id: 'SYS-002',
    level: 'WARN',
    component: 'billing-sync',
    message: 'payment webhook delayed',
    createdAt: '2026-03-11 09:47:03'
  },
  {
    id: 'SYS-003',
    level: 'ERROR',
    component: 'community-service',
    message: 'report queue retry limit reached',
    createdAt: '2026-03-11 10:02:19'
  },
  {
    id: 'SYS-004',
    level: 'ERROR',
    component: 'admin-auth',
    message: 'temporary token validation failed',
    createdAt: '2026-03-11 10:38:11'
  }
];

export function createMockSystemLogs(): SystemLogRow[] {
  return systemLogs.map((log) => ({ ...log }));
}
