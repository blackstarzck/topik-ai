import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AdminShell } from '../../shared/layout/admin-shell';

const DashboardPage = lazy(
  () => import('../../features/dashboard/pages/dashboard-page')
);
const UsersPage = lazy(() => import('../../features/users/pages/users-page'));
const InstructorManagementPage = lazy(
  () => import('../../features/users/pages/instructor-management-page')
);
const UserDetailPage = lazy(
  () => import('../../features/users/pages/user-detail-page')
);
const CommunityPostsPage = lazy(
  () => import('../../features/community/pages/community-posts-page')
);
const CommunityReportsPage = lazy(
  () => import('../../features/community/pages/community-reports-page')
);
const MessageMailPage = lazy(
  () => import('../../features/message/pages/message-mail-page')
);
const MessagePushPage = lazy(
  () => import('../../features/message/pages/message-push-page')
);
const MessageGroupsPage = lazy(
  () => import('../../features/message/pages/message-groups-page')
);
const MessageHistoryPage = lazy(
  () => import('../../features/message/pages/message-history-page')
);
const OperationNoticesPage = lazy(
  () => import('../../features/operation/pages/operation-notices-page')
);
const OperationFaqPage = lazy(
  () => import('../../features/operation/pages/operation-faq-page')
);
const BillingPaymentsPage = lazy(
  () => import('../../features/billing/pages/billing-payments-page')
);
const BillingRefundsPage = lazy(
  () => import('../../features/billing/pages/billing-refunds-page')
);
const AnalyticsOverviewPage = lazy(
  () => import('../../features/analytics/pages/analytics-overview-page')
);
const SystemAdminsPage = lazy(
  () => import('../../features/system/pages/system-admins-page')
);
const SystemPermissionsPage = lazy(
  () => import('../../features/system/pages/system-permissions-page')
);
const SystemAuditLogsPage = lazy(
  () => import('../../features/system/pages/system-audit-logs-page')
);
const SystemLogsPage = lazy(
  () => import('../../features/system/pages/system-logs-page')
);
const AdminPlaceholderPage = lazy(
  () => import('../../shared/ui/placeholder-page/admin-placeholder-page')
);
const NotFoundPage = lazy(
  () => import('../../shared/ui/not-found/not-found-page')
);

