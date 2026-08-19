import {
  Alert,
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Typography
} from 'antd';
import type { FormInstance } from 'antd';
import { useMemo } from 'react';

import {
  formatPdfQuotaLimitLabel,
  PDF_QUOTA_HISTORY_PAGE_SIZE,
  PDF_QUOTA_TIMEZONE_OPTIONS,
  type PdfQuotaPolicyFormValues
} from '../model/operation-pdf-quota-page-schema';
import {
  pdfQuotaPeriodUnitLabels,
  pdfQuotaPeriodUnitValues,
  type PdfQuotaPeriodUnit,
  type PdfQuotaPolicy,
  type PdfQuotaPolicyHistoryEntry
} from '../model/pdf-quota-types';
import { createPdfQuotaHistoryColumns } from './operation-pdf-quota-columns';
import type { AsyncState } from '@/shared/model/async-state';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';

const { Text } = Typography;

// 정책 탭(현재 정책 폼 + 변경 이력) — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 조회 상태·폼 인스턴스·워치 값·저장/재시도 핸들러는 페이지가 소유하고 props 로 받는다.

export type PdfQuotaPoliciesTabProps = {
  policiesState: AsyncState<PdfQuotaPolicy[]>;
  historyState: AsyncState<PdfQuotaPolicyHistoryEntry[]>;
  historyPage: number;
  historyTotal: number;
  basePolicy: PdfQuotaPolicy | null;
  isAllInactiveDrift: boolean;
  policiesLoaded: boolean;
  policyPeriodUnitValue: PdfQuotaPeriodUnit | undefined;
  policyLimitValue: number | undefined;
  policySaving: boolean;
  policyForm: FormInstance<PdfQuotaPolicyFormValues>;
  onSubmitPolicy: () => Promise<void>;
  onRetryPolicies: () => void;
  onRetryHistory: () => void;
  onHistoryPageChange: (nextPage: number) => void;
};

