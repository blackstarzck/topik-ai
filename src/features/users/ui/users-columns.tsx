import { Tag } from 'antd';
import type { TableColumnsType } from 'antd';

import {
  getTermsConsentDisplayStatus,
  getUserMembershipStatus
} from '../model/registration-status';
import { toUserGenderFilter } from '../model/user-export-filter';
import {
  emptyProfileValue,
  toFilteredValue,
  userConsentStatusFilterValues,
  userEmailVerificationFilterValues,
  userGenderFilterValues,
  userMembershipStatusFilterValues,
  userSubscriptionStatusFilterValues,
  userTierFilterValues
} from '../model/users-page-schema';
import type {
  EmailVerificationStatus,
  SubscriptionStatus,
  TermsConsentDisplayStatus,
  UserGenderFilter,
  UserMembershipStatus,
  UserSummary,
  UserTier
} from '../model/types';
import { formatNationality } from '@/shared/model/country-name';
import { SocialProviderTags } from '@/shared/ui/social-provider/social-provider-tags';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';
import { TableActionMenu } from '@/shared/ui/table/table-action-menu';
import { UserNavigationLink } from '@/shared/ui/user/user-reference';

// 회원 목록 컬럼 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// URL 필터 상태와 조치 핸들러는 페이지가 소유하고 인자로 받는다.

function renderProfileValue(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed : emptyProfileValue;
}

function renderMembershipStatus(user: UserSummary) {
  return <StatusBadge status={getUserMembershipStatus(user)} />;
}

function renderTermsConsentStatus(user: UserSummary) {
  return <StatusBadge status={getTermsConsentDisplayStatus(user)} />;
}

export type UsersColumnsOptions = {
  genderFilters: UserGenderFilter[];
  tierFilters: UserTier[];
  subscriptionStatusFilters: SubscriptionStatus[];
  membershipStatusFilters: UserMembershipStatus[];
  termsConsentStatusFilters: TermsConsentDisplayStatus[];
  emailVerificationStatusFilters: EmailVerificationStatus[];
  onSuspend: (user: UserSummary) => void;
  onUnsuspend: (user: UserSummary) => void;
  onMemoOpen: (user: UserSummary) => void;
};

