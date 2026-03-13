import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Row,
  Col,
  Select,
  Space,
  Statistic,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '../../../shared/ui/search-bar/use-search-bar-date-draft';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import {
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';

const { Text } = Typography;

type FaqStatus = '공개' | '비공개';
type FaqCategory = '계정' | '결제' | '커뮤니티' | '메시지';

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  updatedAt: string;
  status: FaqStatus;
};

type FaqFormValues = {
  question: string;
  answer: string;
  category: FaqCategory;
  status: FaqStatus;
};

type FaqEditorState =
  | { type: 'create' }
  | { type: 'edit'; row: FaqRow }
  | null;

type FaqDangerState =
  | { type: 'toggle'; row: FaqRow; nextStatus: FaqStatus }
  | { type: 'delete'; row: FaqRow }
  | null;

const initialRows: FaqRow[] = [
  {
    id: 'FAQ-001',
    question: '결제 오류가 발생하면 어떤 정보를 먼저 확인해야 하나요?',
    answer:
      '결제 ID, 결제 수단, 시도 시각을 확인한 뒤 결제 내역과 시스템 로그를 함께 조회합니다.',
    category: '결제',
    updatedAt: '2026-03-08',
    status: '공개'
  },
  {
    id: 'FAQ-002',
    question: '회원 정지 처리 후 어떤 로그를 확인해야 하나요?',
    answer:
      '회원 상세에서 조치 사유를 기록한 뒤 감사 로그에서 대상 유형, 대상 ID, 수행자를 확인합니다.',
    category: '계정',
    updatedAt: '2026-03-05',
    status: '공개'
  },
  {
    id: 'FAQ-003',
    question: '메시지 발송 실패 건은 어디서 재시도하나요?',
    answer:
      '메시지 발송 이력 상세 Drawer에서 실패 수신자와 실패 원인을 확인한 뒤 재시도 발송을 실행합니다.',
    category: '메시지',
    updatedAt: '2026-03-03',
    status: '비공개'
  }
];

function buildDetailLabelMap(row: FaqRow | null): Record<string, string> | undefined {
  if (!row) {
    return undefined;
  }

  return {
    id: 'FAQ ID',
    question: '질문',
    answer: '답변',
    category: '카테고리',
    updatedAt: '최종 수정일',
    status: '공개 상태'
  };
}

