import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AdminShell } from '../../shared/layout/admin-shell';

const DashboardPage = lazy(
  () => import('../../features/dashboard/pages/dashboard-page')
);
const UsersPage = lazy(() => import('../../features/users/pages/users-page'));
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
        <Route path="/community/posts" element={<CommunityPostsPage />} />
        <Route path="/community/reports" element={<CommunityReportsPage />} />
        <Route path="/messages/mail" element={<MessageMailPage />} />
        <Route path="/messages/push" element={<MessagePushPage />} />
        <Route path="/messages/groups" element={<MessageGroupsPage />} />
        <Route path="/messages/history" element={<MessageHistoryPage />} />
        <Route
          path="/notification/send"
          element={<Navigate to="/messages/mail?tab=manual" replace />}
        />
        <Route
          path="/notification/history"
          element={<Navigate to="/messages/history?channel=mail" replace />}
        />
        <Route path="/operation/notices" element={<OperationNoticesPage />} />
        <Route path="/operation/faq" element={<OperationFaqPage />} />
        <Route path="/billing/payments" element={<BillingPaymentsPage />} />
        <Route path="/billing/refunds" element={<BillingRefundsPage />} />
        <Route path="/analytics/overview" element={<AnalyticsOverviewPage />} />
        <Route path="/system/admins" element={<SystemAdminsPage />} />
        <Route path="/system/permissions" element={<SystemPermissionsPage />} />
        <Route path="/system/audit-logs" element={<SystemAuditLogsPage />} />
        <Route path="/system/logs" element={<SystemLogsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
