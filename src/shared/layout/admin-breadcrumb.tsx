import type { BreadcrumbProps } from 'antd';
import { Link } from 'react-router-dom';

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
    return [breadcrumbTextItem('대시보드')];
  }

  if (pathname === '/users') {
    return [breadcrumbTextItem('사용자')];
  }

  if (pathname.startsWith('/users/')) {
    const userId = pathname.split('/')[2] ?? '';
    const tabMap: Record<string, string> = {
      profile: '프로필',
      activity: '활동',
      payments: '결제',
      community: '커뮤니티',
      logs: '로그',
      'admin-memo': '관리자 메모'
    };
    const tab = new URLSearchParams(search).get('tab');
    const detailItem = breadcrumbTextItem(`상세 (${userId})`);

    if (!tab || !tabMap[tab]) {
      return [breadcrumbLinkItem('사용자', '/users'), detailItem];
    }

    return [
      breadcrumbLinkItem('사용자', '/users'),
      detailItem,
      breadcrumbTextItem(tabMap[tab])
    ];
  }

  if (pathname.startsWith('/community/posts')) {
    return [
      breadcrumbLinkItem('커뮤니티', '/community/posts'),
      breadcrumbTextItem('게시글 관리')
    ];
  }

  if (pathname.startsWith('/community/reports')) {
    return [
      breadcrumbLinkItem('커뮤니티', '/community/posts'),
      breadcrumbTextItem('신고 관리')
    ];
  }

  if (pathname.startsWith('/notification/send')) {
    return [
      breadcrumbLinkItem('알림', '/notification/send'),
      breadcrumbTextItem('알림 발송')
    ];
  }

  if (pathname.startsWith('/notification/history')) {
    return [
      breadcrumbLinkItem('알림', '/notification/send'),
      breadcrumbTextItem('발송 이력')
    ];
  }

  if (pathname.startsWith('/operation/notices')) {
    return [
      breadcrumbLinkItem('운영', '/operation/notices'),
      breadcrumbTextItem('공지사항')
    ];
  }

  if (pathname.startsWith('/operation/faq')) {
    return [
      breadcrumbLinkItem('운영', '/operation/notices'),
      breadcrumbTextItem('자주 묻는 질문')
    ];
  }

  if (pathname.startsWith('/billing/payments')) {
    return [
      breadcrumbLinkItem('결제', '/billing/payments'),
      breadcrumbTextItem('결제 내역')
    ];
  }

  if (pathname.startsWith('/billing/refunds')) {
    return [
      breadcrumbLinkItem('결제', '/billing/payments'),
      breadcrumbTextItem('환불 관리')
    ];
  }

  if (pathname.startsWith('/analytics')) {
    return [breadcrumbTextItem('분석')];
  }

  if (pathname.startsWith('/system/admins')) {
    return [
      breadcrumbLinkItem('시스템', '/system/admins'),
      breadcrumbTextItem('관리자 계정')
    ];
  }

  if (pathname.startsWith('/system/permissions')) {
    return [
      breadcrumbLinkItem('시스템', '/system/admins'),
      breadcrumbTextItem('권한 관리')
    ];
  }

  if (pathname.startsWith('/system/audit-logs')) {
    return [
      breadcrumbLinkItem('시스템', '/system/admins'),
      breadcrumbTextItem('감사 로그')
    ];
  }

  if (pathname.startsWith('/system/logs')) {
    return [
      breadcrumbLinkItem('시스템', '/system/admins'),
      breadcrumbTextItem('시스템 로그')
    ];
  }

  return [breadcrumbTextItem('대시보드')];
}
