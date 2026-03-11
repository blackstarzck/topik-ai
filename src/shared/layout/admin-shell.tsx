import {
  BarChartOutlined,
  BookOutlined,
  CommentOutlined,
  DashboardOutlined,
  MessageOutlined,
  ReadOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { Layout, Menu, Spin, Tag, Typography } from 'antd';
import type { ItemType, MenuItemType } from 'antd/es/menu/interface';
import { Suspense, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { usePermissionStore } from '../../features/system/model/permission-store';
import { adminMenuLabels, adminRoleLabels } from './admin-labels';

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;

type MenuNode = {
  key: string;
  icon?: ReactNode;
  label: ReactNode;
  permissionKeys?: string[];
  children?: MenuNode[];
};

const menuConfig: MenuNode[] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: <Link to="/dashboard">{adminMenuLabels.dashboard}</Link>,
    permissionKeys: ['dashboard.read']
  },
  {
    key: '/users-section',
    icon: <TeamOutlined />,
    label: adminMenuLabels.users,
    children: [
      {
        key: '/users',
        label: <Link to="/users">{adminMenuLabels.usersList}</Link>,
        permissionKeys: ['users.read']
      },
      {
        key: '/users/groups',
        label: <Link to="/users/groups">{adminMenuLabels.usersGroups}</Link>,
        permissionKeys: ['users.groups.manage']
      },
      {
        key: '/users/referrals',
        label: <Link to="/users/referrals">{adminMenuLabels.usersReferrals}</Link>,
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
        label: <Link to="/community/posts">{adminMenuLabels.communityPosts}</Link>,
        permissionKeys: ['community.posts.hide', 'community.posts.delete']
      },
      {
        key: '/community/reports',
        label: <Link to="/community/reports">{adminMenuLabels.communityReports}</Link>,
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
        label: <Link to="/messages/mail?tab=auto">{adminMenuLabels.messagesMail}</Link>,
        permissionKeys: ['message.mail.manage']
      },
      {
        key: '/messages/push',
        label: <Link to="/messages/push?tab=auto">{adminMenuLabels.messagesPush}</Link>,
        permissionKeys: ['message.push.manage']
      },
      {
        key: '/messages/groups',
        label: <Link to="/messages/groups">{adminMenuLabels.messagesGroups}</Link>,
        permissionKeys: ['message.groups.manage']
      },
      {
        key: '/messages/history',
        label: (
          <Link to="/messages/history?channel=mail">{adminMenuLabels.messagesHistory}</Link>
        ),
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
        label: <Link to="/operation/notices">{adminMenuLabels.operationNotices}</Link>,
        permissionKeys: ['operation.notices.manage']
      },
      {
        key: '/operation/faq',
        label: <Link to="/operation/faq">{adminMenuLabels.operationFaq}</Link>,
        permissionKeys: ['operation.faq.manage']
      },
      {
        key: '/operation/events',
        label: <Link to="/operation/events">{adminMenuLabels.operationEvents}</Link>,
        permissionKeys: ['operation.events.manage']
      },
      {
        key: '/operation/chatbot',
        label: <Link to="/operation/chatbot">{adminMenuLabels.operationChatbot}</Link>,
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
        label: <Link to="/commerce/payments">{adminMenuLabels.commercePayments}</Link>,
        permissionKeys: ['commerce.payments.read']
      },
      {
        key: '/commerce/refunds',
        label: <Link to="/commerce/refunds">{adminMenuLabels.commerceRefunds}</Link>,
        permissionKeys: ['commerce.refunds.approve']
      },
      {
        key: '/commerce/coupons',
        label: <Link to="/commerce/coupons">{adminMenuLabels.commerceCoupons}</Link>,
        permissionKeys: ['commerce.coupons.manage']
      },
      {
        key: '/commerce/points',
        label: <Link to="/commerce/points">{adminMenuLabels.commercePoints}</Link>,
        permissionKeys: ['commerce.points.manage']
      },
      {
        key: '/commerce/store',
        label: <Link to="/commerce/store">{adminMenuLabels.commerceStore}</Link>,
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
        label: (
          <Link to="/assessment/question-bank">
            {adminMenuLabels.assessmentQuestionBank}
          </Link>
        ),
        permissionKeys: ['assessment.question-bank.manage']
      },
      {
        key: '/assessment/question-bank/eps-topik',
        label: (
          <Link to="/assessment/question-bank/eps-topik">
            {adminMenuLabels.assessmentEpsTopik}
          </Link>
        ),
        permissionKeys: ['assessment.eps-topik.manage']
      },
      {
        key: '/assessment/level-tests',
        label: (
          <Link to="/assessment/level-tests">
            {adminMenuLabels.assessmentLevelTests}
          </Link>
        ),
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
        label: <Link to="/content/library">{adminMenuLabels.contentLibrary}</Link>,
        permissionKeys: ['content.library.manage']
      },
      {
        key: '/content/badges',
        label: <Link to="/content/badges">{adminMenuLabels.contentBadges}</Link>,
        permissionKeys: ['content.badges.manage']
      },
      {
        key: '/content/vocabulary',
        label: <Link to="/content/vocabulary">{adminMenuLabels.contentVocabulary}</Link>,
        permissionKeys: ['content.vocabulary.manage'],
        children: [
          {
            key: '/content/vocabulary/sonagi',
            label: (
              <Link to="/content/vocabulary/sonagi">
                {adminMenuLabels.contentVocabularySonagi}
              </Link>
            ),
            permissionKeys: ['content.vocabulary.sonagi.manage']
          },
          {
            key: '/content/vocabulary/multiple-choice',
            label: (
              <Link to="/content/vocabulary/multiple-choice">
                {adminMenuLabels.contentVocabularyMultipleChoice}
              </Link>
            ),
            permissionKeys: ['content.vocabulary.multiple-choice.manage']
          }
        ]
      },
      {
        key: '/content/missions',
        label: <Link to="/content/missions">{adminMenuLabels.contentMissions}</Link>,
        permissionKeys: ['content.missions.manage']
      }
    ]
  },
  {
    key: '/analytics/overview',
    icon: <BarChartOutlined />,
    label: <Link to="/analytics/overview">{adminMenuLabels.analytics}</Link>,
    permissionKeys: ['analytics.read']
  },
  {
    key: '/system',
    icon: <SettingOutlined />,
    label: adminMenuLabels.system,
    children: [
      {
        key: '/system/admins',
        label: <Link to="/system/admins">{adminMenuLabels.systemAdmins}</Link>,
        permissionKeys: ['system.admins.manage']
      },
      {
        key: '/system/permissions',
        label: <Link to="/system/permissions">{adminMenuLabels.systemPermissions}</Link>,
        permissionKeys: ['system.permissions.manage']
      },
      {
        key: '/system/audit-logs',
        label: <Link to="/system/audit-logs">{adminMenuLabels.systemAuditLogs}</Link>,
        permissionKeys: ['system.audit.read']
      },
      {
        key: '/system/logs',
        label: <Link to="/system/logs">{adminMenuLabels.systemLogs}</Link>,
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
        children: visibleChildren
      } satisfies ItemType
    ];
  });
}

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
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);

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

  useEffect(() => {
    setOpenKeys(derivedOpenKeys);
  }, [derivedOpenKeys]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={272}
        breakpoint="lg"
        collapsedWidth={76}
        style={{
          height: '100vh',
          position: 'sticky',
          top: 0,
          overflow: 'auto'
        }}
      >
        <div
          style={{
            height: 72,
            margin: 12,
            padding: '12px 14px',
            borderRadius: 10,
            background: '#10233c',
            color: '#fff'
          }}
        >
          <Text style={{ color: '#ffffffcc', display: 'block', fontSize: 12 }}>
            TOPIK AI
          </Text>
          <Title level={5} style={{ color: '#fff', margin: 0, lineHeight: '22px' }}>
            관리자
          </Title>
        </div>
        <Menu
          mode="inline"
          theme="dark"
          items={menuItems as MenuItemType[]}
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={(nextOpenKeys) => setOpenKeys(nextOpenKeys)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            borderBottom: '1px solid #e8edf5',
            paddingInline: 20,
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20
          }}
        >
          <Text type="secondary">
            운영 기본 흐름: 검색 → 상세 → 조치 → 감사 로그 확인
          </Text>
          {currentAdmin ? (
            <Tag color="blue">
              현재 세션: {currentAdmin.name} · {adminRoleLabels[currentAdmin.role]}
            </Tag>
          ) : null}
        </Header>
        <Content style={{ padding: 20 }}>
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
