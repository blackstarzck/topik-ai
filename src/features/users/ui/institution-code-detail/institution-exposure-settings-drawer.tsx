import { Alert, Button, Divider, Drawer, Input, Radio, Space, Switch, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { setInstitutionExposureModeSafe } from '../../api/institution-codes-service';
import {
  setInstitutionAutoAssignSafe,
  setInstitutionAutoHideSafe,
  translateInstitutionContractError
} from '../../api/institution-contracts-service';
import type {
  InstitutionCode,
  InstitutionExposureMode
} from '../../model/institution-codes-types';
import type {
  InstitutionContractStatusSummary,
  InstitutionExposureOptions
} from '../../model/institution-contracts-types';
import type { NotificationApi } from './institution-code-detail-tab-types';
import { AuditLogLink } from '../../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../../shared/ui/confirm-action/confirm-action';
import {
  DrawerFooter,
  DrawerTitle,
  mergeDrawerFrameStyles
} from '../../../../shared/ui/drawer-frame/drawer-frame';

const { Text } = Typography;

/** 사유 확인 모달을 띄울 대상 토글. */
type PendingOptionToggle = {
  field: 'autoHide' | 'autoAssign';
  next: boolean;
};

const OPTION_COPY: Record<
  PendingOptionToggle['field'],
  { title: string; label: string; on: string; off: string }
> = {
  autoHide: {
    title: '만료 시 자동 비노출',
    label: '계약 만료 시 자동 비노출',
    on: '켜면 계약이 만료된 동안 이 기관 학습자에게 쓰기 문항이 보이지 않습니다.',
    off: '끄면 계약이 만료돼도 문항 노출은 그대로 유지됩니다.'
  },
  autoAssign: {
    title: '신규 문항 자동 배정',
    label: '신규 문항 자동 배정',
    on: '켠 이후 노출 전환되는 문항이 이 기관에 자동 배정됩니다. 이미 노출 중인 문항은 소급 배정되지 않습니다.',
    off: '끄면 새 문항을 이 기관에 직접 배정해야 합니다.'
  }
};

/**
 * 노출 모드 변경 거부 사유를 운영자 언어로 바꾼다. 서버(빈 화면 가드)가 raw Postgres
 * 메시지를 던지므로 그대로 노출하지 않는다. 알려진 패턴이 아니면 원문을 유지한다.
 */
function translateExposureModeError(message: string): string {
  if (message.includes('cannot switch institution')) {
    return '배정된 문항이 0건이어서 배정분만으로 바꿀 수 없습니다. 소속 회원 또는 대기 중 초대가 있으면 그 학습자에게 쓰기 문항이 하나도 보이지 않습니다. 노출 문항에서 먼저 배정하거나 회원 소속을 해제해 주세요.';
  }
  if (message.includes('missing permission')) {
    return '노출 모드를 바꿀 권한이 없습니다(users.institution-codes.manage).';
  }
  return message;
}

type InstitutionExposureSettingsDrawerProps = {
  open: boolean;
  onClose: () => void;
  institution: InstitutionCode;
  exposureMode: InstitutionExposureMode;
  assignedQuestionCount: number;
  exposureOptions: InstitutionExposureOptions | null;
  contractStatus: InstitutionContractStatusSummary | null;
  canManage: boolean;
  notificationApi: NotificationApi;
  onChanged: () => void;
};

/**
 * 노출 설정 Drawer — 노출 모드 + 계약 연동 옵션 2종.
 *
 * 셋 다 "이 기관 학습자에게 무엇이 보이는가"를 정하는 **설정**이라 한 곳에 모은다.
 * 예전에는 탭 본문에 세 덩어리(모드·옵션·배정)가 세로로 쌓여 사유 입력란이 3개, 저장
 * 버튼이 3개였고, 정작 본체인 배정 도구가 첫 화면 아래로 밀렸다.
 *
 * 판단에 필요한 현재 값(모드·배정 건수·옵션 on/off)은 탭 툴바에 상시 노출한다. 그리고
 * "지금 만료로 가려져 있다"는 **현황 경보는 본문에 남긴다** — Drawer 안에 넣으면 열어보기
 * 전까지 못 보는데, 그건 운영자가 즉시 알아야 하는 상태다.
 *
 * 모드 변경이 성공해도 Drawer 를 닫지 않는다 — 이어서 옵션을 조작하는 흐름이 자연스럽고,
 * 셸 재조회 결과가 props 로 돌아와 선택이 실제 값으로 수렴한다.
 */
export function InstitutionExposureSettingsDrawer({
  open,
  onClose,
  institution,
  exposureMode,
  assignedQuestionCount,
  exposureOptions,
  contractStatus,
  canManage,
  notificationApi,
  onChanged
}: InstitutionExposureSettingsDrawerProps): JSX.Element {
  const [pendingMode, setPendingMode] = useState<InstitutionExposureMode>(exposureMode);
  const [modeReason, setModeReason] = useState('');
  const [modeSubmitting, setModeSubmitting] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<PendingOptionToggle | null>(null);

  // 셸이 재조회한 실제 모드로 선택을 되돌린다(적용 성공·실패 모두 이 경로로 수렴).
  useEffect(() => {
    setPendingMode(exposureMode);
    setModeReason('');
  }, [exposureMode]);

  // 배정 0건인데 `배정분만` 으로 바꾸려 하면 서버(빈 화면 가드)가 거부하므로,
  // 왕복 전에 화면에서 막고 이유를 알린다.
  const modeBlocked =
    pendingMode === '배정분만' && assignedQuestionCount === 0 && institution.memberCount > 0;
  // 회원이 아직 없으면 차단하지 않는다 — 앞으로 소속될 학습자에 대한 경고만 남긴다.
  const modeZeroAssignedWarning =
    pendingMode === '배정분만' && assignedQuestionCount === 0 && institution.memberCount === 0;
  const modeDirty = pendingMode !== exposureMode;

  const handleApplyMode = useCallback(async () => {
    const reason = modeReason.trim();
    if (!modeDirty || !reason || modeBlocked) {
      return;
    }

    setModeSubmitting(true);
    try {
      const result = await setInstitutionExposureModeSafe({
        code: institution.code,
        exposureMode: pendingMode,
        reason
      });
      if (!result.ok) {
        notificationApi.error({
          message: '노출 모드 변경 실패',
          description: translateExposureModeError(result.error.message)
        });
        // 화면의 배정 건수·회원 수가 stale 해서 막혔을 수 있다 → 스스로 교정한다.
        onChanged();
        return;
      }

      notificationApi.success({
        message: '노출 모드 변경 완료',
        description: (
          <Space direction="vertical">
            <Text>
              {institution.code} · {pendingMode}
            </Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="InstitutionCode" targetId={institution.code} />
          </Space>
        )
      });
      onChanged();
    } finally {
      setModeSubmitting(false);
    }
  }, [
    institution.code,
    modeBlocked,
    modeDirty,
    modeReason,
    notificationApi,
    onChanged,
    pendingMode
  ]);

  const handleToggleConfirm = useCallback(
    async (reason: string) => {
      if (!pendingToggle) {
        return;
      }
      const copy = OPTION_COPY[pendingToggle.field];
      const result =
        pendingToggle.field === 'autoHide'
          ? await setInstitutionAutoHideSafe({
              code: institution.code,
              enabled: pendingToggle.next,
              reason
            })
          : await setInstitutionAutoAssignSafe({
              code: institution.code,
              enabled: pendingToggle.next,
              reason
            });

      if (!result.ok) {
        notificationApi.error({
          message: `${copy.title} 변경 실패`,
          description: translateInstitutionContractError(result.error.message)
        });
        // 실패해도 확인 모달은 닫는다 — 열린 채 남으면 같은 사유로 계속 재실패한다.
        setPendingToggle(null);
        // 화면 값이 stale 해서 실패했을 수 있다 → 스스로 교정한다.
        onChanged();
        return;
      }

      notificationApi.success({
        message: `${copy.title} ${pendingToggle.next ? '켜짐' : '꺼짐'}`,
        description: (
          <Space direction="vertical">
            <Text>{pendingToggle.next ? copy.on : copy.off}</Text>
            <AuditLogLink targetType="InstitutionCode" targetId={institution.code} />
          </Space>
        )
      });
      setPendingToggle(null);
      onChanged();
    },
    [institution.code, notificationApi, onChanged, pendingToggle]
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={640}
      destroyOnHidden
      title={<DrawerTitle>노출 설정</DrawerTitle>}
      styles={mergeDrawerFrameStyles()}
      footer={
        <DrawerFooter
          start={<Button onClick={onClose}>취소</Button>}
          end={
            canManage ? (
              <Button
                type="primary"
                loading={modeSubmitting}
                disabled={!modeDirty || !modeReason.trim() || modeBlocked}
                onClick={() => void handleApplyMode()}
              >
                노출 모드 변경
              </Button>
            ) : null
          }
        />
      }
    >
      <div className="detail-drawer__body" data-testid="institution-exposure-settings-drawer">
        <div data-testid="institution-exposure-mode-section">
          <Text strong style={{ fontSize: 15 }}>
            노출 모드
          </Text>
          <div style={{ marginTop: 8 }}>
            {/*
              Select 가 아니라 Radio 인 이유: 값이 2개뿐이고 각 값마다 "그래서 학습자에게
              무엇이 보이는가"를 함께 읽혀야 한다. 소속 회원 전원의 노출 범위를 바꾸는
              스위치라 선택지가 접혀 있으면 안 된다.
            */}
            <Radio.Group
              value={pendingMode}
              disabled={!canManage}
              onChange={(event) => setPendingMode(event.target.value)}
            >
              <Space direction="vertical" size={8}>
                <Space direction="vertical" size={0}>
                  <Radio value="제한 없음">제한 없음</Radio>
                  <Text type="secondary" style={{ paddingInlineStart: 24 }}>
                    이 기관 학습자도 노출 허용 문항을 모두 봅니다. 앞으로 추가되는 문항도 자동
                    포함됩니다.
                  </Text>
                </Space>
                <Space direction="vertical" size={0}>
                  <Radio value="배정분만">배정분만</Radio>
                  <Text type="secondary" style={{ paddingInlineStart: 24 }}>
                    이 기관 학습자는 노출 문항에서 배정한 문항만 봅니다. 배정이 0건이면 쓰기
                    문항이 하나도 보이지 않습니다.
                  </Text>
                </Space>
              </Space>
            </Radio.Group>
          </div>

          {modeBlocked ? (
            <Alert
              type="error"
              showIcon
              style={{ marginTop: 10 }}
              message={`배정된 문항이 0건입니다. 지금 배정분만으로 바꾸면 이 코드 소속 학습자 ${institution.memberCount.toLocaleString()}명에게 쓰기 문항이 한 건도 보이지 않습니다.`}
              description="노출 문항에서 먼저 배정하세요."
            />
          ) : null}
          {modeZeroAssignedWarning ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 10 }}
              message="배정된 문항이 0건입니다. 앞으로 이 코드로 소속되는 학습자에게는 쓰기 문항이 보이지 않습니다."
            />
          ) : null}
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            배정 목록은 모드와 무관하게 보존됩니다. 배정분만으로 되돌리면 기존 배정이 그대로
            적용됩니다. 현재 배정 {assignedQuestionCount.toLocaleString()}건.
          </Text>

          {canManage ? (
            <div style={{ marginTop: 12 }}>
              <Text strong style={{ fontSize: 13 }}>
                사유 / 근거 <Text type="danger">*</Text>
              </Text>
              <Input.TextArea
                rows={2}
                value={modeReason}
                placeholder="감사 로그에 기록됩니다."
                style={{ marginTop: 6 }}
                onChange={(event) => setModeReason(event.target.value)}
              />
            </div>
          ) : null}
        </div>

        <Divider />

        <div data-testid="institution-exposure-options-section">
          <Text strong style={{ fontSize: 15 }}>
            계약 연동 옵션
          </Text>

          <Space direction="vertical" size={12} style={{ marginTop: 10, width: '100%' }}>
            <Space align="start" size={10}>
              <Switch
                // 옵션 값을 아직 못 읽었으면 토글을 잠근다. 기본값 false 로 그려두고 켜게 하면
                // "이미 켜져 있는데 꺼진 것처럼 보이는" 상태에서 잘못된 쓰기가 나간다.
                checked={exposureOptions?.autoHideOnExpiry ?? false}
                disabled={!canManage || !exposureOptions}
                onChange={(next) => setPendingToggle({ field: 'autoHide', next })}
                data-testid="institution-auto-hide-switch"
              />
              <Space direction="vertical" size={0}>
                <Text>{OPTION_COPY.autoHide.label}</Text>
                <Text type="secondary">
                  계약이 만료된 동안 노출 모드와 무관하게 전부 가립니다. 계약을 연장하면 배정된
                  문항이 그대로 다시 보입니다.
                </Text>
                {contractStatus && contractStatus.contractCount === 0 ? (
                  <Text type="secondary">
                    등록된 계약이 없어 이 옵션을 켜도 아무것도 가려지지 않습니다.
                  </Text>
                ) : null}
              </Space>
            </Space>

            <Space align="start" size={10}>
              <Switch
                checked={exposureOptions?.autoAssignNewQuestions ?? false}
                disabled={!canManage || !exposureOptions}
                onChange={(next) => setPendingToggle({ field: 'autoAssign', next })}
                data-testid="institution-auto-assign-switch"
              />
              <Space direction="vertical" size={0}>
                <Text>{OPTION_COPY.autoAssign.label}</Text>
                <Text type="secondary">
                  켠 이후 노출 전환되는 문항이 이 기관에 자동 배정됩니다. 이미 노출 중인 문항은
                  소급 배정되지 않습니다.
                </Text>
              </Space>
            </Space>
          </Space>
        </div>
      </div>

      {pendingToggle ? (
        <ConfirmAction
          open
          title={`${OPTION_COPY[pendingToggle.field].title} ${pendingToggle.next ? '켜기' : '끄기'}`}
          description={
            pendingToggle.next
              ? OPTION_COPY[pendingToggle.field].on
              : OPTION_COPY[pendingToggle.field].off
          }
          targetType="InstitutionCode"
          targetId={institution.code}
          confirmText={pendingToggle.next ? '켜기' : '끄기'}
          reasonPlaceholder="옵션 변경 사유를 입력하세요."
          onCancel={() => setPendingToggle(null)}
          onConfirm={handleToggleConfirm}
        />
      ) : null}
    </Drawer>
  );
}
