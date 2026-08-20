import { Button, Drawer, Form, Input, InputNumber, Select } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import {
  inviteInstitutionMembersGuardedSafe,
  translateInstitutionContractError
} from '../../api/institution-contracts-service';
import { kickNotificationEmailDispatch } from '@/shared/api/notification-email-kick';
import { GLOBAL_INVITE_EXPIRY_DAYS } from '../../model/institution-contracts-types';
import type { InstitutionSettings } from '../../model/institution-contracts-types';
import type { NotificationApi } from './institution-code-detail-tab-types';
import {
  DrawerFooter,
  DrawerTitle,
  mergeDrawerFrameStyles
} from '@/shared/ui/drawer-frame/drawer-frame';

type InviteFormValues = {
  userIds: string[];
  reason: string;
  expiresInDays: number;
};

type InstitutionInviteDrawerProps = {
  open: boolean;
  onClose: () => void;
  code: string;
  settings: InstitutionSettings | null;
  /** 이미 소속이거나 대기 초대가 있는 회원을 뺀 피커 옵션. 로스터에 의존해 탭이 계산한다. */
  userOptions: { value: string; label: string }[];
  notificationApi: NotificationApi;
  /** 초대가 실제로 나갔을 때만 호출 — 탭이 로스터 재조회 + 셸 갱신을 한다. */
  onInvited: () => void;
};

/**
 * 회원 초대 Drawer.
 *
 * 초대는 "작업"이라 본문(로스터)을 밀어내지 않도록 툴바 버튼 뒤에 둔다. 정원 사전검사는
 * 서버도 하지만 왕복 전에 알려주면 운영자가 대상 인원을 바로 줄일 수 있어 여기서도 한다.
 *
 * 저장 실패 시 Drawer 를 닫지 않는다 — 고른 회원 목록을 잃지 않아야 재시도가 싸다.
 */
