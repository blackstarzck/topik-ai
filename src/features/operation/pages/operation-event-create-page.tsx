import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Steps,
  Typography
} from 'antd';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';

import {
  fetchEventSafe,
  saveEventSafe,
  scheduleEventPublishSafe
} from '../api/events-service';
import {
  operationEventExposureChannelValues,
  operationEventIndexingPolicyValues,
  operationEventRewardTypeValues,
  operationEventTypeValues,
  operationEventVisibilityStatusValues,
  type OperationEvent
} from '../model/types';
import type { AsyncState } from '../../../shared/model/async-state';
import {
  DEFAULT_TINYMCE_PLUGINS,
  DEFAULT_TINYMCE_TOOLBAR,
  TinyMceHtmlEditor
} from '../../../shared/ui/html-editor/tiny-mce-html-editor';
import { markRequiredDescriptionItems } from '../../../shared/ui/descriptions/description-label';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Title, Text } = Typography;

type EventFormValues = {
  title: string;
  summary: string;
  bodyHtml: string;
  eventType: OperationEvent['eventType'];
  visibilityStatus: OperationEvent['visibilityStatus'];
  period: [Dayjs, Dayjs];
  exposureChannels: OperationEvent['exposureChannels'];
  targetGroupId: string;
  targetGroupName: string;
  participantLimit: number | null;
  rewardType: OperationEvent['rewardType'];
  rewardPolicyId: string;
  rewardPolicyName: string;
  bannerImageUrl: string;
  landingUrl: string;
  messageTemplateName: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  indexingPolicy: OperationEvent['indexingPolicy'];
  adminMemo: string;
};

type SubmitMode = 'save' | 'schedule';

function createDefaultPeriod(): [Dayjs, Dayjs] {
  return [dayjs().startOf('day'), dayjs().add(7, 'day').startOf('day')];
}

const eventCreateStepItems = [
  {
    key: 'basic',
    title: '기본 정보',
    description: '이벤트명, 요약, 유형'
  },
  {
    key: 'body',
    title: '이벤트 본문',
    description: '상세/랜딩 HTML'
  },
  {
    key: 'exposure',
    title: '노출 설정',
    description: '노출 상태, 기간, 위치'
  },
  {
    key: 'participation',
    title: '참여 조건',
    description: '대상 그룹, 참여 제한'
  },
  {
    key: 'reward',
    title: '보상 설정',
    description: '보상 유형, 정책, 메시지'
  },
  {
    key: 'seo',
    title: '노출/SEO 설정',
    description: '공유 메타, 인덱싱 정책'
  },
  {
    key: 'memo',
    title: '관리자 메모',
    description: '운영 검수 메모'
  }
] as const;

type EventCreateSectionKey = (typeof eventCreateStepItems)[number]['key'];

const eventCreateStepFieldMap: Record<EventCreateSectionKey, Array<keyof EventFormValues>> = {
  basic: ['title', 'summary', 'eventType'],
  body: ['bodyHtml'],
  exposure: ['visibilityStatus', 'period', 'exposureChannels', 'bannerImageUrl', 'landingUrl'],
  participation: ['targetGroupId', 'targetGroupName', 'participantLimit'],
  reward: ['rewardType', 'rewardPolicyId', 'rewardPolicyName', 'messageTemplateName'],
  seo: [
    'slug',
    'metaTitle',
    'metaDescription',
    'ogImageUrl',
    'canonicalUrl',
    'indexingPolicy'
  ],
  memo: ['adminMemo']
};

function findStepIndexByFieldName(fieldName: string | number | undefined): number {
  if (typeof fieldName !== 'string') {
    return 0;
  }

  const matchedStepIndex = eventCreateStepItems.findIndex((item) =>
    eventCreateStepFieldMap[item.key].includes(fieldName as keyof EventFormValues)
  );

  return matchedStepIndex >= 0 ? matchedStepIndex : 0;
}

