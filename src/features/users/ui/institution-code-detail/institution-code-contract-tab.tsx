import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createInstitutionContractSafe,
  deleteInstitutionContractSafe,
  fetchInstitutionContractsSafe,
  translateInstitutionContractError,
  updateInstitutionContractSafe,
  updateInstitutionSettingsSafe
} from '../../api/institution-contracts-service';
import { isInstitutionCodesSupabase } from '../../api/institution-codes-service';
import { formatContractPeriod } from '../../model/institution-contracts-types';
import type {
  InstitutionContract,
  InstitutionContractStatusSummary,
  InstitutionSettings
} from '../../model/institution-contracts-types';
import type { InstitutionCode } from '../../model/institution-codes-types';
import type { NotificationApi } from './institution-code-detail-tab-types';
import { InstitutionContractDdayBadge } from '../institution-contract-dday-badge';
import { AuditLogLink } from '../../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../../shared/ui/confirm-action/confirm-action';
import { createDescriptionLabel } from '../../../../shared/ui/descriptions/description-label';
import { fixDrawerTableFirstColumn } from '../../../../shared/ui/table/drawer-table';

const { Text } = Typography;

const DATE_FORMAT = 'YYYY-MM-DD';

const STATUS_COLOR: Record<InstitutionContract['status'], string | undefined> = {
  유효: 'green',
  예정: 'blue',
  만료: undefined
};

type ContractFormValues = {
  period: [Dayjs, Dayjs | null];
  docUrl?: string;
  note?: string;
  reason: string;
};

type ContactFormValues = {
  contactName?: string;
  contactEmail?: string;
  reason: string;
};

type InstitutionCodeContractTabProps = {
  institution: InstitutionCode;
  /** 셸이 읽은 계약 요약 — D-day 배지와 현재 계약 표시의 데이터 소스. */
  contractStatus: InstitutionContractStatusSummary | null;
  /** 담당자 정보를 여기서 편집한다(정원·초대 정책은 회원 탭). */
  settings: InstitutionSettings | null;
  canManage: boolean;
  notificationApi: NotificationApi;
  onChanged: () => void;
};

/**
 * 계약 탭 — 계약 기간 원장(= 히스토리)과 운영 담당자를 다룬다.
 *
 * 계약 행 하나가 계약 한 건이고 그 행들의 집합이 곧 히스토리다. 그래서 "현재 계약" 카드와
 * "히스토리" 테이블이 같은 데이터를 두 각도로 보여주는 구조다 — 별도 이력 테이블이 없다.
 *
 * 화면이 반드시 지켜야 하는 계약 2가지:
 * - 계약을 연장하면 **배정 데이터는 그대로**이고 노출만 즉시 복구된다(서버 lazy 판정).
 *   따라서 연장 후 "배정을 다시 하세요" 같은 안내를 하면 안 된다.
 * - 계약이 하나도 없으면 만료할 계약이 없으므로 노출이 제한되지 않는다. `계약 없음` 을
 *   `만료` 와 같은 톤으로 보여주면 운영자가 불필요한 계약을 만든다.
 */