export function PdfQuotaPoliciesTab({
  policiesState,
  historyState,
  historyPage,
  historyTotal,
  basePolicy,
  isAllInactiveDrift,
  policiesLoaded,
  policyPeriodUnitValue,
  policyLimitValue,
  policySaving,
  policyForm,
  onSubmitPolicy,
  onRetryPolicies,
  onRetryHistory,
  onHistoryPageChange
}: PdfQuotaPoliciesTabProps): JSX.Element {
  const historyColumns = useMemo(() => createPdfQuotaHistoryColumns(), []);

  const timezoneOptions = useMemo(() => {
    const values = new Set(PDF_QUOTA_TIMEZONE_OPTIONS);
    if (basePolicy?.periodTimezone) {
      values.add(basePolicy.periodTimezone);
    }
    return [...values].map((zone) => ({ value: zone, label: zone }));
  }, [basePolicy?.periodTimezone]);

  const policyInitialValues: PdfQuotaPolicyFormValues = {
    limitCount: basePolicy?.limitCount ?? 3,
    periodUnit: basePolicy?.periodUnit ?? 'month',
    periodTimezone: basePolicy?.periodTimezone ?? 'Asia/Seoul',
    reason: ''
  };

  const editingPeriodUnitChanged = Boolean(
    basePolicy &&
      policyPeriodUnitValue !== undefined &&
      policyPeriodUnitValue !== basePolicy.periodUnit
  );

  const policiesToolbar = (
    <div className="admin-list-card-toolbar-side">
      <Space>
        <Text className="admin-list-card-toolbar-summary" type="secondary">
          {basePolicy
            ? `현재 정책: ${formatPdfQuotaLimitLabel(basePolicy.limitCount)}/${pdfQuotaPeriodUnitLabels[basePolicy.periodUnit]} · ${basePolicy.periodTimezone} · 마지막 변경 ${basePolicy.updatedAt}`
            : '정책 없음 — 저장하면 새 정책이 생성됩니다'}
        </Text>
        {basePolicy?.limitCount === 0 ? <Tag color="red">내보내기 중단됨</Tag> : null}
      </Space>
      <div className="admin-list-card-toolbar-actions">
        <Button
          type="primary"
          size="large"
          loading={policySaving}
          disabled={policySaving || !policiesLoaded}
          onClick={() => void onSubmitPolicy()}
        >
          정책 저장
        </Button>
      </div>
    </div>
  );

  return (
    <AdminListCard toolbar={policiesToolbar}>
      {policiesState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="정책을 불러오지 못했습니다."
          description={
            <Space direction="vertical">
              <Text>
                {policiesState.errorMessage ?? '일시적인 오류가 발생했습니다.'}
              </Text>
              {policiesState.errorCode ? (
                <Text type="secondary">오류 코드: {policiesState.errorCode}</Text>
              ) : null}
            </Space>
          }
          action={
            <Button size="small" onClick={onRetryPolicies}>
              다시 시도
            </Button>
          }
        />
      ) : null}

      {isAllInactiveDrift ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="활성 정책이 없어 사용자 PDF 내보내기가 실패하는 상태입니다."
          description="아래 설정을 저장하면 최신 정책이 자동으로 복구(활성화)됩니다."
        />
      ) : null}

      {policiesState.status === 'empty' ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="등록된 정책이 없습니다."
          description="아래 설정을 저장하면 새 정책이 생성됩니다. 활성 정책이 없으면 v13 내보내기가 실패합니다."
        />
      ) : null}

      {basePolicy?.limitCount === 0 ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="현재 PDF 내보내기가 중단된 상태입니다(한도 0회)."
          description="한도를 1 이상으로 저장하면 내보내기가 재개됩니다."
        />
      ) : null}

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="주기 변경 주의"
        description="주기(일/주/월)를 변경하면 기존 사용량이 새 주기 경계와 달라 카운트에서 제외됩니다. 사실상 전체 회원의 사용량이 초기화되는 효과가 있습니다."
      />
      {editingPeriodUnitChanged ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="이번 저장에서 주기가 변경됩니다."
        />
      ) : null}
      {policyLimitValue === 0 ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="한도 0회는 전 사용자의 PDF 내보내기를 중단합니다."
          description="저장 시 한 번 더 확인합니다. 사용자에게는 횟수 소진 안내(429)가 표시됩니다."
        />
      ) : null}

      {policiesLoaded ? (
        // 로드 완료 후에만 Form을 렌더하고, 정책이 바뀌면 key로 리마운트해
        // initialValues가 항상 최신 값으로 적용되게 한다(사유는 비워짐).
        <Form
          key={`${basePolicy?.id ?? 'new'}:${basePolicy?.updatedAtIso ?? ''}`}
          form={policyForm}
          layout="vertical"
          initialValues={policyInitialValues}
          style={{ maxWidth: 480 }}
        >
          <Form.Item
            name="limitCount"
            label="주기당 내보내기 한도(회)"
            tooltip="0회는 의도적 내보내기 중단입니다."
            rules={[
              { required: true, message: '한도를 입력하세요.' },
              { type: 'number', min: 0, message: '0 이상이어야 합니다.' }
            ]}
          >
            <InputNumber min={0} max={999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="periodUnit"
            label="주기"
            rules={[{ required: true, message: '주기를 선택하세요.' }]}
          >
            <Select
              options={pdfQuotaPeriodUnitValues.map((unit) => ({
                value: unit,
                label: pdfQuotaPeriodUnitLabels[unit]
              }))}
            />
          </Form.Item>
          <Form.Item
            name="periodTimezone"
            label="기준 시간대"
            rules={[{ required: true, message: '시간대를 선택하세요.' }]}
          >
            <Select showSearch options={timezoneOptions} />
          </Form.Item>
          <Form.Item
            name="reason"
            label="사유/근거"
            rules={[
              { required: true, whitespace: true, message: '사유를 입력하세요.' }
            ]}
          >
            <Input.TextArea
              rows={2}
              placeholder="정책을 변경하는 운영 사유를 입력하세요."
            />
          </Form.Item>
        </Form>
      ) : policiesState.status === 'pending' ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="정책을 불러오는 중입니다."
        />
      ) : null}

      <Divider />
      <Typography.Title level={5}>변경 이력</Typography.Title>

      {historyState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="변경 이력을 불러오지 못했습니다."
          description={
            <Space direction="vertical">
              <Text>
                {historyState.errorMessage ?? '일시적인 오류가 발생했습니다.'}
              </Text>
              {historyState.errorCode ? (
                <Text type="secondary">오류 코드: {historyState.errorCode}</Text>
              ) : null}
            </Space>
          }
          action={
            <Button size="small" onClick={onRetryHistory}>
              다시 시도
            </Button>
          }
        />
      ) : null}

      {historyState.status === 'empty' ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="변경 이력이 없습니다."
          description="정책을 저장하면 변경 이력이 감사 로그 기반으로 쌓입니다."
        />
      ) : null}

      <AdminDataTable<PdfQuotaPolicyHistoryEntry>
        rowKey="id"
        scroll={{ x: 980 }}
        loading={historyState.status === 'pending' && historyState.data.length === 0}
        columns={historyColumns}
        dataSource={historyState.data}
        pagination={{
          current: historyPage,
          pageSize: PDF_QUOTA_HISTORY_PAGE_SIZE,
          total: historyTotal,
          showSizeChanger: false,
          onChange: onHistoryPageChange
        }}
      />
    </AdminListCard>
  );
}
