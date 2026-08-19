import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Typography
} from 'antd';
import type { FormInstance } from 'antd';
import { useCallback, useEffect, useMemo } from 'react';

import {
  getUserExportColumnLabels,
  normalizeUserExportColumns,
  userExportColumnOptions
} from '../model/export-users-xlsx';
import {
  defaultUserExportColumnKeys,
  requiredUserExportColumnKeys,
  type UserExportColumnKey
} from '../model/user-export-types';
import type { UsersExportFormValues } from '../model/users-page-schema';

const { Text } = Typography;

void getUserExportColumnLabels;

// 회원 정보 내보내기 다이얼로그 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 폼 인스턴스·검증·서비스 호출·감사 알림은 페이지가 소유하고, 열림 초기화·컬럼
// 선택 파생값 같은 입력 UX 로직은 다이얼로그 내부에서 계산한다.

export type UsersExportModalProps = {
  open: boolean;
  submitting: boolean;
  selectedCount: number;
  filterSummaryLabel: string;
  form: FormInstance<UsersExportFormValues>;
  onOk: () => Promise<void>;
  onCancel: () => void;
};

export function UsersExportModal({
  open,
  submitting,
  selectedCount,
  filterSummaryLabel,
  form,
  onOk,
  onCancel
}: UsersExportModalProps): JSX.Element {
  const exportColumnValues = Form.useWatch('columns', form);
  const exportColumns = useMemo(
    () => normalizeUserExportColumns(exportColumnValues),
    [exportColumnValues]
  );
  const isExportPhoneColumnSelected = exportColumns.includes('phone');

useEffect(() => {
  if (open) {
    form.setFieldsValue({
      reason: '',
      phoneMode: 'masked',
      scope: 'filters',
      columns: [...defaultUserExportColumnKeys]
    });
  }
}, [form, open]);

useEffect(() => {
  if (open && !isExportPhoneColumnSelected) {
    form.setFieldValue('phoneMode', 'masked');
  }
}, [form, open, isExportPhoneColumnSelected]);

useEffect(() => {
  if (open && selectedCount === 0 && form.getFieldValue('scope') === 'selected') {
    form.setFieldValue('scope', 'filters');
  }
}, [form, open, selectedCount]);

const handleSelectAllExportColumns = useCallback(() => {
  form.setFieldValue('columns', [...defaultUserExportColumnKeys]);
}, [form]);

const handleClearExportColumns = useCallback(() => {
  form.setFieldValue('columns', [...requiredUserExportColumnKeys]);
}, [form]);

  return (
<Modal
  open={open}
  title="회원 정보 내보내기"
  okText="엑셀 다운로드"
  cancelText="취소"
  confirmLoading={submitting}
  onCancel={onCancel}
  onOk={onOk}
  destroyOnHidden
>
  <Space direction="vertical" size={12} style={{ width: '100%' }}>
    <Alert
      type="warning"
      showIcon
      message="개인정보 반출 작업입니다"
      description={`현재 목록 조건: ${filterSummaryLabel}. 모든 내보내기는 사유·범위·행수와 함께 감사 로그에 기록됩니다.`}
    />
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        phoneMode: 'masked',
        scope: 'filters',
        columns: [...defaultUserExportColumnKeys]
      }}
    >
      <Form.Item label="대상 회원" name="scope" style={{ marginBottom: 12 }}>
        <Radio.Group>
          <Space direction="vertical" size={4}>
            <Radio value="filters">현재 목록 조건</Radio>
            <Radio value="selected" disabled={selectedCount === 0}>
              선택한 회원만 ({selectedCount.toLocaleString()}명)
            </Radio>
          </Space>
        </Radio.Group>
      </Form.Item>
      <Form.Item
        label="내보낼 컬럼"
      >
        <div className="users-export-column-toolbar">
          <Text type="secondary">사용자 ID는 추적성을 위해 항상 포함됩니다.</Text>
          <Space size={6}>
            <Button size="small" onClick={handleSelectAllExportColumns}>
              전체 선택
            </Button>
            <Button size="small" onClick={handleClearExportColumns}>
              선택 해제
            </Button>
          </Space>
        </div>
        <Form.Item
          name="columns"
          noStyle
          rules={[
            {
              validator: (_, value: UserExportColumnKey[] | undefined) => {
                const normalized = normalizeUserExportColumns(value);
                return normalized.includes('id')
                  ? Promise.resolve()
                  : Promise.reject(new Error('사용자 ID 컬럼은 필수입니다.'));
              }
            }
          ]}
        >
          <Checkbox.Group
            className="users-export-column-group"
            onChange={(values) =>
              form.setFieldValue(
                'columns',
                normalizeUserExportColumns(values as UserExportColumnKey[])
              )
            }
          >
            <div className="users-export-column-grid">
              {userExportColumnOptions.map((option) => (
                <Checkbox
                  key={option.value}
                  value={option.value}
                  disabled={option.required}
                >
                  {option.label}
                </Checkbox>
              ))}
            </div>
          </Checkbox.Group>
        </Form.Item>
      </Form.Item>
      <Form.Item
        label="내보내기 사유"
        name="reason"
        rules={[
          {
            required: true,
            whitespace: true,
            message: '내보내기 사유를 입력하세요.'
          }
        ]}
      >
        <Input.TextArea
          rows={2}
          maxLength={200}
          showCount
          placeholder="예: 2026 상반기 기관 제출용 회원 현황 정리"
        />
      </Form.Item>
      <Form.Item
        label="전화번호 처리"
        name="phoneMode"
        style={{ marginBottom: 0 }}
        extra={
          isExportPhoneColumnSelected
            ? '원문 포함은 업무상 꼭 필요한 경우에만 선택하세요. 선택 여부가 감사 로그에 남습니다.'
            : '전화번호 컬럼을 선택하지 않아 전화번호는 파일에 포함되지 않습니다.'
        }
      >
        <Radio.Group disabled={!isExportPhoneColumnSelected}>
          <Space direction="vertical" size={4}>
            <Radio value="masked">마스킹(권장) — 예: 010-****-5678</Radio>
            <Radio value="full">원문 포함 — 파일에 전화번호 전체가 기록됩니다</Radio>
          </Space>
        </Radio.Group>
      </Form.Item>
    </Form>
  </Space>
</Modal>
  );
}
