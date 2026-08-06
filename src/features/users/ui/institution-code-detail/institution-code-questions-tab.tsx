import { Alert, Button, Space, Tag, Typography } from 'antd';
import { useCallback, useState } from 'react';

import { isInstitutionCodesSupabase } from '../../api/institution-codes-service';
import type {
  InstitutionCode,
  InstitutionExposureMode
} from '../../model/institution-codes-types';
import type {
  InstitutionContractStatusSummary,
  InstitutionExposureOptions
} from '../../model/institution-contracts-types';
import type { NotificationApi } from './institution-code-detail-tab-types';
import { InstitutionExposureSettingsDrawer } from './institution-exposure-settings-drawer';
import { InstitutionTabToolbar } from './institution-tab-toolbar';
import {
  InstitutionQuestionExposurePanel,
  type InstitutionQuestionMutationSummary
} from '../institution-question-exposure-panel';

const { Text } = Typography;

type InstitutionCodeQuestionsTabProps = {
  institution: InstitutionCode;
  exposureMode: InstitutionExposureMode;
  /** 셸이 모드 원장에서 읽은 실제 배정 건수. 전환 차단 판정의 입력값이다. */
  assignedQuestionCount: number;
  /** 계약 연동 옵션 2종의 현재 값. null 이면 아직 못 읽은 상태(토글 비활성). */
  exposureOptions: InstitutionExposureOptions | null;
  /** 만료로 지금 가려져 있는지 알려면 계약 요약이 필요하다. */
  contractStatus: InstitutionContractStatusSummary | null;
  canManage: boolean;
  notificationApi: NotificationApi;
  onChanged: () => void;
};

/**
 * 노출 문항 탭 — 툴바(현재 설정 요약 + 설정 Drawer) + 본문(배정 도구).
 *
 * 예전에는 모드·계약 연동 옵션·배정 패널이 세로로 쌓여 사유 입력란 3개와 저장 버튼 3개가
 * 한 탭에 공존했고, 정작 본체인 배정 도구가 첫 화면 아래로 밀렸다. 설정 두 덩어리를 하나의
 * 노출 설정 Drawer 로 모으고, 판단에 필요한 값(모드·배정 건수·옵션 on/off)만 툴바에 남겼다.
 *
 * 배정 건수의 SoT 는 셸이 모드 원장에서 읽은 `assignedQuestionCount` 다. 패널이 자체 계산하는
 * 수는 저장 전 로컬 선택이 섞여 있어 요약에 쓰면 실제와 어긋난다.
 */
export function InstitutionCodeQuestionsTab({
  institution,
  exposureMode,
  assignedQuestionCount,
  exposureOptions,
  contractStatus,
  canManage,
  notificationApi,
  onChanged
}: InstitutionCodeQuestionsTabProps): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      <InstitutionTabToolbar
        summary={
          // 배정 패널도 자체 모드 Tag 를 그린다 → 요약에 testid 로 스코프를 준다.
          // 없으면 e2e 의 `제한 없음` 단언이 2개를 잡아 strict violation 이 난다.
          <Space size={8} wrap data-testid="institution-exposure-summary">
            <Tag color={exposureMode === '제한 없음' ? 'blue' : 'purple'}>{exposureMode}</Tag>
            <Text type="secondary">배정 {assignedQuestionCount.toLocaleString()}건</Text>
            {exposureOptions ? (
              <Text type="secondary">
                자동 비노출 {exposureOptions.autoHideOnExpiry ? '켬' : '끔'} · 자동 배정{' '}
                {exposureOptions.autoAssignNewQuestions ? '켬' : '끔'}
              </Text>
            ) : (
              <Text type="secondary">옵션 불러오는 중…</Text>
            )}
          </Space>
        }
        actions={
          <Button
            size="large"
            data-testid="institution-exposure-settings-open-button"
            onClick={() => setSettingsOpen(true)}
          >
            노출 설정
          </Button>
        }
      />

      {/* 현황 경보는 본문에 남긴다 — "지금 학습자에게 안 보인다"는 설정을 열어보기 전에
          알아야 하는 상태다. */}
      {contractStatus?.writingHiddenNow ? (
        <Alert
          type="error"
          showIcon
          message="계약이 만료되어 지금 이 기관 학습자에게 쓰기 문항이 보이지 않습니다."
          description="계약 탭에서 기간을 연장하면 즉시 다시 보입니다 — 배정된 문항은 그대로 남아 있어 다시 배정할 필요가 없습니다."
        />
      ) : null}

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

      <InstitutionExposureSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        institution={institution}
        exposureMode={exposureMode}
        assignedQuestionCount={assignedQuestionCount}
        exposureOptions={exposureOptions}
        contractStatus={contractStatus}
        canManage={canManage}
        notificationApi={notificationApi}
        onChanged={onChanged}
      />
    </Space>
  );
}