export function AppRouter(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<AdminShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/:userId" element={<UserDetailPage />} />
        <Route path="/users/groups" element={<InstructorManagementPage />} />
        <Route
          path="/users/referrals"
          element={
            <AdminPlaceholderPage
              title="추천인 관리"
              summary="추천 관계와 추천 보상 규칙을 운영하기 위한 화면 자리입니다."
              ownerRole="OPS_ADMIN"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '추천인 코드/링크 조회',
                '추천 실적과 보상 내역 검수',
                '추천 정책 변경 이력 관리'
              ]}
            />
          }
        />

        <Route path="/community/posts" element={<CommunityPostsPage />} />
        <Route path="/community/reports" element={<CommunityReportsPage />} />

        <Route path="/messages/mail" element={<MessageMailPage />} />
        <Route path="/messages/push" element={<MessagePushPage />} />
        <Route path="/messages/groups" element={<MessageGroupsPage />} />
        <Route path="/messages/history" element={<MessageHistoryPage />} />

        <Route path="/operation/notices" element={<OperationNoticesPage />} />
        <Route path="/operation/faq" element={<OperationFaqPage />} />
        <Route
          path="/operation/events"
          element={
            <AdminPlaceholderPage
              title="이벤트"
              summary="이벤트 페이지, 참여 조건, 노출 상태를 운영하기 위한 화면 자리입니다."
              ownerRole="OPS_ADMIN"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '이벤트 메타데이터 관리',
                '노출 기간과 대상 설정',
                '메시지/커머스와의 연동 계획 정리'
              ]}
            />
          }
        />
        <Route
          path="/operation/chatbot"
          element={
            <AdminPlaceholderPage
              title="챗봇 설정"
              summary="운영 챗봇의 시나리오와 연결 정책을 정의할 수 있도록 준비한 자리입니다."
              ownerRole="OPS_ADMIN"
              supportingRoles={['SUPER_ADMIN', 'CONTENT_MANAGER']}
              capabilities={[
                '시나리오 버전 관리',
                '유입 채널별 응답 정책',
                '상담 전환 조건과 로그 추적'
              ]}
              notes={[
                '기능 정의가 아직 부족해 설정 중심 placeholder로 시작합니다.'
              ]}
            />
          }
        />

        <Route path="/commerce/payments" element={<BillingPaymentsPage />} />
        <Route path="/commerce/refunds" element={<BillingRefundsPage />} />
        <Route
          path="/commerce/coupons"
          element={
            <AdminPlaceholderPage
              title="쿠폰 관리"
              summary="쿠폰 정책, 발급 상태, 사용 조건을 관리하기 위한 화면 자리입니다."
              ownerRole="OPS_ADMIN"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '쿠폰 생성 및 만료 정책 설정',
                '대상 그룹/회원 연결',
                '사용량과 중복 사용 검수'
              ]}
            />
          }
        />
        <Route
          path="/commerce/points"
          element={
            <AdminPlaceholderPage
              title="포인트 관리"
              summary="포인트 적립/차감 정책과 운영 이력을 관리하기 위한 자리입니다."
              ownerRole="OPS_ADMIN"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '포인트 정책 정의',
                '회원별 포인트 이력 검수',
                '수동 차감 및 보정 플로우 설계'
              ]}
            />
          }
        />
        <Route
          path="/commerce/store"
          element={
            <AdminPlaceholderPage
              title="이커머스 관리"
              summary="상품과 패키지 판매 운영을 위한 화면 자리입니다."
              ownerRole="OPS_ADMIN"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '상품/패키지 카탈로그 관리',
                '판매 상태 및 노출 제어',
                '쿠폰/포인트 정책과 연결'
              ]}
            />
          }
        />

        <Route
          path="/assessment/question-bank"
          element={
            <AdminPlaceholderPage
              title="문제은행"
              summary="문항 풀과 출제 기준을 관리하기 위한 Assessment 모듈의 시작점입니다."
              ownerRole="CONTENT_MANAGER"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '문항 카테고리/난이도 관리',
                '문항 검수 상태와 버전 관리',
                '시험 세트와의 연결'
              ]}
            />
          }
        />
        <Route
          path="/assessment/question-bank/eps-topik"
          element={
            <AdminPlaceholderPage
              title="EPS TOPIK"
              summary="EPS TOPIK 전용 문제 세트와 운영 구성을 관리하기 위한 하위 자리입니다."
              ownerRole="CONTENT_MANAGER"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '시험 회차별 세트 관리',
                '문항 배정과 노출 설정',
                '시험 템플릿 운영 규칙 정의'
              ]}
            />
          }
        />
        <Route
          path="/assessment/level-tests"
          element={
            <AdminPlaceholderPage
              title="레벨 테스트"
              summary="레벨 테스트 구성과 평가 기준을 관리하는 자리입니다."
              ownerRole="CONTENT_MANAGER"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '레벨 테스트 세트 관리',
                '배점/결과 정책 설정',
                '콘텐츠 추천과의 연결'
              ]}
            />
          }
        />

        <Route
          path="/content/library"
          element={
            <AdminPlaceholderPage
              title="콘텐츠 관리"
              summary="콘텐츠 카탈로그와 운영 메타데이터를 관리하기 위한 Content 모듈의 시작점입니다."
              ownerRole="CONTENT_MANAGER"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '콘텐츠 상태/분류 관리',
                '운영 노출 메타데이터 편집',
                '하위 콘텐츠 도메인 진입 허브'
              ]}
            />
          }
        />
        <Route
          path="/content/badges"
          element={
            <AdminPlaceholderPage
              title="배지"
              summary="배지 정의와 노출 규칙을 관리하기 위한 자리입니다."
              ownerRole="CONTENT_MANAGER"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '배지 유형/등급 관리',
                '획득 조건 정의',
                '회원 노출 규칙과 연결'
              ]}
            />
          }
        />
        <Route
          path="/content/vocabulary"
          element={
            <AdminPlaceholderPage
              title="단어장"
              summary="단어장 카테고리와 학습 항목을 관리하는 기본 자리입니다."
              ownerRole="CONTENT_MANAGER"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '단어장 카테고리 관리',
                '학습 항목 메타데이터 편집',
                '하위 콘텐츠 타입 진입 허브'
              ]}
            />
          }
        />
        <Route
          path="/content/vocabulary/sonagi"
          element={
            <AdminPlaceholderPage
              title="소나기"
              summary="단어장 하위의 소나기 콘텐츠 유형을 위한 자리입니다."
              ownerRole="CONTENT_MANAGER"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '콘텐츠 템플릿 관리',
                '출제/노출 규칙 정의',
                '단어장 카테고리와 연동'
              ]}
            />
          }
        />
        <Route
          path="/content/vocabulary/multiple-choice"
          element={
            <AdminPlaceholderPage
              title="객관식 선택"
              summary="단어장 하위의 객관식 선택 콘텐츠 유형을 위한 자리입니다."
              ownerRole="CONTENT_MANAGER"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '보기 구성 관리',
                '정답 및 피드백 규칙 정의',
                '콘텐츠 검수 흐름 반영'
              ]}
            />
          }
        />
        <Route
          path="/content/missions"
          element={
            <AdminPlaceholderPage
              title="학습 미션"
              summary="학습 미션과 보상 규칙을 관리하기 위한 자리입니다."
              ownerRole="CONTENT_MANAGER"
              supportingRoles={['SUPER_ADMIN']}
              capabilities={[
                '미션 정의와 활성화 상태 관리',
                '보상/배지 연결',
                '회원 도달률과 운영 메모 추적'
              ]}
            />
          }
        />

        <Route path="/analytics/overview" element={<AnalyticsOverviewPage />} />

        <Route path="/system/admins" element={<SystemAdminsPage />} />
        <Route path="/system/permissions" element={<SystemPermissionsPage />} />
        <Route path="/system/audit-logs" element={<SystemAuditLogsPage />} />
        <Route path="/system/logs" element={<SystemLogsPage />} />

        <Route
          path="/notification/send"
          element={<Navigate to="/messages/mail?tab=manual" replace />}
        />
        <Route
          path="/notification/history"
          element={<Navigate to="/messages/history?channel=mail" replace />}
        />
        <Route
          path="/billing/payments"
          element={<Navigate to="/commerce/payments" replace />}
        />
        <Route
          path="/billing/refunds"
          element={<Navigate to="/commerce/refunds" replace />}
        />
        <Route
          path="/commerce"
          element={<Navigate to="/commerce/payments" replace />}
        />
        <Route
          path="/assessment"
          element={<Navigate to="/assessment/question-bank" replace />}
        />
        <Route
          path="/content"
          element={<Navigate to="/content/library" replace />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