export default function OperationFaqPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchField = searchParams.get('searchField') ?? 'all';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const keyword = searchParams.get('keyword') ?? '';
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

  const [rows, setRows] = useState<FaqRow[]>(initialRows);
  const [editorState, setEditorState] = useState<FaqEditorState>(null);
  const [dangerState, setDangerState] = useState<FaqDangerState>(null);
  const [selectedRow, setSelectedRow] = useState<FaqRow | null>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [form] = Form.useForm<FaqFormValues>();

  const visibleRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return rows.filter((row) => {
      if (!matchesSearchDateRange(row.updatedAt, startDate, endDate)) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        id: row.id,
        question: row.question,
        answer: row.answer
      });
    });
  }, [endDate, keyword, rows, searchField, startDate]);

  const commitParams = useCallback(
    (
      next: Partial<
        Record<
          'keyword' | 'searchField' | 'startDate' | 'endDate',
          string
        >
      >
    ) => {
      const merged = new URLSearchParams(searchParams);
      merged.delete('status');
      merged.delete('category');

      Object.entries(next).forEach(([key, value]) => {
        if (!value || value === 'all') {
          merged.delete(key);
          return;
        }
        merged.set(key, value);
      });

      setSearchParams(merged, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleApplyDateRange = useCallback(() => {
    commitParams({
      startDate: draftStartDate,
      endDate: draftEndDate,
      keyword,
      searchField
    });
  }, [commitParams, draftEndDate, draftStartDate, keyword, searchField]);

  const openCreateModal = useCallback(() => {
    form.setFieldsValue({
      question: '',
      answer: '',
      category: '계정',
      status: '공개'
    });
    setEditorState({ type: 'create' });
  }, [form]);

  const openEditModal = useCallback(
    (row: FaqRow) => {
      form.setFieldsValue({
        question: row.question,
        answer: row.answer,
        category: row.category,
        status: row.status
      });
      setEditorState({ type: 'edit', row });
    },
    [form]
  );

  const closeEditor = useCallback(() => setEditorState(null), []);
  const closeDanger = useCallback(() => setDangerState(null), []);
  const closeDetailModal = useCallback(() => setSelectedRow(null), []);

  const handleSaveFaq = useCallback(async () => {
    const values = await form.validateFields();
    const nextDate = '2026-03-11';

    if (editorState?.type === 'create') {
      const createdId = `FAQ-${String(rows.length + 1).padStart(3, '0')}`;
      setRows((prev) => [
        {
          id: createdId,
          question: values.question.trim(),
          answer: values.answer.trim(),
          category: values.category,
          status: values.status,
          updatedAt: nextDate
        },
        ...prev
      ]);

      notificationApi.success({
        message: 'FAQ 등록 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Operation')}</Text>
            <Text>대상 ID: {createdId}</Text>
            <Text>조치: FAQ 신규 등록</Text>
            <AuditLogLink targetType="Operation" targetId={createdId} />
          </Space>
        )
      });
    }

    if (editorState?.type === 'edit') {
      setRows((prev) =>
        prev.map((row) =>
          row.id === editorState.row.id
            ? {
                ...row,
                question: values.question.trim(),
                answer: values.answer.trim(),
                category: values.category,
                status: values.status,
                updatedAt: nextDate
              }
            : row
        )
      );

      notificationApi.success({
        message: 'FAQ 수정 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Operation')}</Text>
            <Text>대상 ID: {editorState.row.id}</Text>
            <Text>조치: FAQ 내용 수정</Text>
            <AuditLogLink targetType="Operation" targetId={editorState.row.id} />
          </Space>
        )
      });
    }

    setEditorState(null);
  }, [editorState, form, notificationApi, rows.length]);

  const handleDangerConfirm = useCallback(
    async (reason: string) => {
      if (!dangerState) {
        return;
      }

      if (dangerState.type === 'delete') {
        setRows((prev) => prev.filter((row) => row.id !== dangerState.row.id));
        notificationApi.success({
          message: 'FAQ 삭제 완료',
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

      if (dangerState.type === 'toggle') {
        setRows((prev) =>
          prev.map((row) =>
            row.id === dangerState.row.id
              ? {
                  ...row,
                  status: dangerState.nextStatus,
                  updatedAt: '2026-03-11'
                }
              : row
          )
        );
        notificationApi.success({
          message: `FAQ ${dangerState.nextStatus === '공개' ? '공개' : '비공개'} 완료`,
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

  const columns = useMemo<TableColumnsType<FaqRow>>(
    () => [
      {
        title: 'FAQ ID',
        dataIndex: 'id',
        width: 110,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '질문',
        dataIndex: 'question',
        ellipsis: true,
        sorter: createTextSorter((record) => record.question)
      },
      {
        title: '카테고리',
        dataIndex: 'category',
        width: 120,
        sorter: createTextSorter((record) => record.category)
      },
      {
        title: '최종 수정일',
        dataIndex: 'updatedAt',
        width: 130,
        sorter: createTextSorter((record) => record.updatedAt)
      },
      {
        title: '상태',
        dataIndex: 'status',
        width: 100,
        sorter: createTextSorter((record) => record.status),
        render: (status: FaqStatus) => <StatusBadge status={status} />
      },
      {
        title: '액션',
        key: 'actions',
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
                label: 'FAQ 수정',
                onClick: () => openEditModal(record)
              },
              {
                key: `toggle-${record.id}`,
                label: record.status === '공개' ? '비공개 전환' : '공개 전환',
                onClick: () =>
                  setDangerState({
                    type: 'toggle',
                    row: record,
                    nextStatus: record.status === '공개' ? '비공개' : '공개'
                  })
              },
              {
                key: `delete-${record.id}`,
                label: 'FAQ 삭제',
                danger: true,
                onClick: () => setDangerState({ type: 'delete', row: record })
              }
            ]}
          />
        )
      }
    ],
    [openEditModal]
  );

  const 공개Count = rows.filter((row) => row.status === '공개').length;
  const 비공개Count = rows.filter((row) => row.status === '비공개').length;

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="자주 묻는 질문" />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="전체 FAQ" value={rows.length} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="공개 FAQ" value={공개Count} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="비공개 FAQ" value={비공개Count} suffix="건" />
          </Card>
        </Col>
      </Row>

      <AdminListCard
        extra={
          <Button type="primary" onClick={openCreateModal}>
            FAQ 등록
          </Button>
        }
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: 'FAQ ID', value: 'id' },
              { label: '질문', value: 'question' },
              { label: '답변', value: 'answer' }
            ]}
            keyword={keyword}
            onSearchFieldChange={(value) =>
              commitParams({
                searchField: value
              })
            }
            onKeywordChange={(event) =>
              commitParams({
                keyword: event.target.value,
                searchField
              })
            }
            keywordPlaceholder="검색..."
            detailTitle="상세 검색"
            detailContent={
              <SearchBarDetailField label="최종 수정일">
                <SearchBarDateRange
                  startDate={draftStartDate}
                  endDate={draftEndDate}
                  onChange={handleDraftDateChange}
                />
              </SearchBarDetailField>
            }
            onApply={handleApplyDateRange}
            onDetailOpenChange={handleDetailOpenChange}
            onReset={handleDraftReset}
            summary={
              <Text type="secondary">총 {visibleRows.length.toLocaleString()}건</Text>
            }
          />
        }
      >
        <AdminDataTable<FaqRow>
          rowKey="id"
          columns={columns}
          dataSource={visibleRows}
          pagination={false}
          onRow={(record) => ({
            onClick: () => setSelectedRow(record),
            style: { cursor: 'pointer' }
          })}
          scroll={{ x: 1100 }}
        />
      </AdminListCard>

      <Modal
        open={Boolean(editorState)}
        title={editorState?.type === 'edit' ? 'FAQ 수정' : 'FAQ 등록'}
        okText="저장"
        cancelText="취소"
        onCancel={closeEditor}
        onOk={handleSaveFaq}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="질문"
            name="question"
            rules={[{ required: true, message: '질문을 입력하세요.' }]}
          >
            <Input placeholder="운영자가 사용자에게 보여줄 질문을 입력하세요." />
          </Form.Item>
          <Form.Item
            label="카테고리"
            name="category"
            rules={[{ required: true, message: '카테고리를 선택하세요.' }]}
          >
            <Select
              options={[
                { label: '계정', value: '계정' },
                { label: '결제', value: '결제' },
                { label: '커뮤니티', value: '커뮤니티' },
                { label: '메시지', value: '메시지' }
              ]}
            />
          </Form.Item>
          <Form.Item
            label="답변"
            name="answer"
            rules={[{ required: true, message: '답변을 입력하세요.' }]}
          >
            <Input.TextArea rows={6} placeholder="FAQ 답변을 입력하세요." />
          </Form.Item>
          <Form.Item
            label="공개 상태"
            name="status"
            rules={[{ required: true, message: '공개 상태를 선택하세요.' }]}
            style={{ marginBottom: 0 }}
          >
            <Select
              options={[
                { label: '공개', value: '공개' },
                { label: '비공개', value: '비공개' }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {dangerState ? (
        <ConfirmAction
          open
          title={
            dangerState.type === 'delete'
              ? 'FAQ 삭제'
              : `FAQ ${dangerState.nextStatus === '공개' ? '공개' : '비공개'} 전환`
          }
          description={
            dangerState.type === 'delete'
              ? 'FAQ를 삭제하면 운영 가이드와 사용자 도움말에서 더 이상 사용할 수 없습니다.'
              : 'FAQ 공개 상태를 변경하면 사용자 도움말 노출 여부가 즉시 달라집니다.'
          }
          targetType="Operation"
          targetId={dangerState.row.id}
          confirmText={dangerState.type === 'delete' ? '삭제 실행' : '상태 변경'}
          onCancel={closeDanger}
          onConfirm={handleDangerConfirm}
        />
      ) : null}

      <TableRowDetailModal
        open={Boolean(selectedRow)}
        title="FAQ 상세 (더미)"
        record={selectedRow}
        labelMap={buildDetailLabelMap(selectedRow)}
        onClose={closeDetailModal}
      />
    </div>
  );
}
