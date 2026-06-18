export type SystemLogLevel = 'INFO' | 'WARN' | 'ERROR';

export type SystemLogRow = {
  id: string;
  level: SystemLogLevel;
  component: string;
  message: string;
  traceId?: string;
  context?: unknown;
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
  // Sensitive change detail. Returned by the read RPC only to platform_admin;
  // undefined for other admins (server-side gated) and for mock rows.
  diff?: unknown;
  payload?: unknown;
};
