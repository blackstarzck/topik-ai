import { Button, Descriptions, Form, Input, Select, Space, Typography, notification } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  createInstitutionCodeSafe,
  isInstitutionCodesSupabase
} from '../api/institution-codes-service';
import {
  defaultInstitutionExposureMode,
  institutionCodeKinds
} from '../model/institution-codes-types';
import type { InstitutionCodeKind } from '../model/institution-codes-types';
import { InstitutionExposureModeTag } from '../ui/institution-exposure-mode-tag';
import { routerSavedState } from '../../../shared/model/router-saved-state';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { createDescriptionLabel } from '../../../shared/ui/descriptions/description-label';

const { Paragraph, Text } = Typography;

const CODE_PATTERN = /^[A-Za-z0-9_-]{2,64}$/;

/**
 * 상세 라우트(`/users/institution-codes/:code`)와 같은 깊이의 정적 세그먼트라 코드 값으로 쓰면
 * 그 코드의 상세 URL 이 영구히 가려진다. 코드 정규식이 허용하는 값이므로 폼에서 막는다.
 */
const RESERVED_CODES = new Set(['create']);

const kindOptions = institutionCodeKinds.map((kind) => ({ label: kind, value: kind }));

type CreateFormValues = {
  code: string;
  label: string;
  kind: InstitutionCodeKind;
  note?: string;
};

/**
 * 기관 코드 생성 전용 페이지. 구 목록 화면의 생성 모달을 승격한 것이다 —
 * 작성 맥락이 강한 화면은 Modal 보다 전용 페이지를 우선한다(admin-ux-ui-design 지침).
 * 생성 직후에는 목록이 아니라 상세 `노출 문항` 탭으로 보낸다: 회원 소속·초대 전에 배정 또는
 * 모드 전환을 끝내야 한다는 서버 선행조건을 화면 동선으로 그대로 옮긴 것이다.
 */
export default function InstitutionCodeCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [form] = Form.useForm<CreateFormValues>();
  const [submitting, setSubmitting] = useState(false);

  const listPath = '/users/institution-codes';
  const listSearch = useMemo(() => location.search, [location.search]);

  const handleBackToList = useCallback(() => {
    navigate(`${listPath}${listSearch}`);
  }, [listSearch, navigate]);

  const handleSubmit = useCallback(async () => {
    let values: CreateFormValues;
    try {
      values = await form.validateFields();
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

      // 성공 알림은 이 페이지에서 띄우지 않는다 — 곧바로 이동하면 contextHolder 가 함께
      // unmount 되어 알림이 사라진다. 공지 등록 선례처럼 router state 로 넘겨 목적지에서 띄운다.
      navigate(`${listPath}/${code}?tab=questions`, {
        replace: true,
        state: routerSavedState('institutionCodeCreated', { code, label })
      });
    } finally {
      setSubmitting(false);
    }
  }, [form, navigate, notificationApi]);

  const items = [
    {
      key: 'code',
      label: createDescriptionLabel('코드', { required: true }),
      children: (
        <Form.Item
          name="code"
          style={{ margin: 0 }}
          extra="QR 주소에 실리는 식별자 · 영문/숫자/-/_ 2~64자"
          rules={[
            { required: true, message: '코드를 입력하세요.' },
            {
              validator: async (_, value: string | undefined) => {
                const next = value?.trim() ?? '';
                if (!next) {
                  return;
                }
                if (!CODE_PATTERN.test(next)) {
                  throw new Error('영문/숫자/-/_ 2~64자만 사용할 수 있습니다.');
                }
                if (RESERVED_CODES.has(next.toLowerCase())) {
                  throw new Error('예약어라 코드로 사용할 수 없습니다.');
                }
              }
            }
          ]}
        >
          <Input placeholder="EXPO2026-BOOTH-A" autoComplete="off" />
        </Form.Item>
      )
    },
    {
      key: 'label',
      label: createDescriptionLabel('이름', { required: true }),
      children: (
        <Form.Item
          name="label"
          style={{ margin: 0 }}
          rules={[{ required: true, message: '이름을 입력하세요.' }]}
        >
          <Input placeholder="2026 한국어교육 박람회 · A부스" />
        </Form.Item>
      )
    },
    {
      key: 'kind',
      label: createDescriptionLabel('종류', { required: true }),
      children: (
        <Form.Item
          name="kind"
          style={{ margin: 0 }}
          rules={[{ required: true, message: '종류를 선택하세요.' }]}
        >
          <Select options={kindOptions} style={{ width: '100%' }} />
        </Form.Item>
      )
    },
    {
      key: 'exposureMode',
      label: '노출 모드',
      children: (
        <>
          {/*
            생성 RPC는 모드 값을 받지 않으며 원장 행이 없는 코드의 안전 기본값은 `배정분만` 이다.
            회원 소속·초대 전에 배정 또는 모드 전환을 끝내도록 서버 선행조건이 막으므로,
            여기서는 실제 기본값을 읽기 전용으로 안내하고 전환은 상세 노출 문항 탭에서만 받는다.
          */}
          <InstitutionExposureModeTag mode={defaultInstitutionExposureMode} />
          <Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
            새 코드는 배정분만으로 시작합니다. 생성 후 노출 문항 탭에서 문항을 최소 1건
            배정하거나 제한 없음으로 바꾸세요.
          </Text>
        </>
      )
    },
    {
      key: 'note',
      label: '메모',
      children: (
        <Form.Item name="note" style={{ margin: 0 }}>
          <Input.TextArea rows={2} placeholder="현장 QR 가입 · A부스" />
        </Form.Item>
      )
    }
  ];

  return (
    <>
      {notificationContextHolder}
      <PageTitle title="기관 코드 생성" />
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        박람회/기관 유입 QR에 실을 코드를 등록합니다. 생성 후 노출 문항 탭으로 이동합니다.
        {!isInstitutionCodesSupabase && ' (현재 mock 데이터 — 생성은 화면에만 반영됩니다.)'}
      </Paragraph>

      <AdminListCard>
        <Form form={form} layout="vertical" initialValues={{ kind: '박람회' }}>
          <Descriptions
            bordered
            column={1}
            size="small"
            labelStyle={{ width: 96, whiteSpace: 'nowrap' }}
            items={items}
          />
        </Form>
        <Space style={{ marginTop: 16 }}>
          <Button type="primary" loading={submitting} onClick={() => void handleSubmit()}>
            생성
          </Button>
          <Button onClick={handleBackToList}>취소</Button>
        </Space>
      </AdminListCard>
    </>
  );
}
