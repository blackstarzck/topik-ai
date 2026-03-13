import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createColumnFilterProps,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';

const { Text } = Typography;

type NoticeStatus = '게시' | '숨김';

type NoticeRow = {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  status: NoticeStatus;
};

type NoticeFormValue = {
  title: string;
};

type EditModalState =
  | { type: 'create' }
  | { type: 'edit'; row: NoticeRow }
  | null;

type DangerActionState =
  | { type: 'delete'; row: NoticeRow }
  | { type: 'hide'; row: NoticeRow }
  | null;

const initialRows: NoticeRow[] = [
  {
    id: 'NOTICE-001',
    title: '정기 점검 안내',
    author: 'admin_park',
    createdAt: '2026-03-03',
    status: '게시'
  },
  {
    id: 'NOTICE-002',
    title: '환불 정책 변경',
    author: 'admin_kim',
    createdAt: '2026-02-21',
    status: '숨김'
  }
];

const detailLabelMap: Record<string, string> = {
  id: '공지 ID',
  title: '제목',
  author: '작성자',
  createdAt: '작성일',
  status: '상태'
};

export default function OperationNoticesPage(): JSX.Element {
  const [rows, setRows] = useState<NoticeRow[]>(initialRows);
  const [modalState, setModalState] = useState<EditModalState>(null);
  const [dangerState, setDangerState] = useState<DangerActionState>(null);
  const [selectedRow, setSelectedRow] = useState<NoticeRow | null>(null);
  const [form] = Form.useForm<NoticeFormValue>();
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  const openCreateModal = useCallback(() => {
    form.setFieldsValue({ title: '' });
    setModalState({ type: 'create' });
  }, [form]);

  const openEditModal = useCallback(
    (row: NoticeRow) => {
      form.setFieldsValue({ title: row.title });
      setModalState({ type: 'edit', row });
    },
    [form]
  );

  const closeModal = useCallback(() => setModalState(null), []);
  const closeDangerModal = useCallback(() => setDangerState(null), []);
  const closeDetailModal = useCallback(() => setSelectedRow(null), []);

  const handleSaveNotice = useCallback(async () => {
    const values = await form.validateFields();

    if (modalState?.type === 'create') {
      const nextId = `NOTICE-${String(rows.length + 1).padStart(3, '0')}`;
      setRows((prev) => [
        {
          id: nextId,
          title: values.title,
          author: 'admin_current',
          createdAt: '2026-03-04',
          status: '게시'
        },
        ...prev
      ]);
      notificationApi.success({
        message: '공지 등록 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Operation')}</Text>
            <Text>대상 ID: {nextId}</Text>
            <Text>사유/근거: 신규 공지 등록</Text>
            <AuditLogLink targetType="Operation" targetId={nextId} />
          </Space>
        )
      });
    }

    if (modalState?.type === 'edit') {
      setRows((prev) =>
        prev.map((item) =>
          item.id === modalState.row.id ? { ...item, title: values.title } : item
        )
      );
      notificationApi.success({
        message: '공지 수정 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Operation')}</Text>
            <Text>대상 ID: {modalState.row.id}</Text>
            <Text>사유/근거: 공지 제목 수정</Text>
            <AuditLogLink targetType="Operation" targetId={modalState.row.id} />
          </Space>
        )
      });
    }

    setModalState(null);
  }, [form, modalState, notificationApi, rows.length]);

  const handleDangerAction = useCallback(
    async (reason: string) => {
      if (!dangerState) {
        return;
      }

      if (dangerState.type === 'delete') {
        setRows((prev) => prev.filter((item) => item.id !== dangerState.row.id));
        notificationApi.success({
          message: '공지 삭제 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('Operation')}</Text>
              <Text>대상 ID: {dangerState.row.id}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="Operation" targetId={dangerState.row.id} />
            </Space>
          )
        });
      } else {
        setRows((prev) =>
          prev.map((item) =>
            item.id === dangerState.row.id ? { ...item, status: '숨김' } : item
          )
        );
        notificationApi.success({
          message: '공지 숨김 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('Operation')}</Text>
              <Text>대상 ID: {dangerState.row.id}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="Operation" targetId={dangerState.row.id} />
            </Space>
          )
        });
      }

      setDangerState(null);
    },
    [dangerState, notificationApi]
  );

  const columns = useMemo<TableColumnsType<NoticeRow>>(
    () => [
      {
        title: '공지 ID',
        dataIndex: 'id',
        width: 130,
        ...createColumnFilterProps(rows, (record) => record.id),
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '제목',
        dataIndex: 'title',
        width: 320,
        ...createColumnFilterProps(rows, (record) => record.title),
        sorter: createTextSorter((record) => record.title)
      },
      {
        title: '작성자',
        dataIndex: 'author',
        width: 130,
        ...createColumnFilterProps(rows, (record) => record.author),
        sorter: createTextSorter((record) => record.author),
        render: (author: string) => (
          <Link
            className="table-navigation-link"
            to="/system/admins"
            onClick={(event) => event.stopPropagation()}
          >
            {author}
          </Link>
        )
      },
      {
        title: '작성일',
        dataIndex: 'createdAt',
        width: 120,
        ...createColumnFilterProps(rows, (record) => record.createdAt),
        sorter: createTextSorter((record) => record.createdAt)
      },
      {
        title: createStatusColumnTitle('상태', ['게시', '숨김']),
        dataIndex: 'status',
        width: 100,
        ...createColumnFilterProps(rows, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        render: (status: NoticeStatus) => <StatusBadge status={status} />
      },
      {
        title: '액션',
        key: 'action',
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
                key: `edit-${record.id}`,
                label: '공지 수정',
                onClick: () => openEditModal(record)
              },
              {
                key: `hide-${record.id}`,
                label: '공지 숨김',
                disabled: record.status !== '게시',
                onClick: () => setDangerState({ type: 'hide', row: record })
              },
              {
                key: `delete-${record.id}`,
                label: '공지 삭제',
                danger: true,
                onClick: () => setDangerState({ type: 'delete', row: record })
              }
            ]}
          />
        )
      }
    ],
    [openEditModal, rows]
  );

  const handleRowClick = useCallback(
    (record: NoticeRow) => ({
      onClick: () => setSelectedRow(record),
      style: { cursor: 'pointer' }
    }),
    []
  );

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="공지사항" />

      <Card
        extra={
          <Button type="primary" onClick={openCreateModal}>
            공지 등록
          </Button>
        }
      >
        <Table
          rowKey="id"
          showSorterTooltip={false}
          size="small"
          pagination={false}
          scroll={{ x: 1200 }}
          columns={columns}
          dataSource={rows}
          onRow={handleRowClick}
        />
      </Card>

      <Modal
        open={Boolean(modalState)}
        title={modalState?.type === 'create' ? '공지 등록' : '공지 수정'}
        okText="저장"
        cancelText="취소"
        onCancel={closeModal}
        onOk={handleSaveNotice}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="공지 제목"
            name="title"
            rules={[{ required: true, message: '공지 제목을 입력하세요.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input placeholder="공지 제목을 입력하세요." />
          </Form.Item>
        </Form>
      </Modal>

      {dangerState ? (
        <ConfirmAction
          open
          title={dangerState.type === 'delete' ? '공지 삭제' : '공지 숨김'}
          description={
            dangerState.type === 'delete'
              ? '공지 항목을 삭제합니다. 삭제 사유를 입력하세요.'
              : '공지 노출을 중단합니다. 숨김 사유를 입력하세요.'
          }
          targetType="Operation"
          targetId={dangerState.row.id}
          confirmText={dangerState.type === 'delete' ? '삭제 실행' : '숨김 실행'}
          onCancel={closeDangerModal}
          onConfirm={handleDangerAction}
        />
      ) : null}
      <TableRowDetailModal
        open={Boolean(selectedRow)}
        title="공지 상세 (더미)"
        record={selectedRow}
        labelMap={detailLabelMap}
        onClose={closeDetailModal}
      />
    </div>
  );
}


