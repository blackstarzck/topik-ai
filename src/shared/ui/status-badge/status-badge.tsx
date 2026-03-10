import { Tag } from 'antd';

const colorMap: Record<string, string> = {
  정상: 'green',
  정지: 'volcano',
  탈퇴: 'default',
  게시: 'green',
  숨김: 'orange',
  완료: 'blue',
  취소: 'default',
  환불: 'purple',
  '처리 대기': 'gold',
  '처리 완료': 'blue',
  활성: 'green',
  비활성: 'default',
  사용중: 'green',
  초안: 'gold',
  성공: 'green',
  '부분 실패': 'orange',
  실패: 'volcano',
  예약: 'cyan',
  대기: 'gold'
};

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  return <Tag color={colorMap[status] ?? 'default'}>{status}</Tag>;
}
