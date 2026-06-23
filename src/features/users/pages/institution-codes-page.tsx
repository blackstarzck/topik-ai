import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  assignInstitutionCodeSafe,
  clearInstitutionCodeSafe,
  createInstitutionCodeSafe,
  fetchInstitutionCodeMembersSafe,
  fetchInstitutionCodesSafe,
  isInstitutionCodesSupabase,
  updateInstitutionCodeSafe
} from '../api/institution-codes-service';
import { fetchUsersSafe } from '../api/users-service';
import {
  institutionCodeKinds,
  institutionCodeStatuses
} from '../model/institution-codes-types';
import type {
  InstitutionCode,
  InstitutionCodeKind,
  InstitutionCodeMember,
  InstitutionCodeStatus
} from '../model/institution-codes-types';
import type { UserSummary } from '../model/types';
import { usePermissionStore } from '../../system/model/permission-store';
import type { AsyncState } from '../../../shared/model/async-state';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;

const CODE_PATTERN = /^[A-Za-z0-9_-]{2,64}$/;
const pageSizeOptions = ['20', '50', '100'];

const kindOptions = institutionCodeKinds.map((kind) => ({ label: kind, value: kind }));
const statusOptions = institutionCodeStatuses.map((status) => ({
  label: status,
  value: status
}));

type CreateFormValues = {
  code: string;
  label: string;
  kind: InstitutionCodeKind;
  note?: string;
};

type EditFormValues = {
  label: string;
  kind: InstitutionCodeKind;
  status: InstitutionCodeStatus;
  note?: string;
  reason: string;
};

