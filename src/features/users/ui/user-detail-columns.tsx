import { Button, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { Link } from 'react-router-dom';

import {
  detailCommunityBoardFilterValues,
  detailCommunityStatusFilterValues,
  detailPaymentStatusFilterValues,
  emptyProfileValue,
  formatElapsedSeconds,
  formatWeaknessLabel,
  learningWeaknessSourceLabels,
  renderProfileValue,
  writingFeedbackStatusLabels
} from '../model/user-detail-page-schema';
import {
  getTermsConsentDisplayStatus,
  getUserMembershipStatus
} from '../model/registration-status';
import type {
  UserActivityEvent,
  UserAdminMemo,
  UserCommunityPost,
  UserPaymentRecord
} from '../api/users-service';
import type { UserLearningOverview, UserStatus, UserSummary } from '../model/types';
import { isSupabaseConfigured } from '@/shared/api/supabase-client';
import { formatWritingDimension } from '@/shared/model/writing-dimension-labels';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import {
  createInfoColumnTitle,
  createStatusColumnTitle
} from '@/shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createNumericTextSorter,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';


// 회원 상세 탭 테이블 컬럼 8종과 상태 렌더 헬퍼 — Phase 4 분해로 이동(동작 동일).

export function renderMembershipStatus(
  status: UserStatus,
  user: Pick<
    UserSummary,
    'emailVerificationStatus' | 'termsConsentStatus' | 'termsConsentAt' | 'registrationStatus'
  >
) {
  const source = { ...user, status };
  return <StatusBadge status={getUserMembershipStatus(source)} />;
}

export function renderTermsConsentStatus(
  user: Pick<UserSummary, 'emailVerificationStatus' | 'termsConsentStatus' | 'termsConsentAt'>
) {
  return <StatusBadge status={getTermsConsentDisplayStatus(user)} />;
}

export function renderTermsConsentDate(
  user: Pick<UserSummary, 'emailVerificationStatus' | 'termsConsentAt'>
) {
  if (user.emailVerificationStatus === '미인증') {
    return emptyProfileValue;
  }
  return renderProfileValue(user.termsConsentAt);
}

export function createUserActivityColumns(): TableColumnsType<UserActivityEvent> {
  return [
  {
    title: '활동 유형',
    dataIndex: 'type',
    width: 160,
    sorter: createTextSorter((record) => record.type)
  },
  {
    title: '참조',
    dataIndex: 'reference',
    width: 160,
    sorter: createTextSorter((record) => record.reference)
  },
  {
    title: '활동 시각',
    dataIndex: 'createdAt',
    width: 200,
    sorter: createTextSorter((record) => record.createdAt)
  }
];
}

export function createUserPaymentColumns(): TableColumnsType<UserPaymentRecord> {
  return [
  {
    title: '결제 ID',
    dataIndex: 'id',
    width: 150,
    sorter: createTextSorter((record) => record.id),
    render: (id: string) => (
      <Link
        className="table-navigation-link"
        to="/commerce/payments"
        onClick={(event) => event.stopPropagation()}
      >
        {id}
      </Link>
    )
  },
  {
    title: '상품',
    dataIndex: 'product',
    sorter: createTextSorter((record) => record.product)
  },
  {
    title: '결제 금액',
    dataIndex: 'amount',
    width: 130,
    sorter: createNumericTextSorter((record) => record.amount)
  },
  {
    title: '결제 수단',
    dataIndex: 'method',
    width: 120,
    sorter: createTextSorter((record) => record.method)
  },
  {
    title: '결제일',
    dataIndex: 'paidAt',
    width: 130,
    sorter: createTextSorter((record) => record.paidAt)
  },
  {
    title: createStatusColumnTitle('상태', ['완료', '환불', '실패', '대기']),
    dataIndex: 'status',
    width: 100,
    ...createDefinedColumnFilterProps(
      detailPaymentStatusFilterValues,
      (record) => record.status
    ),
    sorter: createTextSorter((record) => record.status),
    render: (status: string) => <StatusBadge status={status} />
  }
];
}

export function createUserCommunityColumns(): TableColumnsType<UserCommunityPost> {
  return [
  {
    title: '게시글 ID',
    dataIndex: 'id',
    width: 160,
    sorter: createTextSorter((record) => record.id),
    render: (id: string) => (
      <Link
        className="table-navigation-link"
        to="/community/posts"
        onClick={(event) => event.stopPropagation()}
      >
        {id}
      </Link>
    )
  },
  {
    title: '제목',
    dataIndex: 'title',
    sorter: createTextSorter((record) => record.title)
  },
  {
    title: '게시판',
    dataIndex: 'board',
    width: 120,
    ...createDefinedColumnFilterProps(
      detailCommunityBoardFilterValues,
      (record) => record.board
    ),
    sorter: createTextSorter((record) => record.board)
  },
  {
    title: '작성일',
    dataIndex: 'createdAt',
    width: 120,
    sorter: createTextSorter((record) => record.createdAt)
  },
  {
    title: '신고 수',
    dataIndex: 'reports',
    width: 90,
    sorter: createNumberSorter((record) => record.reports)
  },
  {
    title: createStatusColumnTitle('상태', ['게시', '숨김']),
    dataIndex: 'status',
    width: 110,
    ...createDefinedColumnFilterProps(
      detailCommunityStatusFilterValues,
      (record) => record.status
    ),
    sorter: createTextSorter((record) => record.status),
    render: (status: string) => <StatusBadge status={status} />
  }
];
}

export function createUserMemoColumns({ onDeleteMemo }: { onDeleteMemo: (memo: UserAdminMemo) => void }): TableColumnsType<UserAdminMemo> {
  return [
  {
    title: '메모 ID',
    dataIndex: 'id',
    width: 150,
    sorter: createTextSorter((record) => record.id)
  },
  {
    title: '관리자',
    dataIndex: 'admin',
    width: 130,
    sorter: createTextSorter((record) => record.admin),
    render: (admin: string) => (
      <Link
        className="table-navigation-link"
        to="/system/admins"
        onClick={(event) => event.stopPropagation()}
      >
        {admin}
      </Link>
    )
  },
  {
    title: '내용',
    dataIndex: 'content',
    sorter: createTextSorter((record) => record.content)
  },
  {
    title: '작성일',
    dataIndex: 'createdAt',
    width: 130,
    sorter: createTextSorter((record) => record.createdAt)
  },
  ...(isSupabaseConfigured
    ? [
        {
          title: '관리자 조치',
          key: 'actions',
          width: 110,
          render: (_: unknown, record: UserAdminMemo) => (
            <Button
              size="small"
              danger
              onClick={(event) => {
                event.stopPropagation();
                onDeleteMemo(record);
              }}
            >
              삭제
            </Button>
          )
        }
      ]
    : [])
];
}

export function createLearningQuestionColumns(): TableColumnsType<UserLearningOverview['perQuestion'][number]> {
  return [
  {
    title: '문항',
    dataIndex: 'questionNo',
    width: 90,
    render: (value: number) => `${value}번`
  },
  {
    title: '제출 수',
    dataIndex: 'submissions',
    width: 100,
    sorter: createNumberSorter((record) => record.submissions)
  },
  {
    title: '피드백 완료',
    dataIndex: 'feedbackComplete',
    width: 110,
    sorter: createNumberSorter((record) => record.feedbackComplete)
  },
  {
    title: createInfoColumnTitle(
      '평균 점수(원점)',
      '완료된 피드백의 원점수 평균 / 대표 만점입니다. TOPIK 쓰기는 문항별 만점이 달라(51·52번 10점, 53번 30점, 54번 50점) 문항 간 비교는 100점 환산을 사용하세요.'
    ),
    dataIndex: 'avgScoreRaw',
    width: 140,
    sorter: createNumberSorter((record) => record.avgScoreRaw ?? -1),
    render: (value: number | null, record) =>
      value == null ? '-' : `${value} / ${record.scoreMax ?? '-'}`
  },
  {
    title: createInfoColumnTitle(
      '평균 점수(환산)',
      '점수를 100점 만점으로 정규화한 평균입니다(score_total / score_max × 100). 문항 간 비교 기준.'
    ),
    dataIndex: 'avgScoreNormalized',
    width: 140,
    sorter: createNumberSorter((record) => record.avgScoreNormalized ?? -1),
    render: (value: number | null) => (value == null ? '-' : `${value}점`)
  },
  {
    title: createInfoColumnTitle(
      '평균 소요 시간',
      '문제 화면 진입부터 제출까지의 평균 시간입니다. "미수집"은 소요 시간 수집(2026-07-08) 이전의 제출로 0분과 다릅니다.'
    ),
    dataIndex: 'avgElapsedSeconds',
    width: 130,
    render: (value: number | null, record) =>
      record.metricsCount === 0 ? '미수집' : formatElapsedSeconds(value)
  }
];
}

export function createLearningTagColumns(): TableColumnsType<UserLearningOverview['tagStats'][number]> {
  return [
  {
    title: '태그',
    dataIndex: 'tag',
    sorter: createTextSorter((record) => record.tag)
  },
  {
    title: '제출 수',
    dataIndex: 'submissions',
    width: 110,
    sorter: createNumberSorter((record) => record.submissions)
  },
  {
    title: '평균 점수(환산)',
    dataIndex: 'avgScoreNormalized',
    width: 140,
    sorter: createNumberSorter((record) => record.avgScoreNormalized ?? -1),
    render: (value: number | null) => (value == null ? '-' : `${value}점`)
  }
];
}

export function createLearningWeaknessColumns(): TableColumnsType<UserLearningOverview['weaknesses'][number]> {
  return [
  {
    title: '약점',
    dataIndex: 'label',
    sorter: createTextSorter((record) =>
      record.source === 'writing_dimension'
        ? formatWritingDimension(record.label)
        : formatWeaknessLabel(record.label)
    ),
    render: (value: string, record) =>
      record.source === 'writing_dimension'
        ? formatWritingDimension(value)
        : formatWeaknessLabel(value)
  },
  {
    title: createInfoColumnTitle('출처', [
      {
        label: '태그',
        description:
          '해당 태그 문항의 평균 점수(100점 환산)가 70점 미만이고 제출이 2건 이상일 때 추출한 약점입니다.'
      },
      {
        label: '작문 영역',
        description: '작문 피드백에서 약점으로 표시된 평가 차원입니다.'
      },
      {
        label: '목표',
        description: '회원이 온보딩에서 직접 선택한 관심·약점 영역입니다(실측 근거 아님).'
      }
    ]),
    dataIndex: 'source',
    width: 120,
    render: (value: string) => learningWeaknessSourceLabels[value] ?? value
  },
  {
    title: createInfoColumnTitle(
      '심각도',
      '약점이 얼마나 심각한지를 나타내며 숫자가 클수록 심각합니다. 출처별 산정 기준이 다릅니다 — 태그: 항상 2, 작문 영역: 피드백상 약점 수준(1~4), 목표: 항상 1(자기신고).'
    ),
    dataIndex: 'severity',
    width: 100,
    sorter: createNumberSorter((record) => record.severity)
  },
  {
    title: createInfoColumnTitle(
      '근거 수',
      '이 약점을 뒷받침하는 데이터 개수입니다. 출처별 의미가 다릅니다 — 태그: 해당 태그 제출 수, 작문 영역: 약점으로 잡힌 피드백 수, 목표: 자기신고라 항상 1. 작문 영역은 차원 점수가 있는 제출에서만 계산되므로 표본이 작을 수 있습니다.'
    ),
    dataIndex: 'evidenceCount',
    width: 100,
    sorter: createNumberSorter((record) => record.evidenceCount)
  }
];
}

export function createLearningWritingColumns(): TableColumnsType<UserLearningOverview['recentWriting'][number]> {
  return [
  {
    title: '문항',
    dataIndex: 'questionNo',
    width: 70,
    render: (value: number) => `${value}번`
  },
  {
    title: '문제',
    dataIndex: 'problemTitle',
    ellipsis: true,
    sorter: createTextSorter((record) => record.problemTitle)
  },
  {
    title: '채점 상태',
    dataIndex: 'feedbackStatus',
    width: 100,
    render: (value: string) => writingFeedbackStatusLabels[value] ?? value
  },
  {
    title: '점수(원점)',
    dataIndex: 'scoreTotal',
    width: 100,
    render: (value: number | null, record) =>
      value == null ? '-' : `${value}/${record.scoreMax ?? '-'}`
  },
  {
    title: '환산',
    dataIndex: 'scoreNormalized',
    width: 80,
    sorter: createNumberSorter((record) => record.scoreNormalized ?? -1),
    render: (value: number | null) => (value == null ? '-' : `${value}점`)
  },
  {
    title: createInfoColumnTitle(
      '열람',
      '피드백 화면을 실제로 열어봤는지(study_events feedback_viewed 기준)입니다.'
    ),
    dataIndex: 'viewed',
    width: 80,
    render: (value: boolean) =>
      value ? <Tag color="green">열람</Tag> : <Tag>미열람</Tag>
  },
  {
    title: '소요 시간',
    dataIndex: 'elapsedSeconds',
    width: 110,
    render: (value: number | null) => formatElapsedSeconds(value)
  },
  {
    title: '약점 차원',
    dataIndex: 'weaknessDimensions',
    width: 140,
    render: (value: string[]) =>
      value && value.length ? value.map(formatWritingDimension).join(', ') : '-'
  },
  {
    title: '제출일',
    dataIndex: 'submittedAt',
    width: 140,
    sorter: createTextSorter((record) => record.submittedAt)
  }
];
}
