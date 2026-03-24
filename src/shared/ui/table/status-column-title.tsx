import { InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';

export type StatusGuideItem = {
  label: string;
  description: string;
};

const statusDescriptionMap: Record<string, string> = {
  정상: '회원이나 계정이 정상적으로 이용 가능한 상태입니다.',
  정지: '운영 조치로 주요 기능이 제한된 상태입니다.',
  탈퇴: '이용이 종료되어 운영 대상에서 제외된 상태입니다.',
  구독: '유효한 구독이 적용된 상태입니다.',
  미구독: '구독이 없거나 종료된 상태입니다.',
  완료: '대상 작업이 정상적으로 끝난 상태입니다.',
  취소: '진행 중이던 작업이나 효력이 취소된 상태입니다.',
  환불: '금액 반환이 반영된 상태입니다.',
  처리대기: '검토나 후속 조치를 기다리는 상태입니다.',
  '처리 대기': '검토나 후속 조치를 기다리는 상태입니다.',
  승인: '요청이 승인되어 반영된 상태입니다.',
  거절: '요청이 반려되어 원안이 유지된 상태입니다.',
  처리완료: '검토와 후속 조치가 모두 끝난 상태입니다.',
  '처리 완료': '검토와 후속 조치가 모두 끝난 상태입니다.',
  게시: '사용자에게 현재 노출 중인 상태입니다.',
  숨김: '사용자 노출이 중단된 상태입니다.',
  활성: '현재 사용 가능하며 운영 대상에 포함된 상태입니다.',
  비활성: '현재 사용이 중지되었거나 운영 대상에서 제외된 상태입니다.',
  초안: '아직 게시나 발송 전에 작성 중인 상태입니다.',
  사용중: '현재 규칙이나 발송 대상에 실제 연결된 상태입니다.',
  성공: '전달 또는 처리에 성공한 상태입니다.',
  부분실패: '일부만 성공하고 일부는 실패한 상태입니다.',
  '부분 실패': '일부만 성공하고 일부는 실패한 상태입니다.',
  실패: '전달 또는 처리에 실패한 상태입니다.',
  예약: '지정한 시각에 처리되도록 대기 중인 상태입니다.',
  공개: '사용자에게 공개된 상태입니다.',
  비공개: '관리자만 보거나 사용자에게 숨긴 상태입니다.',
  '진행 중': '현재 학습자에게 운영 중인 과정 상태입니다.',
  '준비 중': '개설은 되었지만 아직 시작 전인 과정 상태입니다.',
  '종료 예정': '마감 또는 종료를 앞두고 정리 중인 과정 상태입니다.',
  '발송 완료': '메시지 발송 작업이 완료된 상태입니다.',
  주의: '운영 모니터링이 필요한 상태입니다.',
  휴면: '최근 활동이 적어 관리가 필요한 상태입니다.',
  없음: '확인된 이상치가 없는 상태입니다.',
  '검토 필요': '이상 징후가 있어 운영 검토가 필요한 상태입니다.',
  검토필요: '이상 징후가 있어 운영 검토가 필요한 상태입니다.',
  '검토 완료': '이상치 검토가 끝난 상태입니다.',
  검토완료: '이상치 검토가 끝난 상태입니다.',
  대기: '확정이나 정산을 기다리는 상태입니다.',
  INFO: '정상 흐름을 기록한 정보 로그입니다.',
  WARN: '즉시 장애는 아니지만 점검이 필요한 경고 로그입니다.',
  ERROR: '실패나 장애를 기록한 오류 로그입니다.'
};

const tooltipContainerStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  maxWidth: 280
};

const tooltipItemStyle: CSSProperties = {
  display: 'grid',
  gap: 4
};

const tooltipLabelStyle: CSSProperties = {
  color: '#fff',
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  lineHeight: 1.4
};

const tooltipDescriptionStyle: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.72)',
  fontSize: 13,
  lineHeight: 1.5
};

function getStatusDescription(status: string): string {
  return statusDescriptionMap[status] ?? '현재 운영 기준에 따라 표시되는 상태입니다.';
}

function stopHeaderInteraction(
  event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>
): void {
  event.preventDefault();
  event.stopPropagation();
}

function renderTooltipTitle(items: readonly StatusGuideItem[]): JSX.Element {
  return (
    <div style={tooltipContainerStyle}>
      {items.map((item) => (
        <div key={item.label} style={tooltipItemStyle}>
          <strong style={tooltipLabelStyle}>{item.label}</strong>
          <div style={tooltipDescriptionStyle}>{item.description}</div>
        </div>
      ))}
    </div>
  );
}

export function createStatusColumnTitle(
  title: string,
  statuses: readonly string[]
): JSX.Element {
  const items = statuses.map((status) => ({
    label: status,
    description: getStatusDescription(status)
  }));

  return (
    <span
      style={{
        alignItems: 'center',
        display: 'inline-flex',
        gap: 6
      }}
    >
      <span>{title}</span>
      <Tooltip placement="topLeft" title={renderTooltipTitle(items)}>
        <span
          aria-label={`${title} 안내`}
          onClick={stopHeaderInteraction}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              stopHeaderInteraction(event);
            }
          }}
          onMouseDown={stopHeaderInteraction}
          role="button"
          style={{
            color: 'rgba(0, 0, 0, 0.45)',
            cursor: 'help',
            display: 'inline-flex',
            fontSize: 12,
            lineHeight: 1
          }}
          tabIndex={0}
        >
          <InfoCircleOutlined />
        </span>
      </Tooltip>
    </span>
  );
}
