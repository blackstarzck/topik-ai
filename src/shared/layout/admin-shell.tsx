import {
  BarChartOutlined,
  BookOutlined,
  CommentOutlined,
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  ReadOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { Button, Grid, Layout, Menu, Spin, Tag, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { Suspense, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { usePermissionStore } from '../../features/system/model/permission-store';
import { adminMenuLabels, adminRoleLabels } from './admin-labels';

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

const ADMIN_SHELL_SIDEBAR_COLLAPSED_STORAGE_KEY = 'topik-ai-admin:sidebar-collapsed';

type MenuNode = {
  key: string;
  icon?: ReactNode;
  label: string;
  to?: string;
  permissionKeys?: string[];
  children?: MenuNode[];
};

function readStoredSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.localStorage.getItem(ADMIN_SHELL_SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  );
}

const menuConfig: MenuNode[] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: adminMenuLabels.dashboard,
    to: '/dashboard',
    permissionKeys: ['dashboard.read']
  },
  {
    key: '/users-section',
    icon: <TeamOutlined />,
    label: adminMenuLabels.users,
    children: [
      {
        key: '/users',
        label: adminMenuLabels.usersList,
        to: '/users',
        permissionKeys: ['users.read']
      },
      {
        key: '/users/groups',
        label: adminMenuLabels.usersGroups,
        to: '/users/groups',
        permissionKeys: ['users.groups.manage']
      },
      {
        key: '/users/referrals',
        label: adminMenuLabels.usersReferrals,
        to: '/users/referrals',
        permissionKeys: ['users.referrals.manage']
      }
    ]
  },
  {
    key: '/community',
    icon: <CommentOutlined />,
    label: adminMenuLabels.community,
    children: [
      {
        key: '/community/posts',
        label: adminMenuLabels.communityPosts,
        to: '/community/posts',
        permissionKeys: ['community.posts.hide', 'community.posts.delete']
      },
      {
        key: '/community/reports',
        label: adminMenuLabels.communityReports,
        to: '/community/reports',
        permissionKeys: ['community.reports.resolve']
      }
    ]
  },
  {
    key: '/messages',
    icon: <MessageOutlined />,
    label: adminMenuLabels.messages,
    children: [
      {
        key: '/messages/mail',
        label: adminMenuLabels.messagesMail,
        to: '/messages/mail?tab=auto',
        permissionKeys: ['message.mail.manage']
      },
      {
        key: '/messages/push',
        label: adminMenuLabels.messagesPush,
        to: '/messages/push?tab=auto',
        permissionKeys: ['message.push.manage']
      },
      {
        key: '/messages/groups',
        label: adminMenuLabels.messagesGroups,
        to: '/messages/groups',
        permissionKeys: ['message.groups.manage']
      },
      {
        key: '/messages/history',
        label: adminMenuLabels.messagesHistory,
        to: '/messages/history?channel=mail',
        permissionKeys: ['message.history.read']
      }
    ]
  },
  {
    key: '/operation',
    icon: <SettingOutlined />,
    label: adminMenuLabels.operation,
    children: [
      {
        key: '/operation/notices',
        label: adminMenuLabels.operationNotices,
        to: '/operation/notices',
        permissionKeys: ['operation.notices.manage']
      },
      {
        key: '/operation/faq',
        label: adminMenuLabels.operationFaq,
        to: '/operation/faq',
        permissionKeys: ['operation.faq.manage']
      },
      {
        key: '/operation/events',
        label: adminMenuLabels.operationEvents,
        to: '/operation/events',
        permissionKeys: ['operation.events.manage']
      },
      {
        key: '/operation/policies',
        label: adminMenuLabels.operationPolicies,
        to: '/operation/policies',
        permissionKeys: ['operation.policies.manage']
      },
      {
        key: '/operation/chatbot',
        label: adminMenuLabels.operationChatbot,
        to: '/operation/chatbot',
        permissionKeys: ['operation.chatbot.manage']
      }
    ]
  },
  {
    key: '/commerce',
    icon: <ShopOutlined />,
    label: adminMenuLabels.commerce,
    children: [
      {
        key: '/commerce/payments',
        label: adminMenuLabels.commercePayments,
        to: '/commerce/payments',
        permissionKeys: ['commerce.payments.read']
      },
      {
        key: '/commerce/refunds',
        label: adminMenuLabels.commerceRefunds,
        to: '/commerce/refunds',
        permissionKeys: ['commerce.refunds.approve']
      },
      {
        key: '/commerce/coupons',
        label: adminMenuLabels.commerceCoupons,
        to: '/commerce/coupons',
        permissionKeys: ['commerce.coupons.manage']
      },
      {
        key: '/commerce/points',
        label: adminMenuLabels.commercePoints,
        to: '/commerce/points',
        permissionKeys: ['commerce.points.manage']
      },
      {
        key: '/commerce/store',
        label: adminMenuLabels.commerceStore,
        to: '/commerce/store',
        permissionKeys: ['commerce.store.manage']
      }
    ]
  },
  {
    key: '/assessment',
    icon: <ReadOutlined />,
    label: adminMenuLabels.assessment,
    children: [
      {
        key: '/assessment/question-bank',
        label: adminMenuLabels.assessmentQuestionBank,
        to: '/assessment/question-bank',
        permissionKeys: ['assessment.question-bank.manage']
      },
      {
        key: '/assessment/question-bank/eps-topik',
        label: adminMenuLabels.assessmentEpsTopik,
        to: '/assessment/question-bank/eps-topik',
        permissionKeys: ['assessment.eps-topik.manage']
      },
      {
        key: '/assessment/level-tests',
        label: adminMenuLabels.assessmentLevelTests,
        to: '/assessment/level-tests',
        permissionKeys: ['assessment.level-tests.manage']
      }
    ]
  },
  {
    key: '/content',
    icon: <BookOutlined />,
    label: adminMenuLabels.content,
    children: [
      {
        key: '/content/library',
        label: adminMenuLabels.contentLibrary,
        to: '/content/library',
        permissionKeys: ['content.library.manage']
      },
      {
        key: '/content/badges',
        label: adminMenuLabels.contentBadges,
        to: '/content/badges',
        permissionKeys: ['content.badges.manage']
      },
      {
        key: '/content/vocabulary',
        label: adminMenuLabels.contentVocabulary,
        to: '/content/vocabulary',
        permissionKeys: ['content.vocabulary.manage'],
        children: [
          {
            key: '/content/vocabulary/sonagi',
            label: adminMenuLabels.contentVocabularySonagi,
            to: '/content/vocabulary/sonagi',
            permissionKeys: ['content.vocabulary.sonagi.manage']
          },
          {
            key: '/content/vocabulary/multiple-choice',
            label: adminMenuLabels.contentVocabularyMultipleChoice,
            to: '/content/vocabulary/multiple-choice',
            permissionKeys: ['content.vocabulary.multiple-choice.manage']
          }
        ]
      },
      {
        key: '/content/missions',
        label: adminMenuLabels.contentMissions,
        to: '/content/missions',
        permissionKeys: ['content.missions.manage']
      }
    ]
  },
  {
    key: '/analytics/overview',
    icon: <BarChartOutlined />,
    label: adminMenuLabels.analytics,
    to: '/analytics/overview',
    permissionKeys: ['analytics.read']
  },
  {
    key: '/system',
    icon: <SettingOutlined />,
    label: adminMenuLabels.system,
    children: [
      {
        key: '/system/admins',
        label: adminMenuLabels.systemAdmins,
        to: '/system/admins',
        permissionKeys: ['system.admins.manage']
      },
      {
        key: '/system/permissions',
        label: adminMenuLabels.systemPermissions,
        to: '/system/permissions',
        permissionKeys: ['system.permissions.manage']
      },
      {
        key: '/system/metadata',
        label: adminMenuLabels.systemMetadata,
        to: '/system/metadata',
        permissionKeys: ['system.metadata.manage']
      },
      {
        key: '/system/audit-logs',
        label: adminMenuLabels.systemAuditLogs,
        to: '/system/audit-logs',
        permissionKeys: ['system.audit.read']
      },
      {
        key: '/system/logs',
        label: adminMenuLabels.systemLogs,
        to: '/system/logs',
        permissionKeys: ['system.logs.read']
      }
    ]
  }
];

