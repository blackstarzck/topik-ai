import { Descriptions, Space, Tag, Typography } from 'antd';

import { renderProfileValue } from '../model/user-detail-page-schema';
import type { UserLegalConsent } from '../api/users-service';
import type { UserStatus, UserSummary } from '../model/types';
import { formatNationality } from '@/shared/model/country-name';
import { SocialProviderTags } from '@/shared/ui/social-provider/social-provider-tags';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import {
  renderMembershipStatus,
  renderTermsConsentDate,
  renderTermsConsentStatus
} from './user-detail-columns';

// 프로필 탭 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).

export type UserDetailProfileTabProps = {
  user: UserSummary;
  currentStatus: UserStatus;
  legalConsents: UserLegalConsent[];
};

export function UserDetailProfileTab({
  user,
  currentStatus,
  legalConsents
}: UserDetailProfileTabProps): JSX.Element {
  return (
    <Descriptions
      bordered
      column={2}
      items={[
        { key: 'id', label: '사용자 ID', children: user.id },
        {
          key: 'realName',
          label: '이름',
          children: renderProfileValue(user.realName)
        },
        { key: 'email', label: '이메일', children: user.email },
    {
      // 단건 상세는 업무상 원문(phone) 표시 — 목록은 마스킹만. 원문이 없으면
      // (구버전 RPC 폴백 등) 마스킹값으로, 그것도 없으면 '-' 로 렌더한다.
      key: 'phone',
      label: '전화번호',
      children: renderProfileValue(user.phone ?? user.phoneMasked)
    },
    { key: 'nickname', label: '닉네임', children: renderProfileValue(user.nickname) },
    { key: 'gender', label: '성별', children: renderProfileValue(user.gender) },
    {
      key: 'nationality',
      label: '국적',
      children: renderProfileValue(formatNationality(user.nationalityCode))
    },
    {
      key: 'socialProviders',
      label: '소셜 로그인',
      children: <SocialProviderTags providers={user.socialProviders} />
    },
    { key: 'joinedAt', label: '가입일', children: user.joinedAt },
    { key: 'lastLoginAt', label: '최근 로그인', children: user.lastLoginAt },
    {
      key: 'status',
      label: '회원 상태',
      children: renderMembershipStatus(currentStatus, user)
    },
    {
      key: 'emailVerification',
      label: '이메일 인증',
      children: <StatusBadge status={user.emailVerificationStatus} />
    },
    { key: 'tier', label: '회원 등급', children: user.tier },
    {
      key: 'subscriptionStatus',
      label: '구독 상태',
      children: user.subscriptionStatus
    },
    {
      key: 'termsConsentStatus',
      label: '약관 동의',
      children: renderTermsConsentStatus(user)
    },
    {
      key: 'termsConsentAt',
      label: '약관 동의일',
      children: renderTermsConsentDate(user)
    },
    {
      key: 'legalConsentVersions',
      label: '동의한 약관 버전',
      span: 2,
      children:
        legalConsents.length > 0 ? (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {legalConsents.map((consent) => (
              <span key={consent.docType}>
                <Typography.Text strong>{consent.docLabel}</Typography.Text>{' '}
                <Tag>{consent.version}</Tag>
                {consent.isCurrent ? (
                  <Tag color="green">최신</Tag>
                ) : (
                  <Tag color="orange">구버전(재동의 필요)</Tag>
                )}{' '}
                <Typography.Text type="secondary">
                  {consent.acceptedAt} · {consent.source}
                </Typography.Text>
              </span>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">
            표시할 동의 버전 정보가 없습니다.
          </Typography.Text>
        )
    }
  ]}
/>
  );
}
