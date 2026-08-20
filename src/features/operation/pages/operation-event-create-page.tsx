import { Alert, Button, Form, Space } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import type { UploadFile, UploadProps } from "antd";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import {
  fetchEventSafe,
  saveEventSafe,
  scheduleEventPublishSafe,
} from "../api/events-service";
import { fetchMessageOptionSourcesSafe } from "@/features/message/api/messages-service";
import type {
  MessageGroup,
  MessageTemplate,
} from "@/features/message/model/types";
import type { OperationEvent } from "../model/types";
import {
  findOperationEventRewardPolicyById,
  getOperationEventRewardPolicyOptionsByType,
} from "../model/event-form-schema";
import {
  createBannerUploadFile,
  createDefaultPeriod,
  eventCreateStepFieldMap,
  eventCreateStepItems,
  findStepIndexByFieldName,
  getFirstHiddenValidationError,
  normalizeUploadFileList,
  toBannerImages,
  type EventFormValues,
  type SubmitMode,
} from "../model/operation-event-create-page-schema";
import {
  EventBasicSection,
  EventBodySection,
  EventExposureSection,
  EventMemoSection,
  EventParticipationSection,
  EventRewardSection,
  EventSeoSection,
} from "../ui/operation-event-create-sections";
import type { AsyncState } from "@/shared/model/async-state";
import { routerSavedState } from "@/shared/model/router-saved-state";
import {
  AdminEditorForm,
} from "@/shared/ui/admin-editor-form/admin-editor-form";
import { AdminListCard } from "@/shared/ui/list-page-card/admin-list-card";
import { PageTitle } from "@/shared/ui/page-title/page-title";