export function InstitutionInviteDrawer({
  open,
  onClose,
  code,
  settings,
  userOptions,
  notificationApi,
  onInvited
}: InstitutionInviteDrawerProps): JSX.Element {
  const [form] = Form.useForm<InviteFormValues>();
  const [submitting, setSubmitting] = useState(false);

  // 🚨 **열 때 초안을 버린다.** Drawer 는 탭에 상시 마운트돼 있고 rc-field-form 의 `preserve`
  // 기본값이 true 라, 닫아도 고른 회원과 사유가 폼 store 에 남는다. 그대로 두면 취소로 버린
  // 대상이 재오픈 때 되살아나고(`maxTagCount="responsive"` 라 `+N` 으로 접혀 눈에 안 띈다)
  // 의도치 않은 회원에게 실제 초대가 나간다.
  //
  // 실패 시 Drawer 를 열어둔 채 입력을 보존하는 계약(아래 handleSubmit)은 그대로다 —
  // 리셋은 **닫을 때가 아니라 열 때** 하므로 실패 후 재시도에는 영향이 없다.
  useEffect(() => {
    if (!open) {
      return;
    }
    form.resetFields();
    form.setFieldsValue({
      expiresInDays: settings?.defaultInviteExpiryDays ?? GLOBAL_INVITE_EXPIRY_DAYS
    });
    // deps 에 `defaultInviteExpiryDays` 를 넣지 않는다 — 열려 있는 동안 설정이 바뀌면
    // (다른 탭 저장 → 셸 재조회) 운영자가 고르던 회원 목록이 통째로 날아간다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, open]);

  const handleSubmit = useCallback(async () => {
    if (submitting) {
      return;
    }
    // submitting 을 검증 await 전에 세워 더블 서밋 창을 닫는다.
    setSubmitting(true);
    let values: InviteFormValues;
    try {
      values = await form.validateFields();
    } catch {
      setSubmitting(false);
      return;
    }
    if (!values.userIds || values.userIds.length === 0) {
      setSubmitting(false);
      return;
    }

    // 좌석 = 소속 회원 + 만료되지 않은 대기 초대(서버 계산과 같은 정의).
    const seatLimit = settings?.maxMembers ?? null;
    if (settings && seatLimit !== null && settings.seatsUsed + values.userIds.length > seatLimit) {
      setSubmitting(false);
      notificationApi.error({
        message: '정원 초과',
        description: `정원 ${seatLimit.toLocaleString()}명 중 ${settings.seatsUsed.toLocaleString()}명이 사용 중입니다(소속 회원 + 대기 초대). ${values.userIds.length.toLocaleString()}명을 더 초대할 수 없습니다.`
      });
      return;
    }

    const result = await inviteInstitutionMembersGuardedSafe(
      values.userIds,
      code,
      values.reason,
      // 폼에 값이 있으면 그것을, 비어 있으면 null 을 보내 서버가 기관 기본값으로 해석한다.
      values.expiresInDays ?? null
    );
    setSubmitting(false);

    if (!result.ok) {
      notificationApi.error({
        message: '초대 발송 실패',
        description: translateInstitutionContractError(result.error.message)
      });
      return;
    }

    if (result.data === 0) {
      notificationApi.info({
        message: '초대 대상 없음',
        description: '이미 소속이거나 대기 중 초대가 있어 새로 보낸 초대가 없습니다.'
      });
    } else {
      // 이메일이 cron 주기를 기다리지 않도록 워커 즉시 kick(실패해도 cron 이 수거).
      void kickNotificationEmailDispatch();
      notificationApi.success({
        message: '초대 발송 완료',
        description: `${result.data.toLocaleString()}명에게 초대를 보냈습니다. 인앱 알림은 즉시 전달되고 이메일 발송을 시작했습니다. 발송 결과는 메시지 ▸ 발송 이력에서 확인할 수 있습니다. (이미 소속·대기 중 제외)`
      });
    }
    form.resetFields();
    onInvited();
    onClose();
  }, [code, form, notificationApi, onClose, onInvited, settings, submitting]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={640}
      destroyOnHidden
      title={<DrawerTitle>회원 초대</DrawerTitle>}
      styles={mergeDrawerFrameStyles()}
      footer={
        <DrawerFooter
          start={<Button onClick={onClose}>취소</Button>}
          end={
            <Button type="primary" loading={submitting} onClick={() => void handleSubmit()}>
              선택 회원 초대
            </Button>
          }
        />
      }
    >
      <div className="detail-drawer__body" data-testid="institution-invite-drawer">
        <Form form={form} layout="vertical">
          <Form.Item
            label="회원 초대"
            name="userIds"
            rules={[{ required: true, message: '초대할 회원을 선택하세요.' }]}
            extra="초대 알림(인앱+이메일)이 발송되고, 회원이 수락해야 소속이 적용됩니다. 발송 내역은 메시지 ▸ 발송 이력에서 확인할 수 있습니다."
          >
            <Select
              mode="multiple"
              placeholder="이름 또는 이메일로 검색하세요."
              options={userOptions}
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
            />
          </Form.Item>
          <Form.Item
            label="만료 기간"
            name="expiresInDays"
            rules={[{ required: true, message: '만료 기간을 입력하세요.' }]}
            extra={
              settings?.defaultInviteExpiryDays !== null && settings
                ? `이 기간 안에 응답하지 않으면 초대가 만료됩니다. 기관 기본값 ${settings.defaultInviteExpiryDays}일이 채워져 있습니다.`
                : `이 기간 안에 응답하지 않으면 초대가 만료됩니다. 기관 기본값이 없어 전역 기본 ${GLOBAL_INVITE_EXPIRY_DAYS}일이 채워져 있습니다.`
            }
          >
            <InputNumber min={1} max={365} addonAfter="일" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item
            label="사유/근거"
            name="reason"
            rules={[{ required: true, message: '초대 사유를 입력하세요.' }]}
          >
            <Input.TextArea rows={2} placeholder="감사 기록에 남길 초대 사유를 입력하세요." />
          </Form.Item>
        </Form>
      </div>
    </Drawer>
  );
}