function hasAccess(permissionKeys: string[] | undefined, grantedPermissions: Set<string>) {
  if (!permissionKeys || permissionKeys.length === 0) {
    return true;
  }

  return permissionKeys.some((permissionKey) => grantedPermissions.has(permissionKey));
}

function buildVisibleMenuItems(
  nodes: MenuNode[],
  grantedPermissions: Set<string>
): ItemType[] {
  return nodes.flatMap((node) => {
    const visibleChildren = node.children
      ? buildVisibleMenuItems(node.children, grantedPermissions)
      : undefined;
    const canSeeNode = hasAccess(node.permissionKeys, grantedPermissions);
    const shouldShowNode =
      canSeeNode || (visibleChildren !== undefined && visibleChildren.length > 0);

    if (!shouldShowNode) {
      return [];
    }

    return [
      {
        key: node.key,
        icon: node.icon,
        label: node.label,
        title: node.label,
        children: visibleChildren
      } satisfies ItemType
    ];
  });
}

function buildMenuRouteMap(nodes: MenuNode[]): Record<string, string> {
  return nodes.reduce<Record<string, string>>((routeMap, node) => {
    if (node.to) {
      routeMap[node.key] = node.to;
    }

    if (node.children) {
      Object.assign(routeMap, buildMenuRouteMap(node.children));
    }

    return routeMap;
  }, {});
}

