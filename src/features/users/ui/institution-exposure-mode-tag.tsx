import { Space, Tag, Typography } from 'antd';

import type { InstitutionExposureMode } from '../model/institution-codes-types';
import { FONT_SIZE } from '@/shared/styles/design-tokens';

const { Text } = Typography;

/**
 * 기관 노출 모드 Tag.
 *
 * 공용 `StatusBadge` 의 전역 색 사전을 쓰지 않는 이유: `제한 없음` 은 쿠폰 무제한·이벤트
 * 참여 제한처럼 이 저장소의 다른 도메인에서 이미 "무제한"이라는 다른 뜻으로 쓰이는 일반
 * 한국어 구절이다. 전역 사전은 라벨 문자열이 곧 키라서, 등록하면 "이 문자열은 전역적으로
 * 기관 노출 모드다"라고 선언하는 셈이 된다. 같은 폴더의 invitation-email-status-tag 선례를
 * 따라 이 도메인 전용 Tag 로 둔다.
 *
 * 색은 옆 `상태` 컬럼(활성=green / 종료=default)과 축이 구분되도록 파랑/보라를 쓴다.
 * 초록·빨강은 정책 선택에 도덕적 색을 입히므로 피한다.
 */
const MODE_COLOR: Record<InstitutionExposureMode, string> = {
  '제한 없음': 'blue',
  배정분만: 'purple'
};

type Props = {
  mode: InstitutionExposureMode;
  /**
   * 배정 건수. 모드와 무관하게 보존되므로 `제한 없음` 일 때는 "보존" 임을 함께 밝힌다.
   * 생략하면 Tag 만 렌더한다(모달 헤더처럼 건수를 이미 다른 곳에서 보여주는 자리).
   */
  assignedQuestionCount?: number;
};

export function InstitutionExposureModeTag({
  mode,
  assignedQuestionCount
}: Props): JSX.Element {
  const caption =
    assignedQuestionCount === undefined
      ? null
      : mode === '제한 없음'
        ? assignedQuestionCount > 0
          ? `배정 ${assignedQuestionCount.toLocaleString()}건 보존`
          : null
        : `배정 ${assignedQuestionCount.toLocaleString()}건`;

  return (
    <Space size={6} wrap>
      <Tag color={MODE_COLOR[mode]}>{mode}</Tag>
      {caption ? (
        <Text type="secondary" style={{ fontSize: FONT_SIZE.base }}>
          {caption}
        </Text>
      ) : null}
    </Space>
  );
}