function isRichTextEmpty(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  const plainText = value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();

  return plainText.length === 0;
}

function getFirstHiddenValidationError(
  values: Partial<EventFormValues>
): { field: keyof EventFormValues; message: string } | null {
  if (!values.title?.trim()) {
    return { field: 'title', message: '이벤트명을 입력하세요.' };
  }

  if (!values.summary?.trim()) {
    return { field: 'summary', message: '이벤트 요약을 입력하세요.' };
  }

  if (isRichTextEmpty(values.bodyHtml)) {
    return { field: 'bodyHtml', message: '이벤트 본문을 입력하세요.' };
  }

  if (!values.eventType) {
    return { field: 'eventType', message: '이벤트 유형을 선택하세요.' };
  }

  if (!values.visibilityStatus) {
    return { field: 'visibilityStatus', message: '노출 상태를 선택하세요.' };
  }

  if (!values.period?.[0] || !values.period?.[1]) {
    return { field: 'period', message: '진행 기간을 선택하세요.' };
  }

  if (!values.exposureChannels?.length) {
    return { field: 'exposureChannels', message: '노출 위치를 선택하세요.' };
  }

  if (!values.targetGroupId?.trim()) {
    return { field: 'targetGroupId', message: '대상 그룹 ID를 입력하세요.' };
  }

  if (!values.targetGroupName?.trim()) {
    return { field: 'targetGroupName', message: '대상 그룹명을 입력하세요.' };
  }

  if (!values.rewardType) {
    return { field: 'rewardType', message: '보상 유형을 선택하세요.' };
  }

  if (!values.indexingPolicy) {
    return { field: 'indexingPolicy', message: '인덱싱 정책을 선택하세요.' };
  }

  return null;
}

type EventCreateFormSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
};

function EventCreateFormSection({ title, description, children }: EventCreateFormSectionProps): JSX.Element {
  return (
    <section className="event-create-form-section">
      <div className="event-create-form-section__header">
        <Title level={5} className="event-create-form-section__title">
          {title}
        </Title>
        <Text className="event-create-form-section__description">{description}</Text>
      </div>
      <div className="event-create-form-section__content">{children}</div>
    </section>
  );
}