const menuRouteMap = buildMenuRouteMap(menuConfig);

function resolveSelectedKey(pathname: string): string {
  if (pathname.startsWith('/users/groups')) {
    return '/users/groups';
  }
  if (pathname.startsWith('/users/referrals')) {
    return '/users/referrals';
  }
  if (pathname === '/users' || pathname.startsWith('/users/')) {
    return '/users';
  }
  if (pathname.startsWith('/community/reports')) {
    return '/community/reports';
  }
  if (pathname.startsWith('/community/posts')) {
    return '/community/posts';
  }
  if (pathname.startsWith('/messages/push')) {
    return '/messages/push';
  }
  if (pathname.startsWith('/messages/groups')) {
    return '/messages/groups';
  }
  if (pathname.startsWith('/messages/history')) {
    return '/messages/history';
  }
  if (pathname.startsWith('/messages/mail')) {
    return '/messages/mail';
  }
  if (pathname.startsWith('/operation/faq')) {
    return '/operation/faq';
  }
  if (pathname.startsWith('/operation/events')) {
    return '/operation/events';
  }
  if (pathname.startsWith('/operation/policies')) {
    return '/operation/policies';
  }
  if (pathname.startsWith('/operation/chatbot')) {
    return '/operation/chatbot';
  }
  if (pathname.startsWith('/operation/notices')) {
    return '/operation/notices';
  }
  if (pathname.startsWith('/commerce/refunds')) {
    return '/commerce/refunds';
  }
  if (pathname.startsWith('/commerce/coupons')) {
    return '/commerce/coupons';
  }
  if (pathname.startsWith('/commerce/points')) {
    return '/commerce/points';
  }
  if (pathname.startsWith('/commerce/store')) {
    return '/commerce/store';
  }
  if (pathname.startsWith('/commerce/payments')) {
    return '/commerce/payments';
  }
  if (pathname.startsWith('/assessment/question-bank/eps-topik')) {
    return '/assessment/question-bank/eps-topik';
  }
  if (pathname.startsWith('/assessment/question-bank')) {
    return '/assessment/question-bank';
  }
  if (pathname.startsWith('/assessment/level-tests')) {
    return '/assessment/level-tests';
  }
  if (pathname.startsWith('/content/badges')) {
    return '/content/badges';
  }
  if (pathname.startsWith('/content/vocabulary/sonagi')) {
    return '/content/vocabulary/sonagi';
  }
  if (pathname.startsWith('/content/vocabulary/multiple-choice')) {
    return '/content/vocabulary/multiple-choice';
  }
  if (pathname.startsWith('/content/vocabulary')) {
    return '/content/vocabulary';
  }
  if (pathname.startsWith('/content/missions')) {
    return '/content/missions';
  }
  if (pathname.startsWith('/content/library')) {
    return '/content/library';
  }
  if (pathname.startsWith('/analytics')) {
    return '/analytics/overview';
  }
  if (pathname.startsWith('/system/logs')) {
    return '/system/logs';
  }
  if (pathname.startsWith('/system/audit-logs')) {
    return '/system/audit-logs';
  }
  if (pathname.startsWith('/system/metadata')) {
    return '/system/metadata';
  }
  if (pathname.startsWith('/system/permissions')) {
    return '/system/permissions';
  }
  if (pathname.startsWith('/system/admins')) {
    return '/system/admins';
  }
  return '/dashboard';
}

