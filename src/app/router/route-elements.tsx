import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

import type {
  AdminRouteDefinition,
  PageRouteDefinition
} from './routes';

const DashboardPage = lazy(
  () => import('../../features/dashboard/pages/dashboard-page')
);
const UsersPage = lazy(() => import('../../features/users/pages/users-page'));
const InstructorManagementPage = lazy(
  () => import('../../features/users/pages/instructor-management-page')
);
const UsersReferralsPage = lazy(
  () => import('../../features/users/pages/users-referrals-page')
);
const InstitutionCodesPage = lazy(
  () => import('../../features/users/pages/institution-codes-page')
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
const MessageInAppPage = lazy(
  () => import('../../features/message/pages/message-inapp-page')
);
const MessageTemplateCreatePage = lazy(
  () => import('../../features/message/pages/message-template-create-page')
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
const OperationNoticeCreatePage = lazy(
  () => import('../../features/operation/pages/operation-notice-create-page')
);
const OperationFaqPage = lazy(
  () => import('../../features/operation/pages/operation-faq-page')
);
const OperationEventsPage = lazy(
  () => import('../../features/operation/pages/operation-events-page')
);
const OperationPoliciesPage = lazy(
  () => import('../../features/operation/pages/operation-policies-page')
);
const OperationEventCreatePage = lazy(
  () => import('../../features/operation/pages/operation-event-create-page')
);
const OperationPolicyCreatePage = lazy(
  () => import('../../features/operation/pages/operation-policy-create-page')
);
const OperationPdfQuotaPage = lazy(
  () => import('../../features/operation/pages/operation-pdf-quota-page')
);
const BillingPaymentsPage = lazy(
  () => import('../../features/billing/pages/billing-payments-page')
);
const BillingRefundsPage = lazy(
  () => import('../../features/billing/pages/billing-refunds-page')
);
const CommerceCouponsPage = lazy(
  () => import('../../features/commerce/pages/commerce-coupons-page')
);
const CommercePointsPage = lazy(
  () => import('../../features/commerce/pages/commerce-points-page')
);
const CommerceCouponCreatePage = lazy(
  () => import('../../features/commerce/pages/commerce-coupon-create-page')
);
const CommerceCouponTemplateCreatePage = lazy(
  () => import('../../features/commerce/pages/commerce-coupon-template-create-page')
);
// /assessment/question-bank = 조회+관리 통합 페이지(구 목록·관리 합침).
const AssessmentQuestionBankPage = lazy(
  () => import('../../features/assessment/pages/assessment-question-manage-page')
);
const AssessmentQuestionDetailPage = lazy(
  () => import('../../features/assessment/pages/assessment-question-detail-page')
);
const AssessmentImportedTasksPage = lazy(
  () => import('../../features/assessment/pages/assessment-imported-tasks-page')
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
const SystemMetadataPage = lazy(
  () => import('../../features/system/pages/system-metadata-page')
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

function renderPageRouteElement(route: PageRouteDefinition): JSX.Element {
  switch (route.page) {
    case 'dashboard':
      return <DashboardPage />;
    case 'users':
      return <UsersPage />;
    case 'user-detail':
      return <UserDetailPage />;
    case 'instructor-management':
      return <InstructorManagementPage />;
    case 'users-referrals':
      return <UsersReferralsPage />;
    case 'institution-codes':
      return <InstitutionCodesPage />;
    case 'community-posts':
      return <CommunityPostsPage />;
    case 'community-reports':
      return <CommunityReportsPage />;
    case 'message-mail':
      return <MessageMailPage />;
    case 'message-template-create':
      return <MessageTemplateCreatePage channel={route.channel} />;
    case 'message-push':
      return <MessagePushPage />;
    case 'message-inapp':
      return <MessageInAppPage />;
    case 'message-groups':
      return <MessageGroupsPage />;
    case 'message-history':
      return <MessageHistoryPage />;
    case 'operation-notices':
      return <OperationNoticesPage />;
    case 'operation-notice-create':
      return <OperationNoticeCreatePage />;
    case 'operation-faq':
      return <OperationFaqPage />;
    case 'operation-events':
      return <OperationEventsPage />;
    case 'operation-event-create':
      return <OperationEventCreatePage />;
    case 'operation-policies':
      return <OperationPoliciesPage />;
    case 'operation-policy-create':
      return <OperationPolicyCreatePage />;
    case 'operation-pdf-quota':
      return <OperationPdfQuotaPage />;
    case 'billing-payments':
      return <BillingPaymentsPage />;
    case 'billing-refunds':
      return <BillingRefundsPage />;
    case 'commerce-coupons':
      return <CommerceCouponsPage />;
    case 'commerce-coupon-create':
      return <CommerceCouponCreatePage />;
    case 'commerce-coupon-template-create':
      return <CommerceCouponTemplateCreatePage />;
    case 'commerce-points':
      return <CommercePointsPage />;
    case 'assessment-question-bank':
      return <AssessmentQuestionBankPage />;
    case 'assessment-question-detail':
      return <AssessmentQuestionDetailPage />;
    case 'assessment-imported-tasks':
      return <AssessmentImportedTasksPage />;
    case 'analytics-overview':
      return <AnalyticsOverviewPage />;
    case 'system-admins':
      return <SystemAdminsPage />;
    case 'system-permissions':
      return <SystemPermissionsPage />;
    case 'system-metadata':
      return <SystemMetadataPage />;
    case 'system-audit-logs':
      return <SystemAuditLogsPage />;
    case 'system-logs':
      return <SystemLogsPage />;
    default: {
      const exhaustivePage: never = route;
      throw new Error(`Unknown admin page route: ${JSON.stringify(exhaustivePage)}`);
    }
  }
}

export function renderAdminRouteElement(
  route: AdminRouteDefinition
): JSX.Element {
  switch (route.kind) {
    case 'page':
      return renderPageRouteElement(route);
    case 'placeholder':
      return <AdminPlaceholderPage {...route.placeholder} />;
    case 'redirect':
      return <Navigate to={route.to} replace />;
    default: {
      const exhaustiveRoute: never = route;
      throw new Error(`Unknown admin route: ${JSON.stringify(exhaustiveRoute)}`);
    }
  }
}
