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
  Tooltip,
  Upload,
  Typography,
} from "antd";
import { InfoCircleOutlined, UploadOutlined } from "@ant-design/icons";
import type { DragEndEvent } from "@dnd-kit/core";
import { DndContext, PointerSensor, useSensor } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import dayjs, { type Dayjs } from "dayjs";
import type { UploadFile, UploadProps } from "antd";

import {
  fetchEventSafe,
  saveEventSafe,
  scheduleEventPublishSafe,
} from "../api/events-service";
import {
  operationEventExposureChannelValues,
  operationEventIndexingPolicyValues,
  operationEventRewardTypeValues,
  operationEventTypeValues,
  operationEventVisibilityStatusValues,
  type OperationEvent,
  type OperationEventBannerImage,
} from "../model/types";
import {
  findOperationEventRewardPolicyById,
  getOperationEventRewardPolicyOptionsByType,
} from "../model/event-form-schema";
import type { AsyncState } from "../../../shared/model/async-state";
import {
  DEFAULT_TINYMCE_PLUGINS,
  DEFAULT_TINYMCE_TOOLBAR,
  TinyMceHtmlEditor,
} from "../../../shared/ui/html-editor/tiny-mce-html-editor";
import {
  AdminEditorForm,
  AdminEditorFormSection,
} from "../../../shared/ui/admin-editor-form/admin-editor-form";
import { markRequiredDescriptionItems } from "../../../shared/ui/descriptions/description-label";
import { AdminListCard } from "../../../shared/ui/list-page-card/admin-list-card";
import { PageTitle } from "../../../shared/ui/page-title/page-title";
import { useMessageStore } from "../../message/model/message-store";

const { Text } = Typography;

type EventFormValues = {
  title: string;
  summary: string;
  bodyHtml: string;
  eventType: OperationEvent["eventType"];
  visibilityStatus: OperationEvent["visibilityStatus"];
  period: [Dayjs, Dayjs];
  exposureChannels: OperationEvent["exposureChannels"];
  targetGroupId: string;
  participantLimit: number | null;
  rewardType: OperationEvent["rewardType"];
  rewardPolicyId: string;
  messageTemplateId: string;
  bannerImages: OperationEventBannerImage[];
  landingUrl: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  indexingPolicy: OperationEvent["indexingPolicy"];
  adminMemo: string;
};

type SubmitMode = "save" | "schedule";

function createDefaultPeriod(): [Dayjs, Dayjs] {
  return [dayjs().startOf("day"), dayjs().add(7, "day").startOf("day")];
}

const eventCreateStepItems = [
  {
    key: "basic",
    title: "湲곕낯 ?뺣낫",
    description: "?대깽?몃챸, ?붿빟, ?좏삎",
  },
  {
    key: "body",
    title: "?대깽??蹂몃Ц",
    description: "상세/?쒕뵫 HTML",
  },
  {
    key: "exposure",
    title: "?몄텧 ?ㅼ젙",
    description: "?몄텧 상태, 湲곌컙, ?꾩튂",
  },
  {
    key: "participation",
    title: "李몄뿬 議곌굔",
    description: "대상洹몃９, 李몄뿬 ?쒗븳",
  },
  {
    key: "reward",
    title: "蹂댁긽 ?ㅼ젙",
    description: "蹂댁긽 ?좏삎, ?뺤콉, 硫붿떆吏",
  },
  {
    key: "seo",
    title: "?몄텧/SEO ?ㅼ젙",
    description: "怨듭쑀 硫뷀?, ?몃뜳???뺤콉",
  },
  {
    key: "memo",
    title: "관리자 메모",
    description: "운영 寃??硫붾え",
  },
] as const;

type EventCreateSectionKey = (typeof eventCreateStepItems)[number]["key"];

const eventCreateStepFieldMap: Record<
  EventCreateSectionKey,
  Array<keyof EventFormValues>
> = {
  basic: ["title", "summary", "eventType"],
  body: ["bodyHtml"],
  exposure: [
    "visibilityStatus",
    "period",
    "exposureChannels",
    "bannerImages",
    "landingUrl",
  ],
  participation: ["targetGroupId", "participantLimit"],
  reward: ["rewardType", "rewardPolicyId", "messageTemplateId"],
  seo: [
    "slug",
    "metaTitle",
    "metaDescription",
    "ogImageUrl",
    "canonicalUrl",
    "indexingPolicy",
  ],
  memo: ["adminMemo"],
};