function resolveOpenKeys(selectedKey: string): string[] {
  if (selectedKey.startsWith('/users')) {
    return ['/users-section'];
  }
  if (selectedKey.startsWith('/community')) {
    return ['/community'];
  }
  if (selectedKey.startsWith('/messages')) {
    return ['/messages'];
  }
  if (selectedKey.startsWith('/operation')) {
    return ['/operation'];
  }
  if (selectedKey.startsWith('/commerce')) {
    return ['/commerce'];
  }
  if (selectedKey.startsWith('/assessment/question-bank/')) {
    return ['/assessment', '/assessment/question-bank'];
  }
  if (selectedKey.startsWith('/assessment')) {
    return ['/assessment'];
  }
  if (selectedKey.startsWith('/content/vocabulary/')) {
    return ['/content', '/content/vocabulary'];
  }
  if (selectedKey.startsWith('/content')) {
    return ['/content'];
  }
  if (selectedKey.startsWith('/system')) {
    return ['/system'];
  }
  return [];
}

export function AdminShell(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);
  const {
    token: { colorBgContainer }
  } = theme.useToken();
  const screens = useBreakpoint();
  const isDesktopViewport = screens.lg ?? true;
  const isMobileViewport = !isDesktopViewport;

  const currentAdmin = useMemo(
    () => admins.find((admin) => admin.adminId === currentAdminId) ?? admins[0] ?? null,
    [admins, currentAdminId]
  );

  const grantedPermissions = useMemo(
    () => new Set(currentAdmin?.permissions ?? []),
    [currentAdmin?.permissions]
  );

  const menuItems = useMemo(
    () => buildVisibleMenuItems(menuConfig, grantedPermissions),
    [grantedPermissions]
  );

  const selectedKey = resolveSelectedKey(location.pathname);
  const derivedOpenKeys = useMemo(() => resolveOpenKeys(selectedKey), [selectedKey]);
  const [openKeys, setOpenKeys] = useState<string[]>(derivedOpenKeys);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState<boolean>(
    readStoredSidebarCollapsed
  );
  const [mobileSidebarCollapsed, setMobileSidebarCollapsed] = useState(true);
  const isSidebarCollapsed = isMobileViewport
    ? mobileSidebarCollapsed
    : desktopSidebarCollapsed;

  useEffect(() => {
    setOpenKeys(derivedOpenKeys);
  }, [derivedOpenKeys]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      ADMIN_SHELL_SIDEBAR_COLLAPSED_STORAGE_KEY,
      String(desktopSidebarCollapsed)
    );
  }, [desktopSidebarCollapsed]);

  useEffect(() => {
    setMobileSidebarCollapsed(true);
  }, [isMobileViewport, location.pathname]);

  const toggleSidebar = () => {
    if (isMobileViewport) {
      setMobileSidebarCollapsed((current) => !current);
      return;
    }

    setDesktopSidebarCollapsed((current) => !current);
  };

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    const nextPath = menuRouteMap[String(key)];

    if (nextPath) {
      navigate(nextPath);
    }

    if (isMobileViewport) {
      setMobileSidebarCollapsed(true);
    }
  };

  const controlledOpenKeys = isSidebarCollapsed ? undefined : openKeys;
  const handleOpenChange = isSidebarCollapsed
    ? undefined
    : (nextOpenKeys: string[]) => setOpenKeys(nextOpenKeys);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={272}
        trigger={null}
        collapsible
        collapsed={isSidebarCollapsed}
        collapsedWidth={isMobileViewport ? 0 : 76}
        style={{
          height: '100vh',
          position: isMobileViewport ? 'fixed' : 'sticky',
          top: 0,
          left: 0,
          overflow: 'auto',
          zIndex: isMobileViewport ? 40 : 1
        }}
      >
        <div
          style={{
            height: 72,
            margin: 12,
            padding: isSidebarCollapsed ? '12px 8px' : '12px 14px',
            borderRadius: 10,
            background: '#10233c',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isSidebarCollapsed ? 'center' : 'flex-start',
            justifyContent: 'center'
          }}
        >
          <Text style={{ color: '#ffffffcc', display: 'block', fontSize: 12 }}>
            {isSidebarCollapsed ? 'TA' : 'TOPIK AI'}
          </Text>
          <Title
            level={5}
            style={{
              color: '#fff',
              margin: 0,
              lineHeight: '22px',
              display: isSidebarCollapsed ? 'none' : 'block'
            }}
          >
            관리자
          </Title>
        </div>
        <Menu
          mode="inline"
          theme="dark"
          items={menuItems}
          selectedKeys={[selectedKey]}
          openKeys={controlledOpenKeys}
          onOpenChange={handleOpenChange}
          onClick={handleMenuClick}
        />
      </Sider>
      {isMobileViewport && !isSidebarCollapsed ? (
        <div
          aria-hidden="true"
          onClick={() => setMobileSidebarCollapsed(true)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16, 35, 60, 0.28)',
            zIndex: 25
          }}
        />
      ) : null}
      <Layout>
        <Header
          style={{
            background: colorBgContainer,
            borderBottom: '1px solid #e8edf5',
            paddingInline: 20,
            paddingBlock: 8,
            minHeight: 64,
            height: 'auto',
            lineHeight: 'normal',
            position: 'sticky',
            top: 0,
            zIndex: isMobileViewport ? 30 : 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <Button
            type="text"
            icon={isSidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleSidebar}
            aria-label={isSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
            style={{
              width: 48,
              height: 48,
              fontSize: 18,
              flex: '0 0 auto'
            }}
          />
          <Text
            type="secondary"
            style={{
              flex: '1 1 320px',
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            운영 기본 흐름: 검색 {"->"} 상세 {"->"} 조치 {"->"} 감사 로그 확인
          </Text>
          {currentAdmin ? (
            <Tag color="blue" style={{ marginInlineStart: 'auto' }}>
              현재 세션: {currentAdmin.name} · {adminRoleLabels[currentAdmin.role]}
            </Tag>
          ) : null}
        </Header>
        <Content
          style={{
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          }}
        >
          <div key={location.pathname} className="route-transition-container">
            <Suspense
              fallback={
                <div className="route-loading-fallback">
                  <Spin size="large" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}


