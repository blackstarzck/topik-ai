import type { BreadcrumbProps } from 'antd';
import { Link } from 'react-router-dom';

import { adminMenuLabels, userDetailTabLabels } from './admin-labels';

function breadcrumbLinkItem(
  label: string,
  to: string
): NonNullable<BreadcrumbProps['items']>[number] {
  return { title: <Link to={to}>{label}</Link> };
}

function breadcrumbTextItem(
  label: string
): NonNullable<BreadcrumbProps['items']>[number] {
  return { title: label };
}

export function buildAdminBreadcrumbItems(
  pathname: string,
  search: string
): BreadcrumbProps['items'] {
  if (pathname === '/dashboard') {
    return [breadcrumbTextItem(adminMenuLabels.dashboard)];
  }

  if (pathname.startsWith('/users/groups')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.users, '/users'),
      breadcrumbTextItem(adminMenuLabels.usersGroups)
    ];
  }

  if (pathname.startsWith('/users/referrals')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.users, '/users'),
      breadcrumbTextItem(adminMenuLabels.usersReferrals)
    ];
  }

  if (pathname === '/users') {
    return [breadcrumbTextItem(adminMenuLabels.users)];
  }

  if (pathname.startsWith('/users/')) {
    const userId = pathname.split('/')[2] ?? '';
    const tab = new URLSearchParams(search).get('tab');
    const detailItem = breadcrumbTextItem(`상세 (${userId})`);

    if (!tab || !userDetailTabLabels[tab]) {
      return [breadcrumbLinkItem(adminMenuLabels.users, '/users'), detailItem];
    }

    return [
      breadcrumbLinkItem(adminMenuLabels.users, '/users'),
      detailItem,
      breadcrumbTextItem(userDetailTabLabels[tab])
    ];
  }

  if (pathname.startsWith('/community/posts')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.community, '/community/posts'),
      breadcrumbTextItem(adminMenuLabels.communityPosts)
    ];
  }

  if (pathname.startsWith('/community/reports')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.community, '/community/posts'),
      breadcrumbTextItem(adminMenuLabels.communityReports)
    ];
  }

  if (pathname.startsWith('/messages/mail/create')) {
    const tab = new URLSearchParams(search).get('tab');
    return [
      breadcrumbLinkItem(adminMenuLabels.messages, '/messages/mail?tab=auto'),
      breadcrumbLinkItem(adminMenuLabels.messagesMail, `/messages/mail${search || '?tab=auto'}`),
      breadcrumbTextItem(tab === 'manual' ? '수동 발송' : '자동 발송'),
      breadcrumbTextItem('등록 상세')
    ];
  }

  if (pathname.startsWith('/messages/mail')) {
    const tab = new URLSearchParams(search).get('tab');
    return [
      breadcrumbLinkItem(adminMenuLabels.messages, '/messages/mail?tab=auto'),
      breadcrumbTextItem(adminMenuLabels.messagesMail),
      breadcrumbTextItem(tab === 'manual' ? '수동 발송' : '자동 발송')
    ];
  }

  if (pathname.startsWith('/messages/push/create')) {
    const tab = new URLSearchParams(search).get('tab');
    return [
      breadcrumbLinkItem(adminMenuLabels.messages, '/messages/push?tab=auto'),
      breadcrumbLinkItem(adminMenuLabels.messagesPush, `/messages/push${search || '?tab=auto'}`),
      breadcrumbTextItem(tab === 'manual' ? '수동 발송' : '자동 발송'),
      breadcrumbTextItem('등록 상세')
    ];
  }

  if (pathname.startsWith('/messages/push')) {
    const tab = new URLSearchParams(search).get('tab');
    return [
      breadcrumbLinkItem(adminMenuLabels.messages, '/messages/push?tab=auto'),
      breadcrumbTextItem(adminMenuLabels.messagesPush),
      breadcrumbTextItem(tab === 'manual' ? '수동 발송' : '자동 발송')
    ];
  }

  if (pathname.startsWith('/messages/groups')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.messages, '/messages/mail?tab=auto'),
      breadcrumbTextItem(adminMenuLabels.messagesGroups)
    ];
  }

  if (pathname.startsWith('/messages/history')) {
    const channel = new URLSearchParams(search).get('channel');
    return [
      breadcrumbLinkItem(adminMenuLabels.messages, '/messages/mail?tab=auto'),
      breadcrumbTextItem(adminMenuLabels.messagesHistory),
      breadcrumbTextItem(channel === 'push' ? adminMenuLabels.messagesPush : adminMenuLabels.messagesMail)
    ];
  }

  if (pathname.startsWith('/operation/notices/create')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.operation, '/operation/notices'),
      breadcrumbLinkItem(adminMenuLabels.operationNotices, '/operation/notices'),
      breadcrumbTextItem('등록 상세')
    ];
  }

  if (pathname.startsWith('/operation/notices')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.operation, '/operation/notices'),
      breadcrumbTextItem(adminMenuLabels.operationNotices)
    ];
  }

  if (pathname.startsWith('/operation/faq')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.operation, '/operation/notices'),
      breadcrumbTextItem(adminMenuLabels.operationFaq)
    ];
  }

  if (pathname.startsWith('/operation/events/create')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.operation, '/operation/notices'),
      breadcrumbLinkItem(adminMenuLabels.operationEvents, '/operation/events'),
      breadcrumbTextItem('등록 상세')
    ];
  }

  if (pathname.startsWith('/operation/events')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.operation, '/operation/notices'),
      breadcrumbTextItem(adminMenuLabels.operationEvents)
    ];
  }

  if (pathname.startsWith('/operation/policies/create')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.operation, '/operation/notices'),
      breadcrumbLinkItem(adminMenuLabels.operationPolicies, '/operation/policies'),
      breadcrumbTextItem('등록 상세')
    ];
  }

  if (pathname.startsWith('/operation/policies')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.operation, '/operation/notices'),
      breadcrumbTextItem(adminMenuLabels.operationPolicies)
    ];
  }

  if (pathname.startsWith('/operation/chatbot')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.operation, '/operation/notices'),
      breadcrumbTextItem(adminMenuLabels.operationChatbot)
    ];
  }

  if (pathname.startsWith('/commerce/payments')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.commerce, '/commerce/payments'),
      breadcrumbTextItem(adminMenuLabels.commercePayments)
    ];
  }

  if (pathname.startsWith('/commerce/refunds')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.commerce, '/commerce/payments'),
      breadcrumbTextItem(adminMenuLabels.commerceRefunds)
    ];
  }

  if (pathname.startsWith('/commerce/coupons/create')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.commerce, '/commerce/payments'),
      breadcrumbLinkItem(adminMenuLabels.commerceCoupons, '/commerce/coupons'),
      breadcrumbTextItem('등록 상세')
    ];
  }

  if (pathname.startsWith('/commerce/coupons')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.commerce, '/commerce/payments'),
      breadcrumbTextItem(adminMenuLabels.commerceCoupons)
    ];
  }

  if (pathname.startsWith('/commerce/points')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.commerce, '/commerce/payments'),
      breadcrumbTextItem(adminMenuLabels.commercePoints)
    ];
  }

  if (pathname.startsWith('/commerce/store')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.commerce, '/commerce/payments'),
      breadcrumbTextItem(adminMenuLabels.commerceStore)
    ];
  }

  if (pathname.startsWith('/assessment/question-bank/eps-topik')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.assessment, '/assessment/question-bank'),
      breadcrumbLinkItem(
        adminMenuLabels.assessmentQuestionBank,
        '/assessment/question-bank'
      ),
      breadcrumbTextItem(adminMenuLabels.assessmentEpsTopik)
    ];
  }

  if (pathname.startsWith('/assessment/question-bank')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.assessment, '/assessment/question-bank'),
      breadcrumbTextItem(adminMenuLabels.assessmentQuestionBank)
    ];
  }

  if (pathname.startsWith('/assessment/level-tests')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.assessment, '/assessment/question-bank'),
      breadcrumbTextItem(adminMenuLabels.assessmentLevelTests)
    ];
  }

  if (pathname.startsWith('/content/library')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.content, '/content/library'),
      breadcrumbTextItem(adminMenuLabels.contentLibrary)
    ];
  }

  if (pathname.startsWith('/content/badges')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.content, '/content/library'),
      breadcrumbTextItem(adminMenuLabels.contentBadges)
    ];
  }

  if (pathname.startsWith('/content/vocabulary/sonagi')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.content, '/content/library'),
      breadcrumbLinkItem(adminMenuLabels.contentVocabulary, '/content/vocabulary'),
      breadcrumbTextItem(adminMenuLabels.contentVocabularySonagi)
    ];
  }

  if (pathname.startsWith('/content/vocabulary/multiple-choice')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.content, '/content/library'),
      breadcrumbLinkItem(adminMenuLabels.contentVocabulary, '/content/vocabulary'),
      breadcrumbTextItem(adminMenuLabels.contentVocabularyMultipleChoice)
    ];
  }

  if (pathname.startsWith('/content/vocabulary')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.content, '/content/library'),
      breadcrumbTextItem(adminMenuLabels.contentVocabulary)
    ];
  }

  if (pathname.startsWith('/content/missions')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.content, '/content/library'),
      breadcrumbTextItem(adminMenuLabels.contentMissions)
    ];
  }

  if (pathname.startsWith('/analytics')) {
    return [breadcrumbTextItem(adminMenuLabels.analytics)];
  }

  if (pathname.startsWith('/system/admins')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.system, '/system/admins'),
      breadcrumbTextItem(adminMenuLabels.systemAdmins)
    ];
  }

  if (pathname.startsWith('/system/permissions')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.system, '/system/admins'),
      breadcrumbTextItem(adminMenuLabels.systemPermissions)
    ];
  }

  if (pathname.startsWith('/system/metadata')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.system, '/system/admins'),
      breadcrumbTextItem(adminMenuLabels.systemMetadata)
    ];
  }

  if (pathname.startsWith('/system/audit-logs')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.system, '/system/admins'),
      breadcrumbTextItem(adminMenuLabels.systemAuditLogs)
    ];
  }

  if (pathname.startsWith('/system/logs')) {
    return [
      breadcrumbLinkItem(adminMenuLabels.system, '/system/admins'),
      breadcrumbTextItem(adminMenuLabels.systemLogs)
    ];
  }

  return [breadcrumbTextItem(adminMenuLabels.dashboard)];
}