export function createUsersColumns({
  genderFilters,
  tierFilters,
  subscriptionStatusFilters,
  membershipStatusFilters,
  termsConsentStatusFilters,
  emailVerificationStatusFilters,
  onSuspend,
  onUnsuspend,
  onMemoOpen
}: UsersColumnsOptions): TableColumnsType<UserSummary> {
  return [
  {
    title: '회원',
    key: 'user',
    width: 220,
    sorter: createTextSorter((record) => `${record.realName} ${record.id}`),
    render: (_, record) => (
      <UserNavigationLink
        stopPropagation
        withId={false}
        userId={record.id}
        userName={renderProfileValue(record.realName)}
      />
    )
  },
  {
    title: '이메일',
    dataIndex: 'email',
    width: 220,
    sorter: createTextSorter((record) => record.email)
  },
  {
    title: '닉네임',
    dataIndex: 'nickname',
    width: 160,
    render: (value: string) => renderProfileValue(value),
    sorter: createTextSorter((record) => record.nickname)
  },
  {
    title: '성별',
    dataIndex: 'gender',
    key: 'gender',
    width: 110,
    ...createDefinedColumnFilterProps(
      userGenderFilterValues,
      (record) => toUserGenderFilter(record.gender)
    ),
    filteredValue: toFilteredValue(genderFilters),
    render: (value: string) => renderProfileValue(value),
    sorter: createTextSorter((record) => record.gender)
  },
  {
    title: '국적',
    dataIndex: 'nationalityCode',
    width: 150,
    render: (_: string, record) =>
      renderProfileValue(formatNationality(record.nationalityCode)),
    sorter: createTextSorter((record) => formatNationality(record.nationalityCode))
  },
  {
    title: '소셜 로그인',
    dataIndex: 'socialProviders',
    key: 'socialProviders',
    width: 170,
    render: (_: string[], record) => (
      <SocialProviderTags providers={record.socialProviders} />
    )
  },
  {
    title: '기관 소속',
    dataIndex: 'affiliationLabel',
    key: 'affiliation',
    width: 200,
    render: (_: string, record) =>
      record.affiliationCode ? (
        <Tag color="blue">{record.affiliationLabel || record.affiliationCode}</Tag>
      ) : (
        emptyProfileValue
      ),
    sorter: createTextSorter(
      (record) => record.affiliationLabel || record.affiliationCode
    )
  },
  {
    // 개인정보 표시제한 — 목록에는 마스킹값(phoneMasked)만 렌더한다. 원문은 상세
    // 단건 조회와 내보내기(원문 포함 선택, 감사 기록)로만 접근한다.
    title: '전화번호',
    dataIndex: 'phoneMasked',
    width: 150,
    render: (value: string) => renderProfileValue(value),
    sorter: createTextSorter((record) => record.phoneMasked)
  },
  {
    title: '가입일',
    dataIndex: 'joinedAt',
    width: 160,
    // 기본 노출 순서 = 최근 가입자가 위로(내림차순). joinedAt이 분 단위 문자열이라
    // 같은 날짜라도 가입 시각까지 비교해 정확히 정렬된다.
    defaultSortOrder: 'descend',
    sorter: createTextSorter((record) => record.joinedAt)
  },
  {
    title: '최근 접속',
    dataIndex: 'lastLoginAt',
    width: 160,
    sorter: createTextSorter((record) => record.lastLoginAt)
  },
  {
    title: '등급',
    dataIndex: 'tier',
    key: 'tier',
    width: 120,
    ...createDefinedColumnFilterProps(userTierFilterValues, (record) => record.tier),
    filteredValue: toFilteredValue(tierFilters),
    sorter: createTextSorter((record) => record.tier)
  },
  {
    title: createStatusColumnTitle('구독 상태', ['구독', '미구독']),
    dataIndex: 'subscriptionStatus',
    key: 'subscriptionStatus',
    width: 120,
    ...createDefinedColumnFilterProps(
      userSubscriptionStatusFilterValues,
      (record) => record.subscriptionStatus
    ),
    filteredValue: toFilteredValue(subscriptionStatusFilters),
    sorter: createTextSorter((record) => record.subscriptionStatus)
  },
  {
    title: createStatusColumnTitle('회원 상태', userMembershipStatusFilterValues),
    dataIndex: 'status',
    key: 'membershipStatus',
    width: 150,
    ...createDefinedColumnFilterProps(
      userMembershipStatusFilterValues,
      (record) => getUserMembershipStatus(record)
    ),
    filteredValue: toFilteredValue(membershipStatusFilters),
    sorter: createTextSorter((record) => getUserMembershipStatus(record)),
    render: (_, record) => renderMembershipStatus(record)
  },
  {
    title: createStatusColumnTitle('약관 동의', userConsentStatusFilterValues),
    dataIndex: 'termsConsentStatus',
    key: 'termsConsentStatus',
    width: 130,
    ...createDefinedColumnFilterProps(
      userConsentStatusFilterValues,
      (record) => getTermsConsentDisplayStatus(record)
    ),
    filteredValue: toFilteredValue(termsConsentStatusFilters),
    sorter: createTextSorter((record) => getTermsConsentDisplayStatus(record)),
    render: (_, record) => renderTermsConsentStatus(record)
  },
  {
    title: createStatusColumnTitle('이메일 인증', ['인증 완료', '미인증']),
    dataIndex: 'emailVerificationStatus',
    key: 'emailVerificationStatus',
    width: 130,
    ...createDefinedColumnFilterProps(
      userEmailVerificationFilterValues,
      (record) => record.emailVerificationStatus
    ),
    filteredValue: toFilteredValue(emailVerificationStatusFilters),
    sorter: createTextSorter((record) => record.emailVerificationStatus),
    render: (emailVerificationStatus: EmailVerificationStatus) => (
      <StatusBadge status={emailVerificationStatus} />
    )
  },
  {
    title: '액션',
    key: 'actions',
    width: 140,
    onCell: () => ({
      onClick: (event) => {
        event.stopPropagation();
      }
    }),
    render: (_, record) => (
      <TableActionMenu
        items={[
          {
            key: `suspend-${record.id}`,
            label: '회원 정지',
            danger: true,
            disabled: record.status !== '정상',
            onClick: () => onSuspend(record)
          },
          {
            key: `unsuspend-${record.id}`,
            label: '회원 정지 해제',
            disabled: record.status !== '정지',
            onClick: () => onUnsuspend(record)
          },
          {
            key: `memo-${record.id}`,
            label: '관리자 메모 작성',
            onClick: () => onMemoOpen(record)
          }
        ]}
      />
    )
  }
];
}