function todayText(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Descriptions 라벨에는 Form.Item 의 필수 표시(*)가 붙지 않으므로 직접 부여한다.
function requiredLabel(text: string): JSX.Element {
  return (
    <span>
      {text}
      <span style={{ color: '#ff4d4f', marginInlineStart: 4 }}>*</span>
    </span>
  );
}

export default function InstitutionCodesPage(): JSX.Element {
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [codesState, setCodesState] = useState<AsyncState<InstitutionCode[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InstitutionCode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [createForm] = Form.useForm<CreateFormValues>();
  const [editForm] = Form.useForm<EditFormValues>();

  // 회원 관리(코드별 회원 추가/제거) 모달.
  const [memberTarget, setMemberTarget] = useState<InstitutionCode | null>(null);
  const [membersState, setMembersState] = useState<AsyncState<InstitutionCodeMember[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [memberReload, setMemberReload] = useState(0);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [addForm] = Form.useForm<{ userIds: string[]; reason: string }>();
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<InstitutionCodeMember | null>(null);

  // 회원 배정/해제 권한(메뉴 게이팅과 동일 키). 코드 생성/수정(is_admin)과 달리 회원 관리는
  // platform_admin RPC라, 권한 미보유자에겐 회원 관리 컨트롤을 숨긴다(다른 두 화면과 일관).
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);
  const canManageMembers = useMemo(() => {
    const me = admins.find((item) => item.adminId === currentAdminId);
    return me?.permissions.includes('users.institution-codes.manage') ?? false;
  }, [admins, currentAdminId]);

  useEffect(() => {
    const controller = new AbortController();

    setCodesState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchInstitutionCodesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setCodesState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setCodesState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  // 회원 관리 모달이 열린 코드의 소속 회원 목록 로드.
  useEffect(() => {
    if (!memberTarget) {
      return;
    }
    const code = memberTarget.code;
    const controller = new AbortController();

    setMembersState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchInstitutionCodeMembersSafe(code, undefined, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok) {
        setMembersState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setMembersState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [memberTarget, memberReload]);

  // 회원 추가 피커용 회원 디렉터리(최초 모달 오픈 시 1회). 실패해도 제거 기능엔 영향 없음.
  useEffect(() => {
    if (!memberTarget || allUsers.length > 0) {
      return;
    }
    const controller = new AbortController();
    void fetchUsersSafe(controller.signal).then((result) => {
      if (controller.signal.aborted || !result.ok) {
        return;
      }
      setAllUsers(result.data);
    });
    return () => {
      controller.abort();
    };
  }, [memberTarget, allUsers.length]);

  const summary = useMemo(
    () => ({
      total: codesState.data.length,
      active: codesState.data.filter((item) => item.status === '활성').length,
      members: codesState.data.reduce((sum, item) => sum + item.memberCount, 0)
    }),
    [codesState.data]
  );

  const openCreate = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const openEdit = useCallback((record: InstitutionCode) => {
    setEditTarget(record);
  }, []);

  const openMembers = useCallback((record: InstitutionCode) => {
    setMemberTarget(record);
  }, []);

  const closeMembers = useCallback(() => {
    setMemberTarget(null);
    setRemoveTarget(null);
  }, []);

  // 회원 추가 모달이 열릴 때 이전 입력값 초기화(폼 마운트 후).
  useEffect(() => {
    if (memberTarget) {
      addForm.resetFields();
    }
  }, [memberTarget, addForm]);

  // 이미 이 코드 소속인 회원은 추가 피커에서 제외. 라벨에 현재 소속 코드를 함께 표기.
  const memberUserIdSet = useMemo(
    () => new Set(membersState.data.map((member) => member.userId)),
    [membersState.data]
  );
  const addUserOptions = useMemo(
    () =>
      allUsers
        .filter((user) => !memberUserIdSet.has(user.id))
        .map((user) => {
          const name = user.realName || user.nickname || '(이름 없음)';
          const current = user.affiliationCode ? ` · 현재: ${user.affiliationCode}` : '';
          return {
            value: user.id,
            label: `${name} · ${user.email}${current}`
          };
        }),
    [allUsers, memberUserIdSet]
  );

  const handleAddMembers = useCallback(async () => {
    if (!memberTarget || addSubmitting) {
      return;
    }
    // submitting을 검증 await 전에 세워 더블 서밋 창을 닫는다.
    setAddSubmitting(true);
    let values: { userIds: string[]; reason: string };
    try {
      values = await addForm.validateFields();
    } catch {
      setAddSubmitting(false);
      return;
    }
    if (!values.userIds || values.userIds.length === 0) {
      setAddSubmitting(false);
      return;
    }

    const result = await assignInstitutionCodeSafe(
      values.userIds,
      memberTarget.code,
      values.reason
    );
    setAddSubmitting(false);

    if (!result.ok) {
      notificationApi.error({ message: '회원 추가 실패', description: result.error.message });
      return;
    }

    notificationApi.success({
      message: '회원 추가 완료',
      description: `${result.data.toLocaleString()}명이 ${memberTarget.code} 에 배정되었습니다. (변경 없음 제외)`
    });
    addForm.resetFields();
    setMemberReload((prev) => prev + 1);
    setReloadKey((prev) => prev + 1);
  }, [addForm, addSubmitting, memberTarget, notificationApi]);

  const handleRemoveConfirm = useCallback(
    async (reason: string) => {
      if (!memberTarget || !removeTarget) {
        return;
      }
      const result = await clearInstitutionCodeSafe([removeTarget.userId], reason);
      if (!result.ok) {
        notificationApi.error({ message: '회원 제거 실패', description: result.error.message });
        setRemoveTarget(null);
        return;
      }
      notificationApi.success({
        message: '회원 제거 완료',
        description: `${removeTarget.realName || removeTarget.email} 의 ${memberTarget.code} 소속이 해제되었습니다.`
      });
      setRemoveTarget(null);
      setMemberReload((prev) => prev + 1);
      setReloadKey((prev) => prev + 1);
    },
    [memberTarget, removeTarget, notificationApi]
  );

  const handleCreateSubmit = useCallback(async () => {
    let values: CreateFormValues;
    try {
      values = await createForm.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      const code = values.code.trim();
      const label = values.label.trim();
      const note = values.note?.trim() ?? '';

      const result = await createInstitutionCodeSafe({ code, label, kind: values.kind, note });
      if (!result.ok) {
        notificationApi.error({
          message: '기관 코드 생성 실패',
          description: result.error.message
        });
        return;
      }

      if (isInstitutionCodesSupabase) {
        setReloadKey((prev) => prev + 1);
      } else {
        const created: InstitutionCode = {
          code,
          label,
          kind: values.kind,
          status: '활성',
          note,
          memberCount: 0,
          createdAt: todayText(),
          updatedAt: todayText()
        };
        setCodesState((prev) => ({
          ...prev,
          data: [created, ...prev.data],
          status: 'success'
        }));
      }

      notificationApi.success({
        message: '기관 코드 생성 완료',
        description: (
          <Space direction="vertical">
            <Text>코드: {code}</Text>
            <Text>이름: {label}</Text>
            <AuditLogLink targetType="InstitutionCode" targetId={code} />
          </Space>
        )
      });
      setCreateOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [createForm, notificationApi]);

  const handleEditSubmit = useCallback(async () => {
    if (!editTarget) {
      return;
    }

    let values: EditFormValues;
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      const label = values.label.trim();
      const note = values.note?.trim() ?? '';
      const reason = values.reason.trim();

      const result = await updateInstitutionCodeSafe({
        code: editTarget.code,
        label,
        kind: values.kind,
        status: values.status,
        note,
        reason
      });
      if (!result.ok) {
        notificationApi.error({
          message: '기관 코드 수정 실패',
          description: result.error.message
        });
        return;
      }

      if (isInstitutionCodesSupabase) {
        setReloadKey((prev) => prev + 1);
      } else {
        setCodesState((prev) => ({
          ...prev,
          data: prev.data.map((item) =>
            item.code === editTarget.code
              ? {
                  ...item,
                  label,
                  kind: values.kind,
                  status: values.status,
                  note,
                  updatedAt: todayText()
                }
              : item
          )
        }));
      }

      notificationApi.success({
        message: '기관 코드 수정 완료',
        description: (
          <Space direction="vertical">
            <Text>코드: {editTarget.code}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="InstitutionCode" targetId={editTarget.code} />
          </Space>
        )
      });
      setEditTarget(null);
    } finally {
      setSubmitting(false);
    }
  }, [editForm, editTarget, notificationApi]);

  const columns = useMemo<TableColumnsType<InstitutionCode>>(
    () => [
      {
        title: '코드',
        dataIndex: 'code',
        width: 200,
        sorter: createTextSorter((record) => record.code),
        render: (code: string) => (
          <Text strong copyable>
            {code}
          </Text>
        )
      },
      {
        title: '이름',
        dataIndex: 'label',
        width: 260,
        sorter: createTextSorter((record) => record.label)
      },
      {
        title: '종류',
        dataIndex: 'kind',
        width: 110,
        ...createDefinedColumnFilterProps(institutionCodeKinds, (record) => record.kind),
        render: (kind: InstitutionCodeKind) => <Tag>{kind}</Tag>
      },
      {
        title: createStatusColumnTitle('상태', institutionCodeStatuses),
        dataIndex: 'status',
        width: 110,
        ...createDefinedColumnFilterProps(institutionCodeStatuses, (record) => record.status),
        render: (status: InstitutionCodeStatus) => <StatusBadge status={status} />
      },
      {
        title: '가입 수',
        dataIndex: 'memberCount',
        width: 110,
        align: 'right',
        sorter: createNumberSorter((record) => record.memberCount),
        render: (memberCount: number) => memberCount.toLocaleString()
      },
      {
        title: '생성일',
        dataIndex: 'createdAt',
        width: 130,
        sorter: createTextSorter((record) => record.createdAt)
      },
      {
        title: '액션',
        key: 'action',
        width: 150,
        render: (_, record) => (
          <Space size={0}>
            {canManageMembers ? (
              <Button type="link" size="small" onClick={() => openMembers(record)}>
                회원 관리
              </Button>
            ) : null}
            <Button type="link" size="small" onClick={() => openEdit(record)}>
              수정
            </Button>
          </Space>
        )
      }
    ],
    [canManageMembers, openEdit, openMembers]
  );

  const memberColumns = useMemo<TableColumnsType<InstitutionCodeMember>>(
    () => [
      {
        title: '회원',
        key: 'member',
        render: (_, record) => (
          <Text>{record.realName || record.nickname || '(이름 없음)'}</Text>
        )
      },
      { title: '이메일', dataIndex: 'email' },
      { title: '상태', dataIndex: 'status', width: 80 },
      { title: '가입일', dataIndex: 'joinedAt', width: 120 },
      {
        title: '액션',
        key: 'action',
        width: 80,
        render: (_, record) =>
          canManageMembers ? (
            <Button type="link" size="small" danger onClick={() => setRemoveTarget(record)}>
              제거
            </Button>
          ) : null
      }
    ],
    [canManageMembers]
  );

  const toolbar = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <Space size="large" wrap>
        <Text type="secondary">총 {summary.total.toLocaleString()}건</Text>
        <Text type="secondary">활성 {summary.active.toLocaleString()}건</Text>
        <Text type="secondary">누적 가입 {summary.members.toLocaleString()}명</Text>
      </Space>
      <Button type="primary" onClick={openCreate}>
        코드 생성
      </Button>
    </div>
  );

  return (
    <>
      {notificationContextHolder}
      <PageTitle title="기관 코드" />
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        박람회/기관 유입 QR에 싣는 코드를 등록·관리합니다. 회원이 이 코드를 달고 가입하면 기관 회원으로 추적됩니다.
        {!isInstitutionCodesSupabase && ' (현재 mock 데이터 — 생성/수정은 화면에만 반영됩니다.)'}
      </Paragraph>

      <AdminListCard toolbar={toolbar}>
        <AdminDataTable<InstitutionCode>
          rowKey="code"
          columns={columns}
          dataSource={codesState.data}
          loading={codesState.status === 'pending'}
          pagination={{
            pageSize: 20,
            pageSizeOptions,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total.toLocaleString()}건`
          }}
        />
      </AdminListCard>

      <Modal
        open={createOpen}
        title="기관 코드 생성"
        okText="생성"
        cancelText="취소"
        confirmLoading={submitting}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreateSubmit()}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" initialValues={{ kind: '박람회' }}>
          <Descriptions
            bordered
            column={1}
            size="small"
            labelStyle={{ width: 96, whiteSpace: 'nowrap' }}
          >
            <Descriptions.Item label={requiredLabel('코드')}>
              <Form.Item
                name="code"
                style={{ margin: 0 }}
                extra="QR 주소에 실리는 식별자 · 영문/숫자/-/_ 2~64자"
                rules={[
                  { required: true, message: '코드를 입력하세요.' },
                  {
                    validator: async (_, value: string | undefined) => {
                      if (value && !CODE_PATTERN.test(value.trim())) {
                        throw new Error('영문/숫자/-/_ 2~64자만 사용할 수 있습니다.');
                      }
                    }
                  }
                ]}
              >
                <Input placeholder="EXPO2026-BOOTH-A" autoComplete="off" />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label={requiredLabel('이름')}>
              <Form.Item
                name="label"
                style={{ margin: 0 }}
                rules={[{ required: true, message: '이름을 입력하세요.' }]}
              >
                <Input placeholder="2026 한국어교육 박람회 · A부스" />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label={requiredLabel('종류')}>
              <Form.Item
                name="kind"
                style={{ margin: 0 }}
                rules={[{ required: true, message: '종류를 선택하세요.' }]}
              >
                <Select options={kindOptions} style={{ width: '100%' }} />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label="메모">
              <Form.Item name="note" style={{ margin: 0 }}>
                <Input.TextArea rows={2} placeholder="현장 QR 가입 · A부스" />
              </Form.Item>
            </Descriptions.Item>
          </Descriptions>
        </Form>
      </Modal>

      <Modal
        open={editTarget !== null}
        title={editTarget ? `기관 코드 수정 · ${editTarget.code}` : '기관 코드 수정'}
        okText="수정"
        cancelText="취소"
        confirmLoading={submitting}
        onCancel={() => setEditTarget(null)}
        onOk={() => void handleEditSubmit()}
        destroyOnHidden
      >
        <Form
          form={editForm}
          layout="vertical"
          initialValues={
            editTarget
              ? {
                  label: editTarget.label,
                  kind: editTarget.kind,
                  status: editTarget.status,
                  note: editTarget.note,
                  reason: ''
                }
              : undefined
          }
        >
          <Descriptions
            bordered
            column={1}
            size="small"
            labelStyle={{ width: 96, whiteSpace: 'nowrap' }}
          >
            <Descriptions.Item label="코드">
              <Text strong>{editTarget?.code}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={requiredLabel('이름')}>
              <Form.Item
                name="label"
                style={{ margin: 0 }}
                rules={[{ required: true, message: '이름을 입력하세요.' }]}
              >
                <Input />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label={requiredLabel('종류')}>
              <Form.Item
                name="kind"
                style={{ margin: 0 }}
                rules={[{ required: true, message: '종류를 선택하세요.' }]}
              >
                <Select options={kindOptions} style={{ width: '100%' }} />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label={requiredLabel('상태')}>
              <Form.Item
                name="status"
                style={{ margin: 0 }}
                rules={[{ required: true, message: '상태를 선택하세요.' }]}
              >
                <Select options={statusOptions} style={{ width: '100%' }} />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label="메모">
              <Form.Item name="note" style={{ margin: 0 }}>
                <Input.TextArea rows={2} />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label={requiredLabel('변경 사유')}>
              <Form.Item
                name="reason"
                style={{ margin: 0 }}
                rules={[{ required: true, message: '변경 사유를 입력하세요.' }]}
              >
                <Input.TextArea rows={2} placeholder="감사 로그에 기록됩니다." />
              </Form.Item>
            </Descriptions.Item>
          </Descriptions>
        </Form>
      </Modal>

      <Modal
        open={memberTarget !== null}
        width={720}
        title={memberTarget ? `회원 관리 · ${memberTarget.code}` : '회원 관리'}
        footer={<Button onClick={closeMembers}>닫기</Button>}
        onCancel={closeMembers}
        destroyOnHidden
      >
        {memberTarget ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Text type="secondary">{memberTarget.label}</Text>

            {canManageMembers ? (
              <Form form={addForm} layout="vertical">
                <Form.Item
                  label="회원 추가"
                  name="userIds"
                  rules={[{ required: true, message: '추가할 회원을 선택하세요.' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="이름 또는 이메일로 검색하세요."
                    options={addUserOptions}
                    showSearch
                    optionFilterProp="label"
                    maxTagCount="responsive"
                  />
                </Form.Item>
                <Form.Item
                  label="사유/근거"
                  name="reason"
                  rules={[{ required: true, message: '배정 사유를 입력하세요.' }]}
                >
                  <Input.TextArea rows={2} placeholder="감사 기록에 남길 사유를 입력하세요." />
                </Form.Item>
                <Button
                  type="primary"
                  loading={addSubmitting}
                  onClick={() => void handleAddMembers()}
                >
                  선택 회원 추가
                </Button>
              </Form>
            ) : null}

            <div>
              <Text strong>
                소속 회원 {membersState.data.length.toLocaleString()}명
              </Text>
              {membersState.status === 'error' ? (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginTop: 8 }}
                  message={membersState.errorMessage ?? '회원 목록 조회에 실패했습니다.'}
                />
              ) : null}
              <div style={{ marginTop: 8 }}>
                <AdminDataTable<InstitutionCodeMember>
                  rowKey="userId"
                  columns={memberColumns}
                  dataSource={membersState.data}
                  loading={membersState.status === 'pending'}
                  pagination={false}
                  scroll={{ y: 280 }}
                />
              </div>
            </div>

            {!isInstitutionCodesSupabase ? (
              <Text type="secondary">
                현재 mock 데이터 — 회원 추가/제거는 화면에만 반영되며 목록은 비어 있습니다.
              </Text>
            ) : null}
          </Space>
        ) : null}
      </Modal>

      {memberTarget && removeTarget ? (
        <ConfirmAction
          open
          title="기관 소속 해제"
          description={`${removeTarget.realName || removeTarget.email} 의 ${
            memberTarget.code
          } 소속을 해제합니다. 사유를 기록하세요.`}
          targetType="Users"
          targetId={removeTarget.userId}
          confirmText="해제 실행"
          onCancel={() => setRemoveTarget(null)}
          onConfirm={handleRemoveConfirm}
        />
      ) : null}
    </>
  );
}
