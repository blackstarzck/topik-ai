import { Alert, Button, Divider, Input, Radio, Space, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { setInstitutionExposureModeSafe } from '../../api/institution-codes-service';
import { isInstitutionCodesSupabase } from '../../api/institution-codes-service';
import type {
  InstitutionCode,
  InstitutionExposureMode
} from '../../model/institution-codes-types';
import type { NotificationApi } from './institution-code-detail-tab-types';
import {
  InstitutionQuestionExposurePanel,
  type InstitutionQuestionMutationSummary
} from '../institution-question-exposure-panel';
import { AuditLogLink } from '../../../../shared/ui/audit-log-link/audit-log-link';

const { Text } = Typography;

/**
 * 노출 모드 변경 거부 사유를 운영자 언어로 바꾼다. 서버(빈 화면 가드)가 raw Postgres
 * 메시지를 던지므로 그대로 노출하지 않는다. 알려진 패턴이 아니면 원문을 유지한다.
 */
function translateExposureModeError(message: string): string {
  if (message.includes('cannot switch institution')) {
    return '배정된 문항이 0건이어서 배정분만으로 바꿀 수 없습니다. 소속 회원 또는 대기 중 초대가 있으면 그 학습자에게 쓰기 문항이 하나도 보이지 않습니다. 아래에서 먼저 배정하거나 회원 소속을 해제해 주세요.';
  }
  if (message.includes('missing permission')) {
    return '노출 모드를 바꿀 권한이 없습니다(users.institution-codes.manage).';
  }
  return message;
}

type InstitutionCodeQuestionsTabProps = {
  institution: InstitutionCode;
  exposureMode: InstitutionExposureMode;
  /** 셸이 모드 원장에서 읽은 실제 배정 건수. 전환 차단 판정의 입력값이다. */
  assignedQuestionCount: number;
  canManage: boolean;
  notificationApi: NotificationApi;
  onChanged: () => void;
};

/**
 * 노출 문항 탭 — 노출 모드 전환 + 문항 배정을 한 화면에 둔다.
 *
 * 구조상 이게 맞는 자리다: 모드 전환의 위험(배정 0건이면 소속 학습자에게 빈 화면)을
 * 판단하려면 배정 현황을 함께 봐야 한다. 구 수정 모달에 있을 때는 "노출 문항 열기" 버튼으로
 * 다른 모달로 건너가야 했지만, 이제 같은 탭 아래로 스크롤하면 된다.
 */
export function InstitutionCodeQuestionsTab({
  institution,
  exposureMode,
  assignedQuestionCount,
  canManage,
  notificationApi,
  onChanged
}: InstitutionCodeQuestionsTabProps): JSX.Element {
  const [pendingMode, setPendingMode] = useState<InstitutionExposureMode>(exposureMode);
  const [modeReason, setModeReason] = useState('');
  const [modeSubmitting, setModeSubmitting] = useState(false);

  // 셸이 재조회한 실제 모드로 선택을 되돌린다(적용 성공·실패 모두 이 경로로 수렴).
  useEffect(() => {
    setPendingMode(exposureMode);
    setModeReason('');
  }, [exposureMode]);

  // 배정 0건인데 `배정분만` 으로 바꾸려 하면 서버(빈 화면 가드)가 거부하므로,
  // 왕복 전에 화면에서 막고 이유를 알린다.
  const modeBlocked =
    pendingMode === '배정분만'
    && assignedQuestionCount === 0
    && institution.memberCount > 0;
  // 회원이 아직 없으면 차단하지 않는다 — 앞으로 소속될 학습자에 대한 경고만 남긴다.
  const modeZeroAssignedWarning =
    pendingMode === '배정분만'
    && assignedQuestionCount === 0
    && institution.memberCount === 0;
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

  const handleMutated = useCallback(
    (summary: InstitutionQuestionMutationSummary) => {
      const modeLabel = summary.mode === 'add' ? '추가' : '해제';
      const r = summary.result;
      const hasIssue = r.blocked > 0 || r.failed > 0;
      const description = (
        <Space direction="vertical" size={4}>
          <Text>
            변경 {r.changed.toLocaleString()}건 · 변경 없음 {r.unchanged.toLocaleString()}건
            {r.blocked > 0 ? ` · 차단 ${r.blocked.toLocaleString()}건` : ''}
            {r.failed > 0 ? ` · 실패 ${r.failed.toLocaleString()}건` : ''}
          </Text>
          {r.details.slice(0, 5).map((detail) => (
            <Text key={`${detail.kind}-${detail.questionId}`} type="secondary">
              [{detail.kind === 'blocked' ? '차단' : '실패'}] {detail.questionId}:{' '}
              {detail.message}
            </Text>
          ))}
        </Space>
      );
      const notify = hasIssue ? notificationApi.warning : notificationApi.success;
      notify({
        message: hasIssue
          ? `노출 문항 ${modeLabel} 일부 처리`
          : `노출 문항 ${modeLabel} 완료`,
        description
      });
      // 배정 건수가 바뀌었으니 모드 원장을 다시 읽어 전환 차단 판정을 갱신한다.
      onChanged();
    },
    [notificationApi, onChanged]
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* 사유 입력 placeholder 가 아래 배정 패널과 같아서 e2e 가 스코프를 잡을 수 있게 testid 를 준다. */}
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
                  이 기관 학습자는 아래에서 배정한 문항만 봅니다. 배정이 0건이면 쓰기 문항이
                  하나도 보이지 않습니다.
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
            description="아래 노출 문항에서 먼저 배정하세요."
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
            <Button
              type="primary"
              style={{ marginTop: 10 }}
              loading={modeSubmitting}
              disabled={!modeDirty || !modeReason.trim() || modeBlocked}
              onClick={() => void handleApplyMode()}
            >
              노출 모드 변경
            </Button>
          </div>
        ) : null}
      </div>

      <Divider style={{ margin: 0 }} />

      <div>
        <Text strong style={{ fontSize: 15 }}>
          노출 문항
        </Text>
        <div style={{ marginTop: 8 }}>
          <InstitutionQuestionExposurePanel
            institution={institution}
            exposureMode={exposureMode}
            canManage={canManage}
            isSupabase={isInstitutionCodesSupabase}
            onMutated={handleMutated}
          />
        </div>
      </div>
    </Space>
  );
}
