export type SystemLogLevel = 'INFO' | 'WARN' | 'ERROR';

export type SystemLogRow = {
  id: string;
  level: SystemLogLevel;
  component: string;
  message: string;
  createdAt: string;
};

export type SystemAuditLogRow = {
  logId: string;
  targetType: string;
  targetId: string;
  targetDisplayName?: string;
  targetUserName?: string;
  action: string;
  actor: string;
  reason: string;
  createdAt: string;
};
