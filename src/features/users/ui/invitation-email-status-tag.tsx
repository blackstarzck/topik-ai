import { Tag, Tooltip } from 'antd';

import type { InstitutionInvitation } from '../model/institution-codes-types';

/**
 * 기관 초대 안내 이메일의 발송 상태 태그.
 * - pending: 대기열에 있음(즉시 kick 실패 시에도 cron 이 최대 15분 내 수거)
 * - sent: SMTP 발송 완료
 * - failed: 재시도 소진 — 오류를 툴팁으로 노출(관리자 대응: 취소 후 재초대 또는 인앱만 활용)
 * - skipped/null: 표시 생략(응답·취소로 회수됐거나 attempt 없음)
 */
export function InvitationEmailStatusTag({
  invitation
}: {
  invitation: InstitutionInvitation;
}): JSX.Element | null {
  switch (invitation.emailStatus) {
    case 'pending':
      return <Tag style={{ marginInlineEnd: 0 }}>이메일 대기</Tag>;
    case 'sent':
      return (
        <Tag color="green" style={{ marginInlineEnd: 0 }}>
          이메일 발송됨
        </Tag>
      );
    case 'failed':
      return (
        <Tooltip title={invitation.emailError || '발송 실패'}>
          <Tag color="red" style={{ marginInlineEnd: 0 }}>
            이메일 실패
          </Tag>
        </Tooltip>
      );
    default:
      return null;
  }
}