export default function OperationEventCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId } = useParams<{ eventId?: string }>();
  const [form] = Form.useForm<EventFormValues>();
  const [eventState, setEventState] = useState<AsyncState<OperationEvent | null>>({
    status: eventId ? 'pending' : 'success',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [submitState, setSubmitState] = useState<AsyncState<OperationEvent | null>>({
    status: 'idle',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const isEdit = Boolean(eventId);
  const event = eventState.data;
  const listPath = '/operation/events';
  const listSearch = useMemo(() => {
    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.delete('selected');
    const search = nextSearchParams.toString();
    return search ? `?${search}` : '';
  }, [location.search]);

  useEffect(() => {
    if (!isEdit || !eventId) {
      setEventState({
        status: 'success',
        data: null,
        errorMessage: null,
        errorCode: null
      });
      return;
    }

    const controller = new AbortController();

    setEventState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchEventSafe(eventId, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setEventState({
          status: 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setEventState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [eventId, isEdit, reloadKey]);

  useEffect(() => {
    form.setFieldsValue({
      title: event?.title ?? '',
      summary: event?.summary ?? '',
      bodyHtml: event?.bodyHtml ?? '',
      eventType: event?.eventType ?? '프로모션',
      visibilityStatus: event?.visibilityStatus ?? '숨김',
      period: event ? [dayjs(event.startAt), dayjs(event.endAt)] : createDefaultPeriod(),
      exposureChannels: event?.exposureChannels ?? ['이벤트 탭'],
      targetGroupId: event?.targetGroupId ?? '',
      targetGroupName: event?.targetGroupName ?? '',
      participantLimit: event?.participantLimit ?? null,
      rewardType: event?.rewardType ?? '없음',
      rewardPolicyId: event?.rewardPolicyId ?? '',
      rewardPolicyName: event?.rewardPolicyName ?? '',
      bannerImageUrl: event?.bannerImageUrl ?? '',
      landingUrl: event?.landingUrl ?? '',
      messageTemplateName: event?.messageTemplateName ?? '',
      slug: event?.slug ?? '',
      metaTitle: event?.metaTitle ?? '',
      metaDescription: event?.metaDescription ?? '',
      ogImageUrl: event?.ogImageUrl ?? '',
      canonicalUrl: event?.canonicalUrl ?? '',
      indexingPolicy: event?.indexingPolicy ?? 'index',
      adminMemo: event?.adminMemo ?? ''
    });
  }, [event, form]);

  const handleBackToList = useCallback(() => {
    navigate(`${listPath}${listSearch}`);
  }, [listPath, listSearch, navigate]);

  const handleReload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleStepChange = useCallback((next: number) => {
    setCurrentStep(next);
  }, []);
  const currentSectionKey = eventCreateStepItems[currentStep]?.key ?? 'basic';

  const handleSubmit = useCallback(
    async (mode: SubmitMode) => {
      if (isEdit && !event) {
        return;
      }

      const activeFieldNames = eventCreateStepFieldMap[currentSectionKey];

      try {
        await form.validateFields(activeFieldNames);
      } catch (error) {
        const firstErrorFieldName = (
          error as { errorFields?: Array<{ name?: Array<string | number> }> }
        ).errorFields?.[0]?.name?.[0];

        setCurrentStep(findStepIndexByFieldName(firstErrorFieldName));
        return;
      }

      const values = form.getFieldsValue(true) as Partial<EventFormValues>;
      const hiddenValidationError = getFirstHiddenValidationError(values);

      if (hiddenValidationError) {
        const nextStepIndex = findStepIndexByFieldName(hiddenValidationError.field);

        setCurrentStep(nextStepIndex);

        window.setTimeout(() => {
          void form.validateFields([hiddenValidationError.field]).catch(() => undefined);
        }, 0);

        return;
      }

      setSubmitState({
        status: 'pending',
        data: null,
        errorMessage: null,
        errorCode: null
      });

      const saveResult = await saveEventSafe({
        id: event?.id,
        title: values.title?.trim() ?? '',
        summary: values.summary?.trim() ?? '',
        bodyHtml: values.bodyHtml ?? '',
        slug: values.slug?.trim() ?? '',
        eventType: values.eventType ?? '프로모션',
        visibilityStatus: values.visibilityStatus ?? '숨김',
        startAt: values.period?.[0]?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
        endAt:
          values.period?.[1]?.format('YYYY-MM-DD') ??
          dayjs().add(7, 'day').format('YYYY-MM-DD'),
        exposureChannels: values.exposureChannels ?? [],
        targetGroupId: values.targetGroupId?.trim() ?? '',
        targetGroupName: values.targetGroupName?.trim() ?? '',
        participantLimit: values.participantLimit ?? null,
        rewardType: values.rewardType ?? '없음',
        rewardPolicyId: values.rewardPolicyId?.trim() ?? '',
        rewardPolicyName: values.rewardPolicyName?.trim() ?? '',
        bannerImageUrl: values.bannerImageUrl?.trim() ?? '',
        landingUrl: values.landingUrl?.trim() ?? '',
        messageTemplateName: values.messageTemplateName?.trim() ?? '',
        metaTitle: values.metaTitle?.trim() ?? '',
        metaDescription: values.metaDescription?.trim() ?? '',
        ogImageUrl: values.ogImageUrl?.trim() ?? '',
        canonicalUrl: values.canonicalUrl?.trim() ?? '',
        indexingPolicy: values.indexingPolicy ?? 'index',
        adminMemo: values.adminMemo?.trim() ?? ''
      });

      if (!saveResult.ok) {
        setSubmitState({
          status: 'error',
          data: null,
          errorMessage: saveResult.error.message,
          errorCode: saveResult.error.code
        });
        return;
      }

      setEventState({
        status: 'success',
        data: saveResult.data,
        errorMessage: null,
        errorCode: null
      });

      if (mode === 'schedule') {
        const scheduleResult = await scheduleEventPublishSafe({
          eventId: saveResult.data.id
        });

        if (!scheduleResult.ok) {
          setSubmitState({
            status: 'error',
            data: saveResult.data,
            errorMessage: `이벤트 정보는 저장됐지만 게시 예약에 실패했습니다. ${scheduleResult.error.message}`,
            errorCode: scheduleResult.error.code
          });
          return;
        }
      }

      setSubmitState({
        status: 'success',
        data: saveResult.data,
        errorMessage: null,
        errorCode: null
      });

      const nextSearchParams = new URLSearchParams(listSearch);
      nextSearchParams.set('selected', saveResult.data.id);

      const nextSearch = nextSearchParams.toString();

      navigate(`${listPath}${nextSearch ? `?${nextSearch}` : ''}`, {
        replace: true,
        state: {
          operationEventSaved: {
            eventId: saveResult.data.id,
            mode: isEdit ? 'edit' : 'create',
            action: mode
          }
        }
      });
    },
    [currentSectionKey, event, form, isEdit, listPath, listSearch, navigate]
  );

  const hasCachedEvent = Boolean(event);
  const isLoadingInitialEvent = isEdit && eventState.status === 'pending' && !hasCachedEvent;
  const isSubmitting = submitState.status === 'pending';
  const isSaveDisabled = isSubmitting || (isEdit && !hasCachedEvent);
  const stepItems = useMemo(
    () =>
      eventCreateStepItems.map((item) => ({
        title: item.title,
        description: item.description
      })),
    []
  );

  return (
    <div className="content-editor-page">
      <PageTitle title={isEdit ? '이벤트 수정 상세' : '이벤트 등록 상세'} />

      {isEdit && eventState.status === 'error' && !hasCachedEvent ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="이벤트 상세 대상을 불러오지 못했습니다."
          description={
            <Space direction="vertical">
              <span>{eventState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</span>
              {eventState.errorCode ? <span>오류 코드: {eventState.errorCode}</span> : null}
            </Space>
          }
          action={
            <Space>
              <Button size="small" onClick={handleReload}>
                다시 시도
              </Button>
              <Button type="primary" size="small" onClick={handleBackToList}>
                목록으로
              </Button>
            </Space>
          }
        />
      ) : null}

      <AdminListCard
        className="content-editor-detail-card"
        toolbar={
          <div className="content-editor-toolbar">
            <Space className="content-editor-toolbar-actions" wrap>
              <Button size="large" onClick={handleBackToList}>
                목록으로
              </Button>
              {isEdit ? (
                <Button
                  size="large"
                  onClick={() => void handleSubmit('schedule')}
                  loading={isSubmitting}
                  disabled={isSaveDisabled}
                >
                  게시 예약
                </Button>
              ) : null}
              <Button
                type="primary"
                size="large"
                onClick={() => void handleSubmit('save')}
                loading={isSubmitting}
                disabled={isSaveDisabled}
              >
                저장
              </Button>
            </Space>
          </div>
        }
      >
        {isLoadingInitialEvent ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="이벤트 상세를 불러오는 중입니다."
            description="저장된 이벤트 정보를 확인한 뒤 수정할 수 있습니다."
          />
        ) : null}

        {isEdit && eventState.status === 'pending' && hasCachedEvent ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="최신 이벤트 정보를 다시 확인하는 중입니다."
            description="마지막 성공 상태를 유지한 채 상세 정보를 계속 확인할 수 있습니다."
          />
        ) : null}

        {submitState.status === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="이벤트 저장에 실패했습니다."
            description={
              <Space direction="vertical">
                <span>{submitState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</span>
                {submitState.errorCode ? <span>오류 코드: {submitState.errorCode}</span> : null}
              </Space>
            }
          />
        ) : null}

        {!isEdit || hasCachedEvent ? (
          <Form form={form} layout="vertical">
            <div className="event-create-form-shell">
              <aside className="event-create-form-steps" aria-label="이벤트 등록 단계">
                <Steps
                  current={currentStep}
                  direction="vertical"
                  progressDot
                  items={stepItems}
                  onChange={handleStepChange}
                />
              </aside>
              <div className="event-create-form-layout">
                {currentSectionKey === 'basic' ? (
                  <EventCreateFormSection
                    title="기본 정보"
                    description="이벤트의 이름, 요약, 기본 유형을 먼저 정의합니다."
                  >
                  <Descriptions
                    bordered
                    size="small"
                    column={2}
                    className="admin-form-descriptions"
                    items={markRequiredDescriptionItems([
                      {
                        key: 'title',
                        label: '이벤트명',
                        span: 2,
                        children: (
                          <Form.Item
                            name="title"
                            rules={[{ required: true, message: '이벤트명을 입력하세요.' }]}
                          >
                            <Input placeholder="운영자가 확인할 이벤트명을 입력하세요." />
                          </Form.Item>
                        )
                      },
                      {
                        key: 'summary',
                        label: '이벤트 요약',
                        span: 2,
                        children: (
                          <Form.Item
                            name="summary"
                            rules={[{ required: true, message: '이벤트 요약을 입력하세요.' }]}
                          >
                            <Input.TextArea
                              rows={3}
                              placeholder="이벤트 설명과 공유 요약에 사용할 문구를 입력하세요."
                            />
                          </Form.Item>
                        )
                      },
                      {
                        key: 'eventType',
                        label: '이벤트 유형',
                        children: (
                          <Form.Item
                            name="eventType"
                            rules={[{ required: true, message: '이벤트 유형을 선택하세요.' }]}
                          >
                            <Select
                              options={operationEventTypeValues.map((value) => ({
                                label: value,
                                value
                              }))}
                            />
                          </Form.Item>
                        )
                      }
                    ], ['title', 'summary', 'eventType'])}
                  />
                  </EventCreateFormSection>
                ) : null}

                {currentSectionKey === 'body' ? (
                  <EventCreateFormSection
                    title="이벤트 본문"
                    description="이벤트 상세와 랜딩에 노출할 본문 콘텐츠를 편집합니다."
                  >
                <Form.Item
                  name="bodyHtml"
                  rules={[{ required: true, message: '이벤트 본문을 입력하세요.' }]}
                  className="event-detail-editor-field"
                  style={{ marginBottom: 0 }}
                >
                  <TinyMceHtmlEditor
                    editorId={`operation-event-editor-${event?.id ?? 'new'}`}
                    height={420}
                    plugins={DEFAULT_TINYMCE_PLUGINS}
                    toolbar={DEFAULT_TINYMCE_TOOLBAR}
                  />
                </Form.Item>
                  </EventCreateFormSection>
                ) : null}

                {currentSectionKey === 'exposure' ? (
                  <EventCreateFormSection
                    title="노출 설정"
                    description="운영에서 관리할 공개 시점, 노출 위치, 랜딩 자산을 묶어서 설정합니다."
                  >
                <Descriptions
                  bordered
                  size="small"
                  column={2}
                  className="admin-form-descriptions"
                  items={markRequiredDescriptionItems([
                    {
                      key: 'visibilityStatus',
                      label: '기본 노출 상태',
                      children: (
                        <Form.Item
                          name="visibilityStatus"
                          rules={[{ required: true, message: '노출 상태를 선택하세요.' }]}
                        >
                          <Select
                            options={operationEventVisibilityStatusValues.map((value) => ({
                              label: value,
                              value
                            }))}
                          />
                        </Form.Item>
                      )
                    },
                    {
                      key: 'period',
                      label: '진행 기간',
                      children: (
                        <Form.Item
                          name="period"
                          rules={[{ required: true, message: '진행 기간을 선택하세요.' }]}
                        >
                          <DatePicker.RangePicker style={{ width: '100%' }} />
                        </Form.Item>
                      )
                    },
                    {
                      key: 'exposureChannels',
                      label: '노출 위치',
                      span: 2,
                      children: (
                        <Form.Item
                          name="exposureChannels"
                          rules={[{ required: true, message: '노출 위치를 선택하세요.' }]}
                        >
                          <Select
                            mode="multiple"
                            options={operationEventExposureChannelValues.map((value) => ({
                              label: value,
                              value
                            }))}
                          />
                        </Form.Item>
                      )
                    },
                    {
                      key: 'bannerImageUrl',
                      label: '배너 이미지 URL',
                      span: 2,
                      children: (
                        <Form.Item name="bannerImageUrl">
                          <Input placeholder="대표 배너 URL을 입력하세요." />
                        </Form.Item>
                      )
                    },
                    {
                      key: 'landingUrl',
                      label: '랜딩 경로',
                      span: 2,
                      children: (
                        <Form.Item name="landingUrl">
                          <Input placeholder="예: /events/spring-attendance" />
                        </Form.Item>
                      )
                    }
                  ], ['visibilityStatus', 'period', 'exposureChannels'])}
                />
                  </EventCreateFormSection>
                ) : null}

                {currentSectionKey === 'participation' ? (
                  <EventCreateFormSection
                    title="참여 조건"
                    description="이벤트 대상과 참여 제한 정책을 같이 관리합니다."
                  >
                <Descriptions
                  bordered
                  size="small"
                  column={2}
                  className="admin-form-descriptions"
                  items={markRequiredDescriptionItems([
                    {
                      key: 'targetGroupId',
                      label: '대상 그룹 ID',
                      children: (
                        <Form.Item
                          name="targetGroupId"
                          rules={[{ required: true, message: '대상 그룹 ID를 입력하세요.' }]}
                        >
                          <Input placeholder="예: SEG-ACTIVE-001" />
                        </Form.Item>
                      )
                    },
                    {
                      key: 'targetGroupName',
                      label: '대상 그룹명',
                      children: (
                        <Form.Item
                          name="targetGroupName"
                          rules={[{ required: true, message: '대상 그룹명을 입력하세요.' }]}
                        >
                          <Input placeholder="예: 최근 30일 활성 학습자" />
                        </Form.Item>
                      )
                    },
                    {
                      key: 'participantLimit',
                      label: '참여 제한',
                      span: 2,
                      children: (
                        <Form.Item name="participantLimit">
                          <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            placeholder="제한 없음"
                          />
                        </Form.Item>
                      )
                    }
                  ], ['targetGroupId', 'targetGroupName'])}
                />
                  </EventCreateFormSection>
                ) : null}

                {currentSectionKey === 'reward' ? (
                  <EventCreateFormSection
                    title="보상 설정"
                    description="보상 유형과 연동 정책, 메시지 템플릿을 한 블록에서 확인합니다."
                  >
                <Descriptions
                  bordered
                  size="small"
                  column={2}
                  className="admin-form-descriptions"
                  items={markRequiredDescriptionItems([
                    {
                      key: 'rewardType',
                      label: '보상 유형',
                      children: (
                        <Form.Item
                          name="rewardType"
                          rules={[{ required: true, message: '보상 유형을 선택하세요.' }]}
                        >
                          <Select
                            options={operationEventRewardTypeValues.map((value) => ({
                              label: value,
                              value
                            }))}
                          />
                        </Form.Item>
                      )
                    },
                    {
                      key: 'messageTemplateName',
                      label: '메시지 템플릿',
                      children: (
                        <Form.Item name="messageTemplateName">
                          <Input placeholder="연결할 메일/푸시 템플릿명을 입력하세요." />
                        </Form.Item>
                      )
                    },
                    {
                      key: 'rewardPolicyId',
                      label: '보상 정책 ID',
                      children: (
                        <Form.Item name="rewardPolicyId">
                          <Input placeholder="예: POINT-100" />
                        </Form.Item>
                      )
                    },
                    {
                      key: 'rewardPolicyName',
                      label: '보상 정책명',
                      children: (
                        <Form.Item name="rewardPolicyName">
                          <Input placeholder="예: 출석 7일 누적 100P" />
                        </Form.Item>
                      )
                    }
                  ], ['rewardType'])}
                />
                  </EventCreateFormSection>
                ) : null}

                {currentSectionKey === 'seo' ? (
                  <EventCreateFormSection
                    title="노출/SEO 설정"
                    description="공개 이벤트에만 필요한 공유 메타를 묶어서 편집합니다."
                  >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Alert
                    type="info"
                    showIcon
                    message="공개 이벤트만 override"
                    description="비워두면 이벤트명, 요약, 배너 기준으로 자동 생성됩니다."
                  />
                  <Descriptions
                    bordered
                    size="small"
                    column={2}
                    className="admin-form-descriptions"
                    items={markRequiredDescriptionItems([
                      {
                        key: 'slug',
                        label: '슬러그',
                        children: (
                          <Form.Item name="slug">
                            <Input placeholder="비워두면 이벤트명 기준 자동 생성" />
                          </Form.Item>
                        )
                      },
                      {
                        key: 'indexingPolicy',
                        label: '인덱싱 정책',
                        children: (
                          <Form.Item
                            name="indexingPolicy"
                            rules={[{ required: true, message: '인덱싱 정책을 선택하세요.' }]}
                          >
                            <Select
                              options={operationEventIndexingPolicyValues.map((value) => ({
                                label: value,
                                value
                              }))}
                            />
                          </Form.Item>
                        )
                      },
                      {
                        key: 'metaTitle',
                        label: '공유 제목',
                        span: 2,
                        children: (
                          <Form.Item name="metaTitle">
                            <Input placeholder="비워두면 이벤트명이 자동 적용됩니다." />
                          </Form.Item>
                        )
                      },
                      {
                        key: 'metaDescription',
                        label: '공유 설명',
                        span: 2,
                        children: (
                          <Form.Item name="metaDescription">
                            <Input.TextArea
                              rows={3}
                              placeholder="비워두면 이벤트 요약이 자동 적용됩니다."
                            />
                          </Form.Item>
                        )
                      },
                      {
                        key: 'ogImageUrl',
                        label: '공유 이미지 URL',
                        span: 2,
                        children: (
                          <Form.Item name="ogImageUrl">
                            <Input placeholder="비워두면 배너 이미지가 자동 적용됩니다." />
                          </Form.Item>
                        )
                      },
                      {
                        key: 'canonicalUrl',
                        label: '대표 URL',
                        span: 2,
                        children: (
                          <Form.Item name="canonicalUrl">
                            <Input placeholder="비워두면 랜딩 경로/슬러그 기준 자동 생성됩니다." />
                          </Form.Item>
                        )
                      }
                    ], ['indexingPolicy'])}
                  />
                </Space>
                  </EventCreateFormSection>
                ) : null}

                {currentSectionKey === 'memo' ? (
                  <EventCreateFormSection
                    title="관리자 메모"
                    description="검수와 후속 조치에 필요한 운영 메모를 별도 보관합니다."
                  >
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  className="admin-form-descriptions"
                  items={[
                    {
                      key: 'adminMemo',
                      label: '관리자 메모',
                      children: (
                        <Form.Item name="adminMemo">
                          <Input.TextArea
                            rows={5}
                            placeholder="운영 검수, 배너 집행, 후속 조치 메모를 입력하세요."
                          />
                        </Form.Item>
                      )
                    }
                  ]}
                />
                  </EventCreateFormSection>
                ) : null}
              </div>
            </div>
          </Form>
        ) : null}
      </AdminListCard>
    </div>
  );
}