function findStepIndexByFieldName(
  fieldName: string | number | undefined,
): number {
  if (typeof fieldName !== "string") {
    return 0;
  }

  const matchedStepIndex = eventCreateStepItems.findIndex((item) =>
    eventCreateStepFieldMap[item.key].includes(
      fieldName as keyof EventFormValues,
    ),
  );

  return matchedStepIndex >= 0 ? matchedStepIndex : 0;
}

function isRichTextEmpty(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  const plainText = value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();

  return plainText.length === 0;
}

function getFirstHiddenValidationError(
  values: Partial<EventFormValues>,
): { field: keyof EventFormValues; message: string } | null {
  if (!values.title?.trim()) {
    return { field: "title", message: "?대깽?몃챸???낅젰?섏꽭??" };
  }

  if (!values.summary?.trim()) {
    return { field: "summary", message: "?대깽???붿빟???낅젰?섏꽭??" };
  }

  if (isRichTextEmpty(values.bodyHtml)) {
    return { field: "bodyHtml", message: "?대깽??蹂몃Ц???낅젰?섏꽭??" };
  }

  if (!values.eventType) {
    return { field: "eventType", message: "?대깽???좏삎???좏깮?섏꽭??" };
  }

  if (!values.visibilityStatus) {
    return { field: "visibilityStatus", message: "?몄텧 상태瑜??좏깮?섏꽭??" };
  }

  if (!values.period?.[0] || !values.period?.[1]) {
    return { field: "period", message: "吏꾪뻾 湲곌컙???좏깮?섏꽭??" };
  }

  if (!values.exposureChannels?.length) {
    return { field: "exposureChannels", message: "?몄텧 ?꾩튂瑜??좏깮?섏꽭??" };
  }

  if (!values.targetGroupId?.trim()) {
    return { field: "targetGroupId", message: "대상洹몃９???좏깮?섏꽭??" };
  }

  if (!values.rewardType) {
    return { field: "rewardType", message: "蹂댁긽 ?좏삎???좏깮?섏꽭??" };
  }

  if (values.rewardType !== "?놁쓬" && !values.rewardPolicyId?.trim()) {
    return { field: "rewardPolicyId", message: "蹂댁긽 ?뺤콉???좏깮?섏꽭??" };
  }

  if (!values.indexingPolicy) {
    return { field: "indexingPolicy", message: "?몃뜳???뺤콉???좏깮?섏꽭??" };
  }

  return null;
}

type DraggableUploadListItemProps = {
  originNode: ReactElement;
  file: UploadFile;
};

function createTooltipLabel(
  label: string,
  tooltipMessage: ReactNode,
): ReactNode {
  return (
    <span className="event-form-tooltip-label">
      <span>{label}</span>
      <Tooltip title={tooltipMessage}>
        <span
          className="event-form-tooltip-label__icon"
          role="img"
          aria-label={`${label} ?덈궡`}
          tabIndex={0}
        >
          <InfoCircleOutlined />
        </span>
      </Tooltip>
    </span>
  );
}

function DraggableUploadListItem({
  originNode,
  file,
}: DraggableUploadListItemProps): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: file.uid,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        cursor: "move",
      }}
      className={isDragging ? "is-dragging" : undefined}
      {...attributes}
      {...listeners}
    >
      {file.status === "error" && isDragging
        ? originNode.props.children
        : originNode}
    </div>
  );
}

function createBannerUploadFile(
  bannerImage: OperationEventBannerImage,
): UploadFile {
  return {
    uid: bannerImage.uid,
    name: bannerImage.name,
    status: "done",
    url: bannerImage.url,
  };
}

function toBannerImages(fileList: UploadFile[]): OperationEventBannerImage[] {
  return fileList
    .map((file) => {
      const fileUrl =
        typeof file.url === "string"
          ? file.url
          : typeof file.thumbUrl === "string"
            ? file.thumbUrl
            : "";

      if (!fileUrl) {
        return null;
      }

      return {
        uid: file.uid,
        name: file.name,
        url: fileUrl,
      } satisfies OperationEventBannerImage;
    })
    .filter(
      (bannerImage): bannerImage is OperationEventBannerImage =>
        bannerImage !== null,
    );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read file."));
    };

    reader.readAsDataURL(file);
  });
}