export default function OperationEventCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId } = useParams<{ eventId?: string }>();
  const [form] = Form.useForm<EventFormValues>();
  const [eventState, setEventState] = useState<
    AsyncState<OperationEvent | null>
  >({
    status: eventId ? "pending" : "success",
    data: null,
    errorMessage: null,
    errorCode: null,
  });
  const [submitState, setSubmitState] = useState<
    AsyncState<OperationEvent | null>
  >({
    status: "idle",
    data: null,
    errorMessage: null,
    errorCode: null,
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [bannerFileList, setBannerFileList] = useState<UploadFile[]>([]);
  const [targetGroups, setTargetGroups] = useState<MessageGroup[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const selectedTargetGroupId = Form.useWatch("targetGroupId", form);
  const selectedRewardType = Form.useWatch("rewardType", form) ?? "없음";
  const selectedBannerImageUrl = Form.useWatch("bannerImageUrl", form);
  const selectedBannerImageFileName = Form.useWatch(
    "bannerImageFileName",
    form,
  );
  const selectedBannerImages = Form.useWatch("bannerImages", form) ?? [];

  const isEdit = Boolean(eventId);
  const event = eventState.data;
  const targetGroupMap = useMemo(
    () => new Map(targetGroups.map((group) => [group.id, group])),
    [targetGroups],
  );
  const messageTemplateMap = useMemo(
    () => new Map(messageTemplates.map((template) => [template.id, template])),
    [messageTemplates],
  );
  const targetGroupOptions = useMemo(
    () =>
      targetGroups.map((group) => ({
        label: `${group.name} (${group.id})`,
        value: group.id,
      })),
    [targetGroups],
  );
  const messageTemplateOptions = useMemo(
    () =>
      messageTemplates.map((template) => ({
        label: `${template.name} (${template.id})`,
        value: template.id,
      })),
    [messageTemplates],
  );
  const rewardPolicyOptions = useMemo(
    () =>
      getOperationEventRewardPolicyOptionsByType(selectedRewardType).map(
        (policy) => ({
          label: `${policy.name} (${policy.id})`,
          value: policy.id,
        }),
      ),
    [selectedRewardType],
  );
  const listPath = "/operation/events";
  const listSearch = useMemo(() => {
    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.delete("selected");
    const search = nextSearchParams.toString();
    return search ? `?${search}` : "";
  }, [location.search]);

  useEffect(() => {
    if (!isEdit || !eventId) {
      setEventState({
        status: "success",
        data: null,
        errorMessage: null,
        errorCode: null,
      });
      return;
    }

    const controller = new AbortController();

    setEventState((prev) => ({
      ...prev,
      status: "pending",
      errorMessage: null,
      errorCode: null,
    }));

    void fetchEventSafe(eventId, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setEventState({
          status: "success",
          data: result.data,
          errorMessage: null,
          errorCode: null,
        });
        return;
      }

      setEventState((prev) => ({
        ...prev,
        status: "error",
        errorMessage: result.error.message,
        errorCode: result.error.code,
      }));
    });

    return () => {
      controller.abort();
    };
  }, [eventId, isEdit, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();

    void fetchMessageOptionSourcesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted || !result.ok) {
        return;
      }

      setTargetGroups(result.data.groups);
      setMessageTemplates(result.data.templates);
    });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const nextBannerImages = event?.bannerImages ?? [];

    form.setFieldsValue({
      title: event?.title ?? "",
      summary: event?.summary ?? "",
      bodyHtml: event?.bodyHtml ?? "",
      eventType: event?.eventType ?? "프로모션",
      visibilityStatus: event?.visibilityStatus ?? "숨김",
      period: event
        ? [dayjs(event.startAt), dayjs(event.endAt)]
        : createDefaultPeriod(),
      exposureChannels: event?.exposureChannels ?? ["이벤트 탭"],
      targetGroupId: event?.targetGroupId ?? "",
      participantLimit: event?.participantLimit ?? null,
      rewardType: event?.rewardType ?? "없음",
      rewardPolicyId: event?.rewardPolicyId ?? "",
      messageTemplateId: event?.messageTemplateId ?? "",
      bannerImageUrl: event?.bannerImageUrl ?? "",
      bannerImageSourceType: "file",
      bannerImageFileName: event?.bannerImageFileName ?? "",
      bannerImages: nextBannerImages,
      landingUrl: event?.landingUrl ?? "",
      slug: event?.slug ?? "",
      metaTitle: event?.metaTitle ?? "",
      metaDescription: event?.metaDescription ?? "",
      ogImageUrl: event?.ogImageUrl ?? "",
      canonicalUrl: event?.canonicalUrl ?? "",
      indexingPolicy: event?.indexingPolicy ?? "index",
      adminMemo: event?.adminMemo ?? "",
    });
    setBannerFileList(nextBannerImages.map(createBannerUploadFile));
  }, [event, form]);

  useEffect(() => {
    const currentRewardPolicyId = form.getFieldValue("rewardPolicyId");
    const selectedPolicy = currentRewardPolicyId
      ? findOperationEventRewardPolicyById(currentRewardPolicyId)
      : undefined;

    if (selectedRewardType === "없음" && currentRewardPolicyId) {
      form.setFieldValue("rewardPolicyId", "");
      return;
    }

    if (
      currentRewardPolicyId &&
      selectedPolicy &&
      selectedPolicy.rewardType !== selectedRewardType
    ) {
      form.setFieldValue("rewardPolicyId", "");
    }
  }, [form, selectedRewardType]);

  const handleBackToList = useCallback(() => {
    navigate(`${listPath}${listSearch}`);
  }, [listPath, listSearch, navigate]);

  const handleReload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleBannerUploadChange = useCallback<
    NonNullable<UploadProps["onChange"]>
  >(
    async ({ fileList: nextFileList }) => {
      const normalizedFiles = await normalizeUploadFileList(nextFileList);

      setBannerFileList(normalizedFiles);
      form.setFieldsValue({
        bannerImageSourceType: "file",
        bannerImageUrl: normalizedFiles[0]?.url ?? "",
        bannerImageFileName: normalizedFiles[0]?.name ?? "",
        bannerImages: toBannerImages(normalizedFiles),
      });
    },
    [form],
  );

  const handleBannerUploadDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) {
        return;
      }

      setBannerFileList((prev) => {
        const activeIndex = prev.findIndex((item) => item.uid === active.id);
        const overIndex = prev.findIndex((item) => item.uid === over.id);

        if (activeIndex < 0 || overIndex < 0) {
          return prev;
        }

        const reorderedFiles = arrayMove(prev, activeIndex, overIndex);

        form.setFieldsValue({
          bannerImageUrl: reorderedFiles[0]?.url ?? "",
          bannerImageFileName: reorderedFiles[0]?.name ?? "",
          bannerImages: toBannerImages(reorderedFiles),
        });

        return reorderedFiles;
      });
    },
    [form],
  );

  const handleStepChange = useCallback((next: number) => {
    setCurrentStep(next);
  }, []);
  const currentSectionKey = eventCreateStepItems[currentStep]?.key ?? "basic";

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
        const nextStepIndex = findStepIndexByFieldName(
          hiddenValidationError.field,
        );

        setCurrentStep(nextStepIndex);

        window.setTimeout(() => {
          void form
            .validateFields([hiddenValidationError.field])
            .catch(() => undefined);
        }, 0);

        return;
      }

      setSubmitState({
        status: "pending",
        data: null,
        errorMessage: null,
        errorCode: null,
      });

      const selectedTargetGroup = values.targetGroupId
        ? targetGroupMap.get(values.targetGroupId)
        : undefined;
      const selectedRewardPolicy = values.rewardPolicyId
        ? findOperationEventRewardPolicyById(values.rewardPolicyId)
        : undefined;
      const selectedMessageTemplate = values.messageTemplateId
        ? messageTemplateMap.get(values.messageTemplateId)
        : undefined;
      const normalizedRewardType = values.rewardType ?? "없음";
      const normalizedRewardPolicyId =
        normalizedRewardType === "없음"
          ? ""
          : (values.rewardPolicyId?.trim() ?? "");
      const normalizedRewardPolicyName =
        normalizedRewardType === "없음"
          ? ""
          : (selectedRewardPolicy?.name ?? "");

      const normalizedBannerImages = values.bannerImages ?? [];
      const representativeBannerImage = normalizedBannerImages[0];

      const saveResult = await saveEventSafe({
        id: event?.id,
        title: values.title?.trim() ?? "",
        summary: values.summary?.trim() ?? "",
        bodyHtml: values.bodyHtml ?? "",
        slug: values.slug?.trim() ?? "",
        eventType: values.eventType ?? "프로모션",
        visibilityStatus: values.visibilityStatus ?? "숨김",
        startAt:
          values.period?.[0]?.format("YYYY-MM-DD") ??
          dayjs().format("YYYY-MM-DD"),
        endAt:
          values.period?.[1]?.format("YYYY-MM-DD") ??
          dayjs().add(7, "day").format("YYYY-MM-DD"),
        exposureChannels: values.exposureChannels ?? [],
        targetGroupId: values.targetGroupId?.trim() ?? "",
        targetGroupName: selectedTargetGroup?.name ?? "",
        participantLimit: values.participantLimit ?? null,
        rewardType: normalizedRewardType,
        rewardPolicyId: normalizedRewardPolicyId,
        rewardPolicyName: normalizedRewardPolicyName,
        messageTemplateId: values.messageTemplateId?.trim() ?? "",
        bannerImageUrl: representativeBannerImage?.url ?? "",
        bannerImageSourceType: "file",
        bannerImageFileName: representativeBannerImage?.name ?? "",
        bannerImages: normalizedBannerImages,
        landingUrl: values.landingUrl?.trim() ?? "",
        messageTemplateName: selectedMessageTemplate?.name ?? "",
        metaTitle: values.metaTitle?.trim() ?? "",
        metaDescription: values.metaDescription?.trim() ?? "",
        ogImageUrl: values.ogImageUrl?.trim() ?? "",
        canonicalUrl: values.canonicalUrl?.trim() ?? "",
        indexingPolicy: values.indexingPolicy ?? "index",
        adminMemo: values.adminMemo?.trim() ?? "",
      });

      if (!saveResult.ok) {
        setSubmitState({
          status: "error",
          data: null,
          errorMessage: saveResult.error.message,
          errorCode: saveResult.error.code,
        });
        return;
      }

      setEventState({
        status: "success",
        data: saveResult.data,
        errorMessage: null,
        errorCode: null,
      });

      if (mode === "schedule") {
        const scheduleResult = await scheduleEventPublishSafe({
          eventId: saveResult.data.id,
        });

        if (!scheduleResult.ok) {
          setSubmitState({
            status: "error",
            data: saveResult.data,
            errorMessage: `이벤트 정보는 저장됐지만 게시 예약에 실패했습니다. ${scheduleResult.error.message}`,
            errorCode: scheduleResult.error.code,
          });
          return;
        }
      }

      setSubmitState({
        status: "success",
        data: saveResult.data,
        errorMessage: null,
        errorCode: null,
      });

      const nextSearchParams = new URLSearchParams(listSearch);
      nextSearchParams.set("selected", saveResult.data.id);

      const nextSearch = nextSearchParams.toString();

      navigate(`${listPath}${nextSearch ? `?${nextSearch}` : ""}`, {
        replace: true,
        state: routerSavedState("operationEventSaved", {
          eventId: saveResult.data.id,
          mode: isEdit ? "edit" : "create",
          action: mode,
        }),
      });
    },
    [
      currentSectionKey,
      event,
      form,
      isEdit,
      listPath,
      listSearch,
      messageTemplateMap,
      navigate,
      targetGroupMap,
    ],
  );

  const hasCachedEvent = Boolean(event);
  const isLoadingInitialEvent =
    isEdit && eventState.status === "pending" && !hasCachedEvent;
  const isSubmitting = submitState.status === "pending";
  const isSaveDisabled = isSubmitting || (isEdit && !hasCachedEvent);
  const stepItems = useMemo(
    () =>
      eventCreateStepItems.map((item) => ({
        title: item.title,
        description: item.description,
      })),
    [],
  );

  return (
    <div className="content-editor-page">
      <PageTitle title={isEdit ? "이벤트 수정 상세" : "이벤트 등록 상세"} />

      {isEdit && eventState.status === "error" && !hasCachedEvent ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="이벤트 상세 대상을 불러오지 못했습니다."
          description={
            <Space direction="vertical">
              <span>
                {eventState.errorMessage ?? "일시적인 오류가 발생했습니다."}
              </span>
              {eventState.errorCode ? (
                <span>오류 코드: {eventState.errorCode}</span>
              ) : null}
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
                  onClick={() => void handleSubmit("schedule")}
                  loading={isSubmitting}
                  disabled={isSaveDisabled}
                >
                  게시 예약
                </Button>
              ) : null}
              <Button
                type="primary"
                size="large"
                onClick={() => void handleSubmit("save")}
                loading={isSubmitting}
                disabled={isSaveDisabled}
              >
                {isEdit ? "저장" : "임시 저장"}
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

        {isEdit && eventState.status === "pending" && hasCachedEvent ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="최신 이벤트 정보를 다시 확인하는 중입니다."
            description="마지막 성공 상태를 유지한 채 상세 정보를 계속 확인할 수 있습니다."
          />
        ) : null}

        {submitState.status === "error" ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="이벤트 저장에 실패했습니다."
            description={
              <Space direction="vertical">
                <span>
                  {submitState.errorMessage ?? "일시적인 오류가 발생했습니다."}
                </span>
                {submitState.errorCode ? (
                  <span>오류 코드: {submitState.errorCode}</span>
                ) : null}
              </Space>
            }
          />
        ) : null}

        {!isEdit || hasCachedEvent ? (
          <Form form={form} layout="vertical">
            <AdminEditorForm
              stepAriaLabel="이벤트 등록 단계"
              currentStep={currentStep}
              items={stepItems}
              onStepChange={handleStepChange}
            >
              {currentSectionKey === "basic" ? <EventBasicSection /> : null}

              {currentSectionKey === "body" ? (
                <EventBodySection eventId={event?.id} />
              ) : null}

              {currentSectionKey === "exposure" ? (
                <EventExposureSection
                  bannerFileList={bannerFileList}
                  onBannerChange={handleBannerUploadChange}
                  onBannerDragEnd={handleBannerUploadDragEnd}
                  selectedBannerImageUrl={selectedBannerImageUrl}
                  selectedBannerImageFileName={selectedBannerImageFileName}
                  selectedBannerImages={selectedBannerImages}
                />
              ) : null}

              {currentSectionKey === "participation" ? (
                <EventParticipationSection
                  targetGroupOptions={targetGroupOptions}
                  targetGroupMap={targetGroupMap}
                  selectedTargetGroupId={selectedTargetGroupId}
                />
              ) : null}

              {currentSectionKey === "reward" ? (
                <EventRewardSection
                  rewardPolicyOptions={rewardPolicyOptions}
                  messageTemplateOptions={messageTemplateOptions}
                  selectedRewardType={selectedRewardType}
                />
              ) : null}

              {currentSectionKey === "seo" ? <EventSeoSection /> : null}

              {currentSectionKey === "memo" ? <EventMemoSection /> : null}
            </AdminEditorForm>
          </Form>
        ) : null}
      </AdminListCard>
    </div>
  );
}