export function InstitutionCodeContractTab({
  institution,
  contractStatus,
  settings,
  canManage,
  notificationApi,
  onChanged
}: InstitutionCodeContractTabProps): JSX.Element {
  const [contracts, setContracts] = useState<InstitutionContract[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InstitutionContract | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InstitutionContract | null>(null);

  const [contractForm] = Form.useForm<ContractFormValues>();
  const [contactForm] = Form.useForm<ContactFormValues>();
  const [contactSubmitting, setContactSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetchInstitutionContractsSafe(institution.code, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) {
          return;
        }
        setLoading(false);
        if (result.ok) {
          setContracts(result.data);
          setErrorMessage(null);
          return;
        }
        setContracts([]);
        setErrorMessage(result.error.message);
      }
    );
    return () => {
      controller.abort();
    };
  }, [institution.code, reloadKey]);

  useEffect(() => {
    contactForm.setFieldsValue({
      contactName: settings?.contactName ?? '',
      contactEmail: settings?.contactEmail ?? '',
      reason: ''
    });
  }, [contactForm, settings]);

  const reload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
    onChanged();
  }, [onChanged]);

  const openCreate = useCallback(() => {
    setEditTarget(null);
    contractForm.resetFields();
    setEditorOpen(true);
  }, [contractForm]);

  const openEdit = useCallback(
    (row: InstitutionContract) => {
      setEditTarget(row);
      contractForm.setFieldsValue({
        period: [dayjs(row.startsOn), row.endsOn ? dayjs(row.endsOn) : null],
        docUrl: row.docUrl,
        note: row.note,
        reason: ''
      });
      setEditorOpen(true);
    },
    [contractForm]
  );

  const handleSubmit = useCallback(async () => {
    let values: ContractFormValues;
    try {
      values = await contractForm.validateFields();
    } catch {
      return;
    }

    const [start, end] = values.period;
    const payload = {
      code: institution.code,
      startsOn: start.format(DATE_FORMAT),
      // 종료일을 비우면 무기한이다. 빈 문자열로 넘겨 서버 어댑터가 null 로 바꾼다.
      endsOn: end ? end.format(DATE_FORMAT) : '',
      reason: values.reason,
      note: values.note ?? '',
      docUrl: values.docUrl ?? ''
    };

    setSubmitting(true);
    try {
      const result = editTarget
        ? await updateInstitutionContractSafe({
            ...payload,
            contractId: editTarget.contractId
          })
        : await createInstitutionContractSafe(payload);

      if (!result.ok) {
        notificationApi.error({
          message: editTarget ? '계약 수정 실패' : '계약 추가 실패',
          description: translateInstitutionContractError(result.error.message)
        });
        return;
      }

      notificationApi.success({
        message: editTarget ? '계약 수정 완료' : '계약 추가 완료',
        description: (
          <Space direction="vertical">
            <Text>
              {institution.code} · {formatContractPeriod(payload.startsOn, payload.endsOn)}
            </Text>
            {editTarget ? (
              <Text type="secondary">
                계약 기간만 바뀝니다. 배정된 문항은 그대로이며, 만료로 가려져 있었다면 즉시
                다시 보입니다.
              </Text>
            ) : null}
            <AuditLogLink targetType="InstitutionCode" targetId={institution.code} />
          </Space>
        )
      });
      setEditorOpen(false);
      setEditTarget(null);
      contractForm.resetFields();
      reload();
    } finally {
      setSubmitting(false);
    }
  }, [contractForm, editTarget, institution.code, notificationApi, reload]);

  const handleDeleteConfirm = useCallback(
    async (reason: string) => {
      if (!deleteTarget) {
        return;
      }
      const result = await deleteInstitutionContractSafe({
        contractId: deleteTarget.contractId,
        reason
      });
      if (!result.ok) {
        notificationApi.error({
          message: '계약 삭제 실패',
          description: translateInstitutionContractError(result.error.message)
        });
        return;
      }
      notificationApi.success({
        message: '계약 삭제 완료',
        description: (
          <Space direction="vertical">
            <Text>
              {formatContractPeriod(deleteTarget.startsOn, deleteTarget.endsOn)} 계약을
              삭제했습니다.
            </Text>
            <AuditLogLink targetType="InstitutionCode" targetId={institution.code} />
          </Space>
        )
      });
      setDeleteTarget(null);
      reload();
    },
    [deleteTarget, institution.code, notificationApi, reload]
  );

  const handleContactSubmit = useCallback(async () => {
    let values: ContactFormValues;
    try {
      values = await contactForm.validateFields();
    } catch {
      return;
    }

    setContactSubmitting(true);
    try {
      // 담당자만 바꿀 때도 설정 RPC 는 전량값을 받는다 → 나머지는 현재 값을 그대로 보낸다.
      // 여기서 null 로 흘리면 정원·초대 기본값이 조용히 초기화된다.
      const result = await updateInstitutionSettingsSafe({
        code: institution.code,
        maxMembers: settings?.maxMembers ?? null,
        defaultInviteExpiryDays: settings?.defaultInviteExpiryDays ?? null,
        blockIntakeOnExpiry: settings?.blockIntakeOnExpiry ?? false,
        contactName: values.contactName ?? '',
        contactEmail: values.contactEmail ?? '',
        reason: values.reason
      });
      if (!result.ok) {
        notificationApi.error({
          message: '담당자 정보 저장 실패',
          description: translateInstitutionContractError(result.error.message)
        });
        return;
      }
      notificationApi.success({
        message: '담당자 정보 저장 완료',
        description: (
          <Space direction="vertical">
            <Text type="secondary">
              담당자 이름·이메일 값은 감사 로그에 기록되지 않습니다(변경된 항목명만 남습니다).
            </Text>
            <AuditLogLink targetType="InstitutionCode" targetId={institution.code} />
          </Space>
        )
      });
      contactForm.setFieldsValue({ reason: '' });
      reload();
    } finally {
      setContactSubmitting(false);
    }
  }, [contactForm, institution.code, notificationApi, reload, settings]);

  const columns = useMemo(
    () =>
      fixDrawerTableFirstColumn<InstitutionContract>([
        {
          title: '계약 기간',
          key: 'period',
          render: (_: unknown, row: InstitutionContract) => (
            <Text>{formatContractPeriod(row.startsOn, row.endsOn)}</Text>
          )
        },
        {
          title: '상태',
          dataIndex: 'status',
          key: 'status',
          width: 90,
          render: (status: InstitutionContract['status']) => (
            <Tag color={STATUS_COLOR[status]}>{status}</Tag>
          )
        },
        {
          title: '계약 문서',
          dataIndex: 'docUrl',
          key: 'docUrl',
          render: (docUrl: string) =>
            docUrl ? (
              <a href={docUrl} target="_blank" rel="noreferrer noopener">
                링크
              </a>
            ) : (
              <Text type="secondary">-</Text>
            )
        },
        {
          title: '메모',
          dataIndex: 'note',
          key: 'note',
          render: (note: string) => note || <Text type="secondary">-</Text>
        },
        {
          title: '조치',
          key: 'actions',
          width: 140,
          fixed: 'right' as const,
          render: (_: unknown, row: InstitutionContract) => (
            <Space size={4}>
              <Button size="small" disabled={!canManage} onClick={() => openEdit(row)}>
                수정
              </Button>
              <Button
                size="small"
                danger
                disabled={!canManage}
                onClick={() => setDeleteTarget(row)}
              >
                삭제
              </Button>
            </Space>
          )
        }
      ]),
    [canManage, openEdit]
  );

  const summary = contractStatus;
  const deletingActiveContract = deleteTarget?.status === '유효';

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div data-testid="institution-contract-summary">
        <Text strong style={{ fontSize: 15 }}>
          현재 계약
        </Text>
        <div style={{ marginTop: 8 }}>
          <Descriptions
            bordered
            column={1}
            size="small"
            labelStyle={{ width: 130, whiteSpace: 'nowrap' }}
            items={[
              {
                key: 'period',
                label: '기간',
                children: summary ? (
                  <Space size={8} wrap>
                    <Text>
                      {summary.contractCount === 0
                        ? '등록된 계약이 없습니다.'
                        : formatContractPeriod(summary.activeStartsOn, summary.activeEndsOn)}
                    </Text>
                    <InstitutionContractDdayBadge summary={summary} />
                  </Space>
                ) : (
                  <Text type="secondary">불러오는 중…</Text>
                )
              },
              {
                key: 'count',
                label: '계약 이력',
                children: <Text>{contracts.length.toLocaleString()}건</Text>
              }
            ]}
          />
        </div>

        {summary?.writingHiddenNow ? (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 10 }}
            message="계약이 만료되어 이 기관 학습자에게 쓰기 문항이 보이지 않습니다."
            description="계약 기간을 연장하면 즉시 다시 보입니다 — 배정된 문항은 그대로 남아 있으므로 다시 배정할 필요가 없습니다."
          />
        ) : null}
        {summary && summary.contractCount === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 10 }}
            message="등록된 계약이 없습니다."
            description="만료할 계약이 없으므로 노출은 제한되지 않습니다. 계약 기간을 관리하려면 아래에서 추가하세요."
          />
        ) : null}
      </div>

      <div>
        <Space
          style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}
          align="center"
        >
          <Text strong style={{ fontSize: 15 }}>
            계약 히스토리
          </Text>
          {canManage ? (
            <Button type="primary" onClick={openCreate}>
              계약 추가
            </Button>
          ) : null}
        </Space>
        {errorMessage ? (
          <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 8 }} />
        ) : null}
        <Table<InstitutionContract>
          rowKey="contractId"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={contracts}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: '등록된 계약이 없습니다.' }}
        />
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          같은 기관의 계약 기간은 겹칠 수 없습니다. 종료일을 비우면 무기한 계약입니다.
        </Text>
      </div>

      <div>
        <Text strong style={{ fontSize: 15 }}>
          운영 담당자
        </Text>
        <Form form={contactForm} layout="vertical" style={{ marginTop: 8 }}>
          <Descriptions
            bordered
            column={1}
            size="small"
            labelStyle={{ width: 130, whiteSpace: 'nowrap' }}
            items={[
              {
                key: 'contactName',
                label: '담당자 이름',
                children: (
                  <Form.Item name="contactName" style={{ margin: 0 }}>
                    <Input disabled={!canManage} placeholder="미입력" />
                  </Form.Item>
                )
              },
              {
                key: 'contactEmail',
                label: '담당자 이메일',
                children: (
                  <Form.Item
                    name="contactEmail"
                    style={{ margin: 0 }}
                    rules={[{ type: 'email', message: '이메일 형식이 아닙니다.' }]}
                  >
                    <Input disabled={!canManage} placeholder="미입력" />
                  </Form.Item>
                )
              },
              {
                key: 'reason',
                label: createDescriptionLabel('변경 사유', { required: true }),
                children: (
                  <Form.Item
                    name="reason"
                    style={{ margin: 0 }}
                    rules={[{ required: true, message: '변경 사유를 입력하세요.' }]}
                  >
                    <Input.TextArea
                      rows={2}
                      disabled={!canManage}
                      placeholder="감사 로그에 기록됩니다(담당자 값은 기록되지 않습니다)."
                    />
                  </Form.Item>
                )
              }
            ]}
          />
        </Form>
        {canManage ? (
          <Button
            type="primary"
            style={{ marginTop: 10 }}
            loading={contactSubmitting}
            onClick={() => void handleContactSubmit()}
          >
            담당자 정보 저장
          </Button>
        ) : null}
      </div>

      {!isInstitutionCodesSupabase ? (
        <Text type="secondary">현재 mock 데이터 — 변경은 화면에만 반영됩니다.</Text>
      ) : null}

      <Modal
        open={editorOpen}
        title={editTarget ? '계약 수정' : '계약 추가'}
        okText={editTarget ? '수정' : '추가'}
        cancelText="취소"
        confirmLoading={submitting}
        onCancel={() => {
          setEditorOpen(false);
          setEditTarget(null);
        }}
        onOk={() => void handleSubmit()}
        destroyOnHidden
      >
        <Form form={contractForm} layout="vertical">
          <Form.Item
            name="period"
            label={createDescriptionLabel('계약 기간', { required: true })}
            rules={[{ required: true, message: '계약 기간을 선택하세요.' }]}
            extra="종료일을 비우면 무기한 계약입니다."
          >
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              format={DATE_FORMAT}
              allowEmpty={[false, true]}
            />
          </Form.Item>
          <Form.Item name="docUrl" label="계약 문서 링크">
            <Input placeholder="https://" />
          </Form.Item>
          <Form.Item name="note" label="메모">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="reason"
            label={createDescriptionLabel('사유 / 근거', { required: true })}
            rules={[{ required: true, message: '사유를 입력하세요.' }]}
          >
            <Input.TextArea rows={2} placeholder="감사 로그에 기록됩니다." />
          </Form.Item>
        </Form>
      </Modal>

      {deleteTarget ? (
        <ConfirmAction
          open
          title="계약 삭제"
          description={
            deletingActiveContract
              ? `${formatContractPeriod(deleteTarget.startsOn, deleteTarget.endsOn)} 계약을 삭제합니다. 이 계약은 현재 유효한 계약이며, "만료 시 자동 비노출" 이 켜져 있으면 삭제 즉시 이 기관 학습자에게 쓰기 문항이 보이지 않게 됩니다.`
              : `${formatContractPeriod(deleteTarget.startsOn, deleteTarget.endsOn)} 계약을 삭제합니다. 삭제 전 값은 감사 로그에 보존됩니다.`
          }
          targetType="InstitutionCode"
          targetId={institution.code}
          confirmText="삭제 실행"
          reasonPlaceholder="계약 삭제 사유를 입력하세요."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}
    </Space>
  );
}
