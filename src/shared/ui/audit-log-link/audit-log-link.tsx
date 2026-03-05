import { Link } from 'react-router-dom';

type AuditLogLinkProps = {
  targetType: string;
  targetId: string;
  label?: string;
};

export function AuditLogLink({
  targetType,
  targetId,
  label
}: AuditLogLinkProps): JSX.Element {
  const query = new URLSearchParams({
    targetType,
    targetId
  }).toString();

  return (
    <Link to={`/system/audit-logs?${query}`}>
      {label ?? '감사 로그 확인'}
    </Link>
  );
}