async function normalizeUploadFileList(
  fileList: UploadFile[],
): Promise<UploadFile[]> {
  const normalizedFiles = await Promise.all(
    fileList.map(async (file) => {
      const currentUrl =
        typeof file.url === "string"
          ? file.url
          : typeof file.thumbUrl === "string"
            ? file.thumbUrl
            : "";

      if (currentUrl) {
        return {
          ...file,
          status: file.status === "error" ? "error" : "done",
          url: currentUrl,
          thumbUrl: currentUrl,
        } satisfies UploadFile;
      }

      if (file.originFileObj instanceof File) {
        const nextUrl = await readFileAsDataUrl(file.originFileObj);

        return {
          ...file,
          status: "done",
          url: nextUrl,
          thumbUrl: nextUrl,
        } satisfies UploadFile;
      }

      return file;
    }),
  );

  return normalizedFiles.filter(
    (file) => typeof file.url === "string" && file.url.length > 0,
  );
}

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
  const targetGroups = useMessageStore((state) => state.groups);
  const messageTemplates = useMessageStore((state) => state.templates);
  const selectedTargetGroupId = Form.useWatch("targetGroupId", form);
  const selectedRewardType = Form.useWatch("rewardType", form) ?? "?놁쓬";
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
  const uploadSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 10 },
  });
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
    const nextBannerImages = event?.bannerImages ?? [];

    form.setFieldsValue({
      title: event?.title ?? "",
      summary: event?.summary ?? "",
      bodyHtml: event?.bodyHtml ?? "",
      eventType: event?.eventType ?? "?꾨줈紐⑥뀡",
      visibilityStatus: event?.visibilityStatus ?? "숨김",
      period: event
        ? [dayjs(event.startAt), dayjs(event.endAt)]
        : createDefaultPeriod(),
      exposureChannels: event?.exposureChannels ?? ["?대깽????],
      targetGroupId: event?.targetGroupId ?? "",
      participantLimit: event?.participantLimit ?? null,
      rewardType: event?.rewardType ?? "?놁쓬",
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

    if (selectedRewardType === "?놁쓬" && currentRewardPolicyId) {
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
      const normalizedRewardType = values.rewardType ?? "?놁쓬";
      const normalizedRewardPolicyId =
        normalizedRewardType === "?놁쓬"
          ? ""
          : (values.rewardPolicyId?.trim() ?? "");
      const normalizedRewardPolicyName =
        normalizedRewardType === "?놁쓬"
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
        eventType: values.eventType ?? "?꾨줈紐⑥뀡",
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
            errorMessage: `?대깽???뺣낫????λ릱吏留?게시 예약??실패?덉뒿?덈떎. ${scheduleResult.error.message}`,
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
        state: {
          operationEventSaved: {
            eventId: saveResult.data.id,
            mode: isEdit ? "edit" : "create",
            action: mode,
          },
        },
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
      <PageTitle title={isEdit ? "?대깽???섏젙 상세" : "?대깽???깅줉 상세"} />

      {isEdit && eventState.status === "error" && !hasCachedEvent ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="?대깽??상세 ??곸쓣 遺덈윭?ㅼ? 紐삵뻽?듬땲??"
          description={
            <Space direction="vertical">
              <span>
                {eventState.errorMessage ?? "?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎."}
              </span>
              {eventState.errorCode ? (
                <span>?ㅻ쪟 肄붾뱶: {eventState.errorCode}</span>
              ) : null}
            </Space>
          }
          action={
            <Space>
              <Button size="small" onClick={handleReload}>
                ?ㅼ떆 ?쒕룄
              </Button>
              <Button type="primary" size="small" onClick={handleBackToList}>
                紐⑸줉?쇰줈
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
                紐⑸줉?쇰줈
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
                {isEdit ? "대상 : "?꾩떆 대상}
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
            message="?대깽??상세瑜?遺덈윭?ㅻ뒗 以묒엯?덈떎."
            description="??λ맂 ?대깽???뺣낫瑜??뺤씤?????섏젙?????덉뒿?덈떎."
          />
        ) : null}

        {isEdit && eventState.status === "pending" && hasCachedEvent ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="理쒖떊 ?대깽???뺣낫瑜??ㅼ떆 ?뺤씤?섎뒗 以묒엯?덈떎."
            description="留덉?留?성공 상태瑜??좎???梨?상세 ?뺣낫瑜?怨꾩냽 ?뺤씤?????덉뒿?덈떎."
          />
        ) : null}

        {submitState.status === "error" ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="?대깽????μ뿉 실패?덉뒿?덈떎."
            description={
              <Space direction="vertical">
                <span>
                  {submitState.errorMessage ?? "?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎."}
                </span>
                {submitState.errorCode ? (
                  <span>?ㅻ쪟 肄붾뱶: {submitState.errorCode}</span>
                ) : null}
              </Space>
            }
          />
        ) : null}

        {!isEdit || hasCachedEvent ? (
          <Form form={form} layout="vertical">
            <AdminEditorForm
              stepAriaLabel="?대깽???깅줉 ?④퀎"
              currentStep={currentStep}
              items={stepItems}
              onStepChange={handleStepChange}
            >
              {currentSectionKey === "basic" ? (
                <AdminEditorFormSection
                  title="湲곕낯 ?뺣낫"
                  description="?대깽?몄쓽 이름, ?붿빟, 湲곕낯 ?좏삎??癒쇱? ?뺤쓽?⑸땲??"
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={2}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={markRequiredDescriptionItems(
                      [
                        {
                          key: "title",
                          label: "?대깽?몃챸",
                          span: 2,
                          children: (
                            <Form.Item
                              name="title"
                              rules={[
                                {
                                  required: true,
                                  message: "?대깽?몃챸???낅젰?섏꽭??",
                                },
                              ]}
                            >
                              <Input placeholder="운영?먭? ?뺤씤???대깽?몃챸???낅젰?섏꽭??" />
                            </Form.Item>
                          ),
                        },
                        {
                          key: "summary",
                          label: "?대깽???붿빟",
                          span: 2,
                          children: (
                            <Form.Item
                              name="summary"
                              rules={[
                                {
                                  required: true,
                                  message: "?대깽???붿빟???낅젰?섏꽭??",
                                },
                              ]}
                            >
                              <Input.TextArea
                                rows={3}
                                placeholder="?대깽??설명怨?怨듭쑀 ?붿빟??사용자臾멸뎄瑜??낅젰?섏꽭??"
                              />
                            </Form.Item>
                          ),
                        },
                        {
                          key: "eventType",
                          label: "?대깽???좏삎",
                          children: (
                            <Form.Item
                              name="eventType"
                              rules={[
                                {
                                  required: true,
                                  message: "?대깽???좏삎???좏깮?섏꽭??",
                                },
                              ]}
                            >
                              <Select
                                options={operationEventTypeValues.map(
                                  (value) => ({
                                    label: value,
                                    value,
                                  }),
                                )}
                              />
                            </Form.Item>
                          ),
                        },
                      ],
                      ["title", "summary", "eventType"],
                    )}
                  />
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === "body" ? (
                <AdminEditorFormSection
                  title="?대깽??蹂몃Ц"
                  description="?대깽??상세? ?쒕뵫???몄텧??蹂몃Ц 肄섑뀗痢좊? ?몄쭛?⑸땲??"
                >
                  <Form.Item
                    name="bodyHtml"
                    rules={[
                      { required: true, message: "?대깽??蹂몃Ц???낅젰?섏꽭??" },
                    ]}
                    className="event-detail-editor-field"
                    style={{ marginBottom: 0 }}
                  >
                    <TinyMceHtmlEditor
                      editorId={`operation-event-editor-${event?.id ?? "new"}`}
                      height={420}
                      plugins={DEFAULT_TINYMCE_PLUGINS}
                      toolbar={DEFAULT_TINYMCE_TOOLBAR}
                    />
                  </Form.Item>
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === "exposure" ? (
                <AdminEditorFormSection
                  title="?몄텧 ?ㅼ젙"
                  description="운영?먯꽌 愿由ы븷 怨듦컻 ?쒖젏, ?몄텧 ?꾩튂, ?쒕뵫 ?먯궛??臾띠뼱???ㅼ젙?⑸땲??"
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={2}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={markRequiredDescriptionItems(
                      [
                        {
                          key: "visibilityStatus",
                          label: "湲곕낯 ?몄텧 상태",
                          children: (
                            <Form.Item
                              name="visibilityStatus"
                              rules={[
                                {
                                  required: true,
                                  message: "?몄텧 상태瑜??좏깮?섏꽭??",
                                },
                              ]}
                            >
                              <Select
                                options={operationEventVisibilityStatusValues.map(
                                  (value) => ({
                                    label: value,
                                    value,
                                  }),
                                )}
                              />
                            </Form.Item>
                          ),
                        },
                        {
                          key: "period",
                          label: "吏꾪뻾 湲곌컙",
                          children: (
                            <Form.Item
                              name="period"
                              rules={[
                                {
                                  required: true,
                                  message: "吏꾪뻾 湲곌컙???좏깮?섏꽭??",
                                },
                              ]}
                            >
                              <DatePicker.RangePicker
                                style={{ width: "100%" }}
                              />
                            </Form.Item>
                          ),
                        },
                        {
                          key: "exposureChannels",
                          label: "?몄텧 ?꾩튂",
                          span: 2,
                          children: (
                            <Form.Item
                              name="exposureChannels"
                              rules={[
                                {
                                  required: true,
                                  message: "?몄텧 ?꾩튂瑜??좏깮?섏꽭??",
                                },
                              ]}
                            >
                              <Select
                                mode="multiple"
                                options={operationEventExposureChannelValues.map(
                                  (value) => ({
                                    label: value,
                                    value,
                                  }),
                                )}
                              />
                            </Form.Item>
                          ),
                        },
                        {
                          key: "bannerImages",
                          label: "諛곕꼫 ?대?吏",
                          span: 2,
                          children: (
                            <div className="event-banner-upload">
                              <DndContext
                                sensors={[uploadSensor]}
                                onDragEnd={handleBannerUploadDragEnd}
                              >
                                <SortableContext
                                  items={bannerFileList.map((file) => file.uid)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <Upload
                                    accept="image/*"
                                    beforeUpload={() => false}
                                    fileList={bannerFileList}
                                    listType="text"
                                    multiple
                                    onChange={handleBannerUploadChange}
                                    itemRender={(originNode, file) => (
                                      <DraggableUploadListItem
                                        originNode={originNode}
                                        file={file}
                                      />
                                    )}
                                  >
                                    <Button
                                      icon={<UploadOutlined />}
                                      className="event-banner-upload__trigger"
                                    >
                                      {
                                        "\uBC30\uB108 \uC774\uBBF8\uC9C0 \uC5C5\uB85C\uB4DC"
                                      }
                                    </Button>
                                  </Upload>
                                </SortableContext>
                              </DndContext>
                              <Text type="secondary">
                                ?쒕옒洹몃줈 ?쒖꽌瑜?諛붽씀硫?泥?踰덉㎏ ?대?吏媛 대상                                諛곕꼫濡???λ맗?덈떎. mock ?④퀎?먯꽌??data URL??                                ??ν븯怨? DB/API ?④퀎?먯꽌???뺣젹 媛?ν븳 asset
                                list濡??꾪솚?⑸땲??
                              </Text>
                            </div>
                          ),
                        },
                        {
                          key: "bannerPreview",
                          label: "?꾩옱 諛곕꼫",
                          children: selectedBannerImageUrl ? (
                            <Text className="event-banner-upload__value">
                              {selectedBannerImages.length > 1
                                ? `珥?${selectedBannerImages.length}媛?쨌 대상${selectedBannerImageFileName || "泥⑤? ?대?吏"}`
                                : selectedBannerImageFileName || "泥⑤? ?대?吏"}
                            </Text>
                          ) : (
                            <Text type="secondary">
                              ?깅줉??諛곕꼫媛 ?놁뒿?덈떎.
                            </Text>
                          ),
                        },
                        {
                          key: "landingUrl",
                          label: "?쒕뵫 寃쎈줈",
                          span: 2,
                          children: (
                            <Form.Item name="landingUrl">
                              <Input placeholder="?? /events/spring-attendance" />
                            </Form.Item>
                          ),
                        },
                      ],
                      ["visibilityStatus", "period", "exposureChannels"],
                    )}
                  />
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === "participation" ? (
                <AdminEditorFormSection
                  title="李몄뿬 議곌굔"
                  description="?대깽????곴낵 李몄뿬 ?쒗븳 ?뺤콉??媛숈씠 愿由ы빀?덈떎."
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={2}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={markRequiredDescriptionItems(
                      [
                        {
                          key: "targetGroupId",
                          label: "대상洹몃９",
                          span: 2,
                          children: (
                            <Form.Item
                              name="targetGroupId"
                              rules={[
                                {
                                  required: true,
                                  message: "대상洹몃９???좏깮?섏꽭??",
                                },
                              ]}
                            >
                              <Select
                                showSearch
                                optionFilterProp="label"
                                options={targetGroupOptions}
                                placeholder="硫붿떆吏 > 대상洹몃９?먯꽌 愿由?以묒씤 洹몃９???좏깮?섏꽭??"
                              />
                            </Form.Item>
                          ),
                        },
                        {
                          key: "targetGroupSummary",
                          label: "?좏깮??洹몃９ ?뺣낫",
                          span: 2,
                          children: selectedTargetGroupId ? (
                            <Text type="secondary">
                              {targetGroupMap.get(selectedTargetGroupId)
                                ?.description ?? "?좏깮??洹몃９ 설명???놁뒿?덈떎."}
                            </Text>
                          ) : (
                            <Text type="secondary">
                              대상洹몃９???좏깮?섎㈃ 설명怨??곌껐 ID媛 ?쒖떆?⑸땲??
                            </Text>
                          ),
                        },
                        {
                          key: "participantLimit",
                          label: "李몄뿬 ?쒗븳",
                          span: 2,
                          children: (
                            <Form.Item name="participantLimit">
                              <InputNumber
                                min={0}
                                style={{ width: "100%" }}
                                placeholder="?쒗븳 ?놁쓬"
                              />
                            </Form.Item>
                          ),
                        },
                      ],
                      ["targetGroupId"],
                    )}
                  />
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === "reward" ? (
                <AdminEditorFormSection
                  title="蹂댁긽 ?ㅼ젙"
                  description="蹂댁긽 ?좏삎怨??곕룞 ?뺤콉, 硫붿떆吏 ?쒗뵆由우쓣 ??釉붾줉?먯꽌 ?뺤씤?⑸땲??"
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={2}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={markRequiredDescriptionItems(
                      [
                        {
                          key: "rewardType",
                          label: "蹂댁긽 ?좏삎",
                          children: (
                            <Form.Item
                              name="rewardType"
                              rules={[
                                {
                                  required: true,
                                  message: "蹂댁긽 ?좏삎???좏깮?섏꽭??",
                                },
                              ]}
                            >
                              <Select
                                options={operationEventRewardTypeValues.map(
                                  (value) => ({
                                    label: value,
                                    value,
                                  }),
                                )}
                              />
                            </Form.Item>
                          ),
                        },
                        {
                          key: "messageTemplateId",
                          label: createTooltipLabel(
                            "硫붿떆吏 ?쒗뵆由?,
                            "硫붿떆吏 > 硫붿씪/?몄떆?먯꽌 愿由ы븯???쒗뵆由우쓣 李몄“?⑸땲?? ?대깽?몄뿉??硫붿씪/?몄떆 以??대뼡 梨꾨꼸 ?쒗뵆由우쓣 ?덉슜?좎????뺤콉 ?뺤젙???꾩슂?⑸땲??",
                          ),
                          children: (
                            <Form.Item name="messageTemplateId">
                              <Select
                                showSearch
                                optionFilterProp="label"
                                options={messageTemplateOptions}
                                placeholder="硫붿떆吏 ?섏씠吏?먯꽌 愿由?以묒씤 ?쒗뵆由우쓣 ?좏깮?섏꽭??"
                                allowClear
                              />
                            </Form.Item>
                          ),
                        },
                        {
                          key: "rewardPolicyId",
                          label: "蹂댁긽 ?뺤콉",
                          span: 2,
                          children: (
                            <Form.Item
                              name="rewardPolicyId"
                              rules={[
                                {
                                  validator: async (_, value) => {
                                    if (selectedRewardType === "?놁쓬") {
                                      return;
                                    }

                                    if (value) {
                                      return;
                                    }

                                    throw new Error("蹂댁긽 ?뺤콉???좏깮?섏꽭??");
                                  },
                                },
                              ]}
                            >
                              <Select
                                showSearch
                                optionFilterProp="label"
                                options={rewardPolicyOptions}
                                placeholder={
                                  selectedRewardType === "?놁쓬"
                                    ? "蹂댁긽 ?놁쓬 ?좏깮 ???뺤콉 ?곌껐???꾩슂?섏? ?딆뒿?덈떎."
                                    : "蹂댁긽 ?좏삎??留욌뒗 ?뺤콉???좏깮?섏꽭??"
                                }
                                disabled={selectedRewardType === "?놁쓬"}
                                allowClear
                              />
                            </Form.Item>
                          ),
                        },
                      ],
                      ["rewardType"],
                    )}
                  />
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === "seo" ? (
                <AdminEditorFormSection
                  title="?몄텧/SEO ?ㅼ젙"
                  description="怨듦컻 ?대깽?몄뿉留??꾩슂??怨듭쑀 硫뷀?瑜?臾띠뼱???몄쭛?⑸땲??"
                >
                  <Space
                    direction="vertical"
                    size={12}
                    style={{ width: "100%" }}
                  >
                    <Alert
                      type="info"
                      showIcon
                      message="怨듦컻 ?대깽?몃쭔 override"
                      description="鍮꾩썙?먮㈃ ?대깽?몃챸, ?붿빟, 諛곕꼫 湲곗??쇰줈 ?먮룞 ?앹꽦?⑸땲??"
                    />
                    <Descriptions
                      bordered
                      size="small"
                      column={2}
                      className="admin-form-descriptions admin-editor-form-descriptions"
                      items={markRequiredDescriptionItems(
                        [
                          {
                            key: "slug",
                            label: "?щ윭洹?,
                            children: (
                              <Form.Item name="slug">
                                <Input placeholder="鍮꾩썙?먮㈃ ?대깽?몃챸 湲곗? ?먮룞 ?앹꽦" />
                              </Form.Item>
                            ),
                          },
                          {
                            key: "indexingPolicy",
                            label: "?몃뜳???뺤콉",
                            children: (
                              <Form.Item
                                name="indexingPolicy"
                                rules={[
                                  {
                                    required: true,
                                    message: "?몃뜳???뺤콉???좏깮?섏꽭??",
                                  },
                                ]}
                              >
                                <Select
                                  options={operationEventIndexingPolicyValues.map(
                                    (value) => ({
                                      label: value,
                                      value,
                                    }),
                                  )}
                                />
                              </Form.Item>
                            ),
                          },
                          {
                            key: "metaTitle",
                            label: "怨듭쑀 제목",
                            span: 2,
                            children: (
                              <Form.Item name="metaTitle">
                                <Input placeholder="鍮꾩썙?먮㈃ ?대깽?몃챸???먮룞 ?곸슜?⑸땲??" />
                              </Form.Item>
                            ),
                          },
                          {
                            key: "metaDescription",
                            label: "怨듭쑀 설명",
                            span: 2,
                            children: (
                              <Form.Item name="metaDescription">
                                <Input.TextArea
                                  rows={3}
                                  placeholder="鍮꾩썙?먮㈃ ?대깽???붿빟???먮룞 ?곸슜?⑸땲??"
                                />
                              </Form.Item>
                            ),
                          },
                          {
                            key: "ogImageUrl",
                            label: "怨듭쑀 ?대?吏 URL",
                            span: 2,
                            children: (
                              <Form.Item name="ogImageUrl">
                                <Input placeholder="鍮꾩썙?먮㈃ 諛곕꼫 ?대?吏媛 ?먮룞 ?곸슜?⑸땲??" />
                              </Form.Item>
                            ),
                          },
                          {
                            key: "canonicalUrl",
                            label: "대상URL",
                            span: 2,
                            children: (
                              <Form.Item name="canonicalUrl">
                                <Input placeholder="鍮꾩썙?먮㈃ ?쒕뵫 寃쎈줈/?щ윭洹?湲곗? ?먮룞 ?앹꽦?⑸땲??" />
                              </Form.Item>
                            ),
                          },
                        ],
                        ["indexingPolicy"],
                      )}
                    />
                  </Space>
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === "memo" ? (
                <AdminEditorFormSection
                  title="관리자 메모"
                  description="寃?섏? ?꾩냽 議곗튂???꾩슂??운영 硫붾え瑜?蹂꾨룄 蹂닿??⑸땲??"
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={[
                      {
                        key: "adminMemo",
                        label: "관리자 메모",
                        children: (
                          <Form.Item name="adminMemo">
                            <Input.TextArea
                              rows={5}
                              placeholder="운영 寃?? 諛곕꼫 吏묓뻾, ?꾩냽 議곗튂 硫붾え瑜??낅젰?섏꽭??"
                            />
                          </Form.Item>
                        ),
                      },
                    ]}
                  />
                </AdminEditorFormSection>
              ) : null}
            </AdminEditorForm>
          </Form>
        ) : null}
      </AdminListCard>
    </div>
  );
}


