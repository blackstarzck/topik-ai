import { Alert, Form, Input, Modal, Radio, Select, Space } from 'antd';
import type { FormInstance } from 'antd';
import type { UIEvent } from 'react';

import {
  formatPdfQuotaResetUserOptionLabel,
  PDF_QUOTA_UUID_PATTERN,
  type PdfQuotaResetFormValues
} from '../model/operation-pdf-quota-page-schema';
import type {
  PdfQuotaResetScope,
  PdfQuotaResetUserOption
} from '../model/pdf-quota-types';
import type { InstitutionCode } from '../../users/model/institution-codes-types';
import type { AsyncState } from '@/shared/model/async-state';

// 초기화 실행 모달 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 폼 인스턴스·대상 옵션 조회 상태·검색/스크롤 핸들러·실행 로직은 페이지가 소유하고 props 로 받는다.

export type PdfQuotaResetModalProps = {
  open: boolean;
  saving: boolean;
  activeResetScope: PdfQuotaResetScope;
  userOptionsState: AsyncState<PdfQuotaResetUserOption[]>;
  userOptionSearchInput: string;
  onUserOptionSearchInputChange: (value: string) => void;
  onUserOptionsPopupScroll: (event: UIEvent<HTMLDivElement>) => void;
  codeOptionsState: AsyncState<InstitutionCode[]>;
  form: FormInstance<PdfQuotaResetFormValues>;
  onOk: () => Promise<void>;
  onCancel: () => void;
};

export function PdfQuotaResetModal({
  open,
  saving,
  activeResetScope,
  userOptionsState,
  userOptionSearchInput,
  onUserOptionSearchInputChange,
  onUserOptionsPopupScroll,
  codeOptionsState,
  form,
  onOk,
  onCancel
}: PdfQuotaResetModalProps): JSX.Element {
  return (
    <Modal
      open={open}
      title="초기화 실행"
      okText="초기화 실행"
      cancelText="취소"
      confirmLoading={saving}
      onOk={onOk}
      onCancel={onCancel}
      destroyOnClose
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="이번 주기 사용량만 초기화됩니다."
          description="초기화는 실행한 주기 안에서만 유효하며 다음 주기에는 영향이 없습니다. 기관 코드 대상은 실행 시점의 소속 회원 스냅샷으로 확정되고, 이후 가입자는 포함되지 않습니다."
        />
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={{ scope: 'user', problemId: '', reason: '' }}
        >
          <Form.Item
            name="scope"
            label="초기화 범위"
            rules={[{ required: true, message: '범위를 선택하세요.' }]}
          >
            <Radio.Group
              options={[
                { value: 'user', label: '개인' },
                { value: 'group', label: '기관 코드' },
                { value: 'global', label: '전체' }
              ]}
            />
          </Form.Item>
          {activeResetScope === 'user' ? (
            <Form.Item
              name="userId"
              label="대상 회원"
              rules={[{ required: true, message: '대상 회원을 선택하세요.' }]}
            >
              <Select
                showSearch
                placeholder={
                  userOptionsState.status === 'pending'
                    ? '회원을 검색하는 중...'
                    : '이메일/닉네임/회원 ID로 검색'
                }
                loading={userOptionsState.status === 'pending'}
                notFoundContent={
                  userOptionsState.status === 'error'
                    ? '회원 목록 조회에 실패했습니다.'
                    : '검색 결과가 없습니다.'
                }
                filterOption={false}
                searchValue={userOptionSearchInput}
                onSearch={onUserOptionSearchInputChange}
                onChange={() => onUserOptionSearchInputChange('')}
                onPopupScroll={onUserOptionsPopupScroll}
                options={userOptionsState.data.map((user) => ({
                  value: user.id,
                  label: formatPdfQuotaResetUserOptionLabel(user)
                }))}
              />
            </Form.Item>
          ) : null}
          {activeResetScope === 'group' ? (
            <Form.Item
              name="groupCode"
              label="대상 기관 코드"
              rules={[{ required: true, message: '기관 코드를 선택하세요.' }]}
            >
              <Select
                showSearch
                placeholder={
                  codeOptionsState.status === 'pending'
                    ? '기관 코드를 불러오는 중...'
                    : '기관 코드 선택'
                }
                loading={codeOptionsState.status === 'pending'}
                notFoundContent={
                  codeOptionsState.status === 'error'
                    ? '기관 코드 조회에 실패했습니다.'
                    : '검색 결과가 없습니다.'
                }
                optionFilterProp="label"
                options={codeOptionsState.data.map((code) => ({
                  value: code.code,
                  label: `${code.label} (${code.code} · ${code.memberCount.toLocaleString()}명)`
                }))}
              />
            </Form.Item>
          ) : null}
          {activeResetScope === 'global' ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="모든 회원이 대상입니다."
              description="전체 초기화는 실행 시점의 회원 스냅샷을 대상 목록으로 확정합니다. 이후 가입자는 포함되지 않으며, 실행 시 한 번 더 확인합니다."
            />
          ) : null}
          <Form.Item
            name="problemId"
            label="문항 ID (선택)"
            tooltip="비워두면 전체 문항의 사용량을 초기화합니다."
            rules={[
              {
                validator: (_, value: string | undefined) => {
                  const trimmed = value?.trim();
                  if (!trimmed || PDF_QUOTA_UUID_PATTERN.test(trimmed)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error('UUID 형식의 문항 ID를 입력하세요.')
                  );
                }
              }
            ]}
          >
            <Input placeholder="예: 3f4c...-형식 UUID, 비워두면 전체 문항" />
          </Form.Item>
          <Form.Item
            name="reason"
            label="사유/근거"
            rules={[{ required: true, whitespace: true, message: '사유를 입력하세요.' }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="초기화를 실행하는 운영 사유를 입력하세요."
            />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  );
}
