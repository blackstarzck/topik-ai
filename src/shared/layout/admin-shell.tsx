import {
  BarChartOutlined,
  DashboardOutlined,
  DollarOutlined,
  MessageOutlined,
  NotificationOutlined,
  SettingOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { Layout, Menu, Spin, Typography } from 'antd';
import type { ItemType, MenuItemType } from 'antd/es/menu/interface';
import { Suspense, useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems: ItemType[] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: <Link to="/dashboard">대시보드</Link>
  },
  {
    key: '/users',
    icon: <TeamOutlined />,
    label: <Link to="/users">Users</Link>
  },
  {
    key: '/community',
    icon: <NotificationOutlined />,
    label: '커뮤니티',
    children: [
      {
        key: '/community/posts',
        label: <Link to="/community/posts">게시글 관리</Link>
      },
      {
        key: '/community/reports',
        label: <Link to="/community/reports">신고 관리</Link>
      }
    ]
  },
  {
    key: '/messages',
    icon: <MessageOutlined />,
    label: '메시지',
    children: [
      {
        key: '/messages/mail',
        label: <Link to="/messages/mail?tab=auto">메일</Link>
      },
      {
        key: '/messages/push',
        label: <Link to="/messages/push?tab=auto">푸시</Link>
      },
      {
        key: '/messages/groups',
        label: <Link to="/messages/groups">대상 그룹</Link>
      },
      {
        key: '/messages/history',
        label: <Link to="/messages/history?channel=mail">발송 이력</Link>
      }
    ]
  },
  {
    key: '/operation',
    icon: <SettingOutlined />,
    label: '운영',
    children: [
      {
        key: '/operation/notices',
        label: <Link to="/operation/notices">공지사항</Link>
      },
      {
        key: '/operation/faq',
        label: <Link to="/operation/faq">자주 묻는 질문</Link>
      }
    ]
  },
  {
    key: '/billing',
    icon: <DollarOutlined />,
    label: '결제',
    children: [
      {
        key: '/billing/payments',
        label: <Link to="/billing/payments">결제 내역</Link>
      },
      {
        key: '/billing/refunds',
        label: <Link to="/billing/refunds">환불 관리</Link>
      }
    ]
  },
  {
    key: '/analytics/overview',
    icon: <BarChartOutlined />,
    label: <Link to="/analytics/overview">분석</Link>
  },
  {
    key: '/system',
    icon: <SettingOutlined />,
    label: '시스템',
    children: [
      {
        key: '/system/admins',
        label: <Link to="/system/admins">관리자 계정</Link>
      },
      {
        key: '/system/permissions',
        label: <Link to="/system/permissions">권한 관리</Link>
      },
      {
        key: '/system/audit-logs',
        label: <Link to="/system/audit-logs">감사 로그</Link>
      },
      {
        key: '/system/logs',
        label: <Link to="/system/logs">시스템 로그</Link>
      }
    ]
  }
];

function resolveSelectedKey(pathname: string): string {
  if (pathname === '/users' || pathname.startsWith('/users/')) {
    return '/users';
  }
  if (pathname.startsWith('/community')) {
    return pathname.startsWith('/community/reports')
      ? '/community/reports'
      : '/community/posts';
  }
  if (pathname.startsWith('/messages')) {
    if (pathname.startsWith('/messages/push')) {
      return '/messages/push';
    }
    if (pathname.startsWith('/messages/groups')) {
      return '/messages/groups';
    }
    if (pathname.startsWith('/messages/history')) {
      return '/messages/history';
    }
    return '/messages/mail';
  }
  if (pathname.startsWith('/operation')) {
    return pathname.startsWith('/operation/faq')
      ? '/operation/faq'
      : '/operation/notices';
  }
  if (pathname.startsWith('/billing')) {
    return pathname.startsWith('/billing/refunds')
      ? '/billing/refunds'
      : '/billing/payments';
  }
  if (pathname.startsWith('/analytics')) {
    return '/analytics/overview';
  }
  if (pathname.startsWith('/system')) {
    if (pathname.startsWith('/system/logs')) {
      return '/system/logs';
    }
    if (pathname.startsWith('/system/audit-logs')) {
      return '/system/audit-logs';
    }
    if (pathname.startsWith('/system/permissions')) {
      return '/system/permissions';
    }
    return '/system/admins';
  }
  return '/dashboard';
}

function resolveOpenKeys(selectedKey: string): string[] {
  if (selectedKey.startsWith('/community')) {
    return ['/community'];
  }
  if (selectedKey.startsWith('/messages')) {
    return ['/messages'];
  }
  if (selectedKey.startsWith('/operation')) {
    return ['/operation'];
  }
  if (selectedKey.startsWith('/billing')) {
    return ['/billing'];
  }
  if (selectedKey.startsWith('/system')) {
    return ['/system'];
  }
  return [];
}

export function AdminShell(): JSX.Element {
  const location = useLocation();
  const selectedKey = resolveSelectedKey(location.pathname);
  const openKeys = useMemo(() => resolveOpenKeys(selectedKey), [selectedKey]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={258}
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
            height: 64,
            margin: 12,
            padding: '10px 14px',
            borderRadius: 10,
            background: '#10233c',
            color: '#fff'
          }}
        >
          <Text style={{ color: '#ffffffcc', display: 'block', fontSize: 12 }}>
            TOPIK AI
          </Text>
          <Title level={5} style={{ color: '#fff', margin: 0, lineHeight: '20px' }}>
            Admin
          </Title>
        </div>
        <Menu
          mode="inline"
          theme="dark"
          items={menuItems as MenuItemType[]}
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
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
            justifyContent: 'flex-end',
            gap: 20
          }}
        >
          <Text type="secondary">
            운영 기본 흐름: 검색 - 상세 - 조치 - 감사 로그 확인
          </Text>
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
