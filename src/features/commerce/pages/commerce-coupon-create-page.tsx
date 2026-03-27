import { InfoCircleOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import dayjs, { type Dayjs } from "dayjs";

import { fetchCouponSafe, saveCouponSafe } from "../api/coupons-service";
import {
  createCouponDraftDefaults,
  getCouponAutoIssueTriggerOptions,
  getCouponBenefitTypeOptions,
  getCouponCodeGenerationOptions,
  getCouponIssueTargetOptions,
  getCouponPolicyNotes,
  parseCouponUserIds,
  serializeCouponUserIds,
} from "../model/coupon-form-schema";
import {
  getCouponKindLabel,
  type CommerceCoupon,
  type CouponKind,
  type CouponValidityMode,
} from "../model/coupon-types";
import type { AsyncState } from "../../../shared/model/async-state";
import {
  AdminEditorForm,
  AdminEditorFormSection,
} from "../../../shared/ui/admin-editor-form/admin-editor-form";
import { markRequiredDescriptionItems } from "../../../shared/ui/descriptions/description-label";
import { AdminListCard } from "../../../shared/ui/list-page-card/admin-list-card";
import { PageTitle } from "../../../shared/ui/page-title/page-title";
import { useMessageStore } from "../../message/model/message-store";

const { Text } = Typography;

type CouponFormValues = {
  couponName: string;
  issueTargetType: CommerceCoupon["issueTargetType"];
  targetGroupId: string;
  targetUserIdsText: string;
  autoIssueTriggerType: CommerceCoupon["autoIssueTriggerType"];
  codeGenerationMode: CommerceCoupon["codeGenerationMode"];
  couponCode: string;
  codeCount: number | null;
  audience: CommerceCoupon["audience"];
  benefitType: CommerceCoupon["benefitType"];
  benefitValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  applicableScope: CommerceCoupon["applicableScope"];
  isStackable: boolean;
  isSecretCoupon: boolean;
  issueLimitMode: CommerceCoupon["issueLimitMode"];
  issueLimit: number | null;
  downloadLimitMode: CommerceCoupon["downloadLimitMode"];
  downloadLimit: number | null;
  usageLimitMode: CommerceCoupon["usageLimitMode"];
  usageLimit: number | null;
  validityMode: CommerceCoupon["validityMode"];
  validityRange: [Dayjs, Dayjs];
  expireAfterDays: number | null;
  linkedMessageTemplateId: string;
  linkedCrmCampaignId: string;
  linkedEventId: string;
  issueAlertEnabled: boolean;
  issueAlertChannel: CommerceCoupon["issueAlert"]["channel"];
  expireAlertEnabled: boolean;
  expireAlertChannel: CommerceCoupon["expireAlert"]["channel"];
  adminMemo: string;
};

type CouponKindMeta = {
  description: string;
  examples: string[];
  basicDescription: string;
  operationsDescription: string;
  alertDescription: string | null;
};

const couponKindMetaMap: Record<CouponKind, CouponKindMeta> = {
  customerDownload: {
    description: "고객이 직접 다운로드해서 사용하는 일반 쿠폰을 설정합니다.",
    examples: ["장바구니 쿠폰", "이벤트 쿠폰", "채널 친구 추가 쿠폰"],
    basicDescription:
      "쿠폰명, 발행 대상, 쿠폰 수량과 시크릿 쿠폰 정책을 설정합니다.",
    operationsDescription: "사용 기간, 발급 후 만료, 사용 횟수를 설정합니다.",
    alertDescription: "발급 알림과 만료 알림, 미리보기 위치를 정리합니다.",
  },
  autoIssue: {
    description: "조건을 만족한 고객에게 자동으로 발행되는 쿠폰을 설정합니다.",
    examples: [
      "신규 회원 웰컴 쿠폰",
      "생일 쿠폰",
      "첫 구매 쿠폰",
      "쇼핑 적립금 쿠폰",
    ],
    basicDescription: "자동 발행 트리거와 기본 쿠폰명을 설정합니다.",
    operationsDescription:
      "발급 후 만료 또는 무기한 정책과 사용 횟수를 설정합니다.",
    alertDescription: "발급 알림, 만료 알림, CRM 연동 위치를 안내합니다.",
  },
  couponCode: {
    description: "코드를 입력해 사용하는 쿠폰을 발행합니다.",
    examples: ["오프라인 쿠폰", "시크릿 코드 쿠폰"],
    basicDescription:
      "대상 범위, 단일 또는 복수 코드 생성, 입력 정책을 설정합니다.",
    operationsDescription: "고정 사용 기간과 사용 횟수를 설정합니다.",
    alertDescription: null,
  },
  manualIssue: {
    description:
      "특정 그룹 또는 특정 회원에게 직접 발행하는 쿠폰을 설정합니다.",
    examples: ["정기 멤버십 혜택", "재구매 유도 쿠폰"],
    basicDescription:
      "발행 대상을 전체 회원, 특정 그룹, 특정 회원으로 나누어 설정합니다.",
    operationsDescription: "사용 시작일과 종료일을 고정 기간으로 설정합니다.",
    alertDescription:
      "푸시 알림 발송 영역은 구조만 맞추고 후속 연동은 placeholder로 둡니다.",
  },
};

function parseCouponKind(value: string | null): CouponKind {
  if (
    value === "autoIssue" ||
    value === "couponCode" ||
    value === "manualIssue"
  ) {
    return value;
  }

  return "customerDownload";
}

function createDefaultValidityRange(): [Dayjs, Dayjs] {
  return [dayjs().startOf("day"), dayjs().add(30, "day").startOf("day")];
}

function resolveCouponStatus(
  validityMode: CouponFormValues["validityMode"],
  validityRange: CouponFormValues["validityRange"],
): CommerceCoupon["couponStatus"] {
  if (validityMode !== "fixedDate") {
    return "진행 중";
  }

  const today = dayjs().startOf("day");

  if (today.isBefore(validityRange[0], "day")) {
    return "대기";
  }

  if (today.isAfter(validityRange[1], "day")) {
    return "종료";
  }

  return "진행 중";
}

function getAllowedValidityModes(couponKind: CouponKind): CouponValidityMode[] {
  if (couponKind === "customerDownload") {
    return ["fixedDate", "afterIssued", "unlimited"];
  }

  if (couponKind === "autoIssue") {
    return ["afterIssued", "unlimited"];
  }

  if (couponKind === "couponCode") {
    return ["fixedDate", "unlimited"];
  }

  return ["fixedDate"];
}

type CouponCreateSectionKey =
  | "basic"
  | "benefit"
  | "operation"
  | "alert"
  | "memo";

const couponCreateSectionMeta: Record<
  CouponCreateSectionKey,
  { title: string; description: string }
> = {
  basic: {
    title: "기본 정보",
    description: "쿠폰명과 발행 대상, 발행 수량 정책을 설정합니다.",
  },
  benefit: {
    title: "혜택 설정",
    description: "할인 방식과 최소 주문 조건, 적용 범위를 설정합니다.",
  },
  operation: {
    title: "운영 설정",
    description: "사용 기한과 만료 조건, 사용 횟수를 설정합니다.",
  },
  alert: {
    title: "알림 설정",
    description: "발급 및 만료 알림, CRM 연동 구조를 정리합니다.",
  },
  memo: {
    title: "관리자 메모",
    description: "운영 검토 메모와 내부 공유 사항을 기록합니다.",
  },
};

const couponCreateStepFieldMap: Record<
  CouponCreateSectionKey,
  Array<keyof CouponFormValues>
> = {
  basic: [
    "couponName",
    "autoIssueTriggerType",
    "audience",
    "codeGenerationMode",
    "codeCount",
    "issueTargetType",
    "targetGroupId",
    "issueLimitMode",
    "issueLimit",
  ],
  benefit: ["benefitType", "benefitValue", "minOrderAmount", "applicableScope"],
  operation: [
    "validityMode",
    "validityRange",
    "expireAfterDays",
    "usageLimitMode",
    "usageLimit",
  ],
  alert: [
    "issueAlertEnabled",
    "issueAlertChannel",
    "expireAlertEnabled",
    "expireAlertChannel",
    "linkedMessageTemplateId",
    "linkedCrmCampaignId",
  ],
  memo: ["adminMemo"],
};

function hasValidCouponDateRange(
  value: Partial<CouponFormValues>["validityRange"],
): value is [Dayjs, Dayjs] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    dayjs.isDayjs(value[0]) &&
    dayjs.isDayjs(value[1])
  );
}

function findCouponStepIndexByFieldName(
  fieldName: string | number | undefined,
  stepKeys: CouponCreateSectionKey[],
): number {
  if (typeof fieldName !== "string") {
    return 0;
  }

  const nextIndex = stepKeys.findIndex((stepKey) =>
    couponCreateStepFieldMap[stepKey].includes(
      fieldName as keyof CouponFormValues,
    ),
  );

  return nextIndex >= 0 ? nextIndex : 0;
}

function getFirstHiddenCouponValidationError(
  values: Partial<CouponFormValues>,
  couponKind: CouponKind,
  hasAlertSection: boolean,
): { field: keyof CouponFormValues } | null {
  if (!values.couponName?.trim()) {
    return { field: "couponName" };
  }

  if (couponKind === "autoIssue" && !values.autoIssueTriggerType) {
    return { field: "autoIssueTriggerType" };
  }

  if (couponKind === "couponCode") {
    if (!values.audience) {
      return { field: "audience" };
    }

    if (!values.codeGenerationMode) {
      return { field: "codeGenerationMode" };
    }

    if (
      values.codeGenerationMode === "bulk" &&
      !(values.codeCount && values.codeCount > 0)
    ) {
      return { field: "codeCount" };
    }
  }

  if (couponKind !== "autoIssue" && couponKind !== "couponCode") {
    if (!values.issueTargetType) {
      return { field: "issueTargetType" };
    }

    if (
      values.issueTargetType === "specificGroup" &&
      !values.targetGroupId?.trim()
    ) {
      return { field: "targetGroupId" };
    }

    if (
      couponKind === "customerDownload" &&
      values.issueLimitMode === "limited" &&
      !(values.issueLimit && values.issueLimit > 0)
    ) {
      return { field: "issueLimit" };
    }
  }

  if (!values.benefitType) {
    return { field: "benefitType" };
  }

  if (
    values.benefitType !== "freeShipping" &&
    !(values.benefitValue && values.benefitValue > 0)
  ) {
    return { field: "benefitValue" };
  }

  if (!(values.minOrderAmount && values.minOrderAmount > 0)) {
    return { field: "minOrderAmount" };
  }

  if (!values.applicableScope) {
    return { field: "applicableScope" };
  }

  if (couponKind === "manualIssue") {
    if (!hasValidCouponDateRange(values.validityRange)) {
      return { field: "validityRange" };
    }
  } else {
    if (!values.validityMode) {
      return { field: "validityMode" };
    }

    if (
      values.validityMode === "fixedDate" &&
      !hasValidCouponDateRange(values.validityRange)
    ) {
      return { field: "validityRange" };
    }

    if (
      values.validityMode === "afterIssued" &&
      !(values.expireAfterDays && values.expireAfterDays > 0)
    ) {
      return { field: "expireAfterDays" };
    }
  }

  if (
    values.usageLimitMode === "limited" &&
    !(values.usageLimit && values.usageLimit > 0)
  ) {
    return { field: "usageLimit" };
  }

  if (hasAlertSection) {
    if (values.issueAlertEnabled && !values.issueAlertChannel) {
      return { field: "issueAlertChannel" };
    }

    if (values.expireAlertEnabled && !values.expireAlertChannel) {
      return { field: "expireAlertChannel" };
    }
  }

  return null;
}

function CouponPlaceholderNote({
  title,
  description,
}: {
  title: string;
  description: string;
}): JSX.Element {
  return (
    <div className="coupon-create-imweb-placeholder">
      <Text strong>{title}</Text>
      <Text type="secondary">{description}</Text>
    </div>
  );
}

export default function CommerceCouponCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { couponId } = useParams<{ couponId?: string }>();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<CouponFormValues>();
  const groups = useMessageStore((state) => state.groups);
  const templates = useMessageStore((state) => state.templates);
  const couponKind = parseCouponKind(searchParams.get("type"));
  const isEdit = Boolean(couponId);
  const [reloadKey, setReloadKey] = useState(0);
  const [couponState, setCouponState] = useState<
    AsyncState<CommerceCoupon | null>
  >({
    status: isEdit ? "pending" : "success",
    data: null,
    errorMessage: null,
    errorCode: null,
  });
  const [submitState, setSubmitState] = useState<
    AsyncState<CommerceCoupon | null>
  >({
    status: "idle",
    data: null,
    errorMessage: null,
    errorCode: null,
  });
  const activeCouponKind = couponState.data?.couponKind ?? couponKind;
  const [currentStep, setCurrentStep] = useState(0);
  const selectedIssueTargetType = Form.useWatch("issueTargetType", form);
  const selectedBenefitType = Form.useWatch("benefitType", form);
  const selectedValidityMode = Form.useWatch("validityMode", form);
  const selectedCodeGenerationMode = Form.useWatch("codeGenerationMode", form);
  const selectedAutoIssueTrigger = Form.useWatch("autoIssueTriggerType", form);
  const selectedIssueLimitMode = Form.useWatch("issueLimitMode", form);
  const selectedUsageLimitMode = Form.useWatch("usageLimitMode", form);
  const selectedIssueAlertEnabled = Form.useWatch("issueAlertEnabled", form);
  const selectedExpireAlertEnabled = Form.useWatch("expireAlertEnabled", form);

  const listSearch = useMemo(() => {
    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.delete("type");
    const search = nextSearchParams.toString();
    return search ? `?${search}` : "";
  }, [location.search]);

  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        label: `${group.name} (${group.id})`,
        value: group.id,
      })),
    [groups],
  );
  const templateOptions = useMemo(
    () =>
      templates.map((template) => ({
        label: `${template.name} (${template.id})`,
        value: template.id,
      })),
    [templates],
  );
  const policyNotes = useMemo(
    () =>
      getCouponPolicyNotes(activeCouponKind, selectedAutoIssueTrigger ?? null),
    [activeCouponKind, selectedAutoIssueTrigger],
  );
  const couponKindMeta = useMemo(
    () => couponKindMetaMap[activeCouponKind],
    [activeCouponKind],
  );
  const allowedValidityModes = useMemo(
    () => getAllowedValidityModes(activeCouponKind),
    [activeCouponKind],
  );
  const benefitFieldMeta = useMemo(() => {
    if (selectedBenefitType === "rateDiscount") {
      return {
        valueLabel: "할인 비율",
        valuePlaceholder: "1~100% 사이로 입력해 주세요.",
        valueRequiredMessage: "할인 비율을 입력해 주세요.",
        max: 100,
      };
    }

    if (selectedBenefitType === "freeShipping") {
      return {
        valueLabel: "혜택 내용",
        valuePlaceholder: "",
        valueRequiredMessage: "",
        max: undefined as number | undefined,
      };
    }

    if (selectedBenefitType === "fixedPrice") {
      return {
        valueLabel: "고정가",
        valuePlaceholder: "1원 이상 입력해 주세요.",
        valueRequiredMessage: "고정가를 입력해 주세요.",
        max: undefined as number | undefined,
      };
    }

    return {
      valueLabel: "할인 금액",
      valuePlaceholder: "1원 이상 입력해 주세요.",
      valueRequiredMessage: "할인 금액을 입력해 주세요.",
      max: undefined as number | undefined,
    };
  }, [selectedBenefitType]);
  const validityModeOptions = useMemo(() => {
    if (activeCouponKind === "customerDownload") {
      return [
        { label: "사용 기한 설정", value: "fixedDate" },
        { label: "발급 후 N일 만료", value: "afterIssued" },
        { label: "제한 없음", value: "unlimited" },
      ];
    }

    if (activeCouponKind === "autoIssue") {
      return [
        { label: "발급 후 N일 만료", value: "afterIssued" },
        { label: "제한 없음", value: "unlimited" },
      ];
    }

    if (activeCouponKind === "couponCode") {
      return [
        { label: "사용 기한 설정", value: "fixedDate" },
        { label: "제한 없음", value: "unlimited" },
      ];
    }

    return [{ label: "사용 기한 설정", value: "fixedDate" }];
  }, [activeCouponKind]);

  useEffect(() => {
    if (!isEdit || !couponId) {
      setCouponState({
        status: "success",
        data: null,
        errorMessage: null,
        errorCode: null,
      });
      return;
    }

    const controller = new AbortController();

    setCouponState((prev) => ({
      ...prev,
      status: "pending",
      errorMessage: null,
      errorCode: null,
    }));

    void fetchCouponSafe(couponId, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setCouponState({
          status: "success",
          data: result.data,
          errorMessage: null,
          errorCode: null,
        });
        return;
      }

      setCouponState((prev) => ({
        ...prev,
        status: "error",
        errorMessage: result.error.message,
        errorCode: result.error.code,
      }));
    });

    return () => controller.abort();
  }, [couponId, isEdit, reloadKey]);

  useEffect(() => {
    const sourceCoupon = couponState.data;
    const defaults = createCouponDraftDefaults(activeCouponKind);

    form.setFieldsValue({
      couponName: sourceCoupon?.couponName ?? defaults.couponName,
      issueTargetType:
        sourceCoupon?.issueTargetType ?? defaults.issueTargetType,
      targetGroupId: sourceCoupon?.targetGroupIds[0] ?? "",
      targetUserIdsText: sourceCoupon
        ? serializeCouponUserIds(sourceCoupon.targetUserIds)
        : "",
      autoIssueTriggerType:
        sourceCoupon?.autoIssueTriggerType ?? defaults.autoIssueTriggerType,
      codeGenerationMode:
        sourceCoupon?.codeGenerationMode ?? defaults.codeGenerationMode,
      couponCode: sourceCoupon?.couponCode ?? defaults.couponCode,
      codeCount: sourceCoupon?.codeCount ?? defaults.codeCount,
      audience: sourceCoupon?.audience ?? defaults.audience,
      benefitType: sourceCoupon?.benefitType ?? defaults.benefitType,
      benefitValue: sourceCoupon?.benefitValue ?? defaults.benefitValue,
      minOrderAmount: sourceCoupon?.minOrderAmount ?? defaults.minOrderAmount,
      maxDiscountAmount:
        sourceCoupon?.maxDiscountAmount ?? defaults.maxDiscountAmount,
      applicableScope:
        sourceCoupon?.applicableScope ?? defaults.applicableScope,
      isStackable: sourceCoupon?.isStackable ?? defaults.isStackable,
      isSecretCoupon: sourceCoupon?.isSecretCoupon ?? defaults.isSecretCoupon,
      issueLimitMode: sourceCoupon?.issueLimitMode ?? defaults.issueLimitMode,
      issueLimit: sourceCoupon?.issueLimit ?? defaults.issueLimit,
      downloadLimitMode:
        sourceCoupon?.downloadLimitMode ?? defaults.downloadLimitMode,
      downloadLimit: sourceCoupon?.downloadLimit ?? defaults.downloadLimit,
      usageLimitMode: sourceCoupon?.usageLimitMode ?? defaults.usageLimitMode,
      usageLimit: sourceCoupon?.usageLimit ?? defaults.usageLimit,
      validityMode: sourceCoupon?.validityMode ?? defaults.validityMode,
      validityRange:
        sourceCoupon?.validityMode === "fixedDate"
          ? [dayjs(sourceCoupon.validFrom), dayjs(sourceCoupon.validUntil)]
          : createDefaultValidityRange(),
      expireAfterDays:
        sourceCoupon?.expireAfterDays ?? defaults.expireAfterDays,
      linkedMessageTemplateId:
        sourceCoupon?.linkedMessageTemplateId ??
        defaults.linkedMessageTemplateId,
      linkedCrmCampaignId:
        sourceCoupon?.linkedCrmCampaignId ?? defaults.linkedCrmCampaignId,
      linkedEventId: sourceCoupon?.linkedEventId ?? defaults.linkedEventId,
      issueAlertEnabled:
        sourceCoupon?.issueAlert.enabled ?? defaults.issueAlert.enabled,
      issueAlertChannel:
        sourceCoupon?.issueAlert.channel ?? defaults.issueAlert.channel,
      expireAlertEnabled:
        sourceCoupon?.expireAlert.enabled ?? defaults.expireAlert.enabled,
      expireAlertChannel:
        sourceCoupon?.expireAlert.channel ?? defaults.expireAlert.channel,
      adminMemo: sourceCoupon?.adminMemo ?? defaults.adminMemo,
    });
  }, [activeCouponKind, couponState.data, form]);

  useEffect(() => {
    const currentBenefitValue = form.getFieldValue("benefitValue");
    const currentMaxDiscountAmount = form.getFieldValue("maxDiscountAmount");

    if (selectedBenefitType === "freeShipping") {
      if (currentBenefitValue !== 0) {
        form.setFieldValue("benefitValue", 0);
      }

      return;
    }

    if (
      selectedBenefitType !== "rateDiscount" &&
      currentMaxDiscountAmount !== null
    ) {
      form.setFieldValue("maxDiscountAmount", null);
    }

    if ((currentBenefitValue ?? 0) <= 0) {
      form.setFieldValue(
        "benefitValue",
        selectedBenefitType === "rateDiscount" ? 10 : 1000,
      );
      return;
    }

    if (selectedBenefitType === "rateDiscount" && currentBenefitValue > 100) {
      form.setFieldValue("benefitValue", 100);
    }
  }, [form, selectedBenefitType]);

  useEffect(() => {
    if (
      !selectedValidityMode ||
      allowedValidityModes.includes(selectedValidityMode)
    ) {
      return;
    }

    form.setFieldValue("validityMode", allowedValidityModes[0]);
  }, [allowedValidityModes, form, selectedValidityMode]);

  const handleReload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleBackToList = useCallback(() => {
    navigate(`/commerce/coupons${listSearch}`);
  }, [listSearch, navigate]);

  const handleSubmit = async () => {
    const activeFieldNames = couponCreateStepFieldMap[currentSectionKey];

    try {
      await form.validateFields(activeFieldNames);
    } catch (error) {
      const firstErrorFieldName = (
        error as { errorFields?: Array<{ name?: Array<string | number> }> }
      ).errorFields?.[0]?.name?.[0];

      setCurrentStep(
        findCouponStepIndexByFieldName(firstErrorFieldName, stepKeys),
      );
      return;
    }

    const partialValues = form.getFieldsValue(
      true,
    ) as Partial<CouponFormValues>;
    const hiddenValidationError = getFirstHiddenCouponValidationError(
      partialValues,
      activeCouponKind,
      hasAlertSection,
    );

    if (hiddenValidationError) {
      const nextStepIndex = findCouponStepIndexByFieldName(
        hiddenValidationError.field,
        stepKeys,
      );

      setCurrentStep(nextStepIndex);

      window.setTimeout(() => {
        void form
          .validateFields([hiddenValidationError.field])
          .catch(() => undefined);
      }, 0);

      return;
    }

    const values = partialValues as CouponFormValues;
    const parsedTargetUserIds = parseCouponUserIds(
      values.targetUserIdsText ?? "",
    );

    setSubmitState({
      status: "pending",
      data: null,
      errorMessage: null,
      errorCode: null,
    });

    const result = await saveCouponSafe({
      id: couponState.data?.id,
      couponName: values.couponName.trim(),
      couponKind: activeCouponKind,
      couponStatus: resolveCouponStatus(
        values.validityMode,
        values.validityRange,
      ),
      issueState:
        activeCouponKind === "autoIssue"
          ? (couponState.data?.issueState ?? "정상")
          : "정상",
      issueTargetType:
        activeCouponKind === "autoIssue" || activeCouponKind === "couponCode"
          ? null
          : values.issueTargetType,
      targetGroupIds:
        values.issueTargetType === "specificGroup" && values.targetGroupId
          ? [values.targetGroupId]
          : [],
      targetUserIds:
        values.issueTargetType === "specificMembers" ? parsedTargetUserIds : [],
      autoIssueTriggerType:
        activeCouponKind === "autoIssue" ? values.autoIssueTriggerType : null,
      codeGenerationMode:
        activeCouponKind === "couponCode" ? values.codeGenerationMode : null,
      couponCode:
        activeCouponKind === "couponCode" ? values.couponCode.trim() : "",
      codeCount:
        activeCouponKind === "couponCode" ? (values.codeCount ?? 1) : null,
      audience: activeCouponKind === "couponCode" ? values.audience : null,
      benefitType: values.benefitType,
      benefitValue:
        values.benefitType === "freeShipping" ? 0 : values.benefitValue,
      minOrderAmount: values.minOrderAmount,
      maxDiscountAmount:
        values.benefitType === "rateDiscount" ||
        values.benefitType === "freeShipping"
          ? (values.maxDiscountAmount ?? null)
          : null,
      applicableScope: values.applicableScope,
      isStackable: values.isStackable,
      isSecretCoupon:
        activeCouponKind === "customerDownload" ? values.isSecretCoupon : false,
      issueLimitMode: values.issueLimitMode,
      issueLimit:
        values.issueLimitMode === "limited"
          ? (values.issueLimit ?? null)
          : null,
      downloadLimitMode: values.downloadLimitMode,
      downloadLimit:
        values.downloadLimitMode === "limited"
          ? (values.downloadLimit ?? null)
          : null,
      usageLimitMode: values.usageLimitMode,
      usageLimit:
        values.usageLimitMode === "limited"
          ? (values.usageLimit ?? null)
          : null,
      validityMode: values.validityMode,
      validFrom: values.validityRange[0].format("YYYY-MM-DD"),
      validUntil: values.validityRange[1].format("YYYY-MM-DD"),
      expireAfterDays:
        values.validityMode === "afterIssued"
          ? (values.expireAfterDays ?? null)
          : null,
      linkedMessageTemplateId: values.linkedMessageTemplateId ?? "",
      linkedCrmCampaignId: values.linkedCrmCampaignId ?? "",
      linkedEventId: values.linkedEventId ?? "",
      adminMemo: values.adminMemo ?? "",
      issueAlert: {
        enabled: values.issueAlertEnabled,
        channel: values.issueAlertChannel,
        templateId: values.linkedMessageTemplateId ?? "",
        templateName: "",
        timingLabel:
          activeCouponKind === "autoIssue" ? "발급 즉시" : "다운로드 즉시",
      },
      expireAlert: {
        enabled: values.expireAlertEnabled,
        channel: values.expireAlertChannel,
        templateId: values.linkedMessageTemplateId ?? "",
        templateName: "",
        timingLabel: "만료 1일 전",
      },
    });

    if (!result.ok) {
      setSubmitState({
        status: "error",
        data: null,
        errorMessage: result.error.message,
        errorCode: result.error.code,
      });
      return;
    }

    setSubmitState({
      status: "success",
      data: result.data,
      errorMessage: null,
      errorCode: null,
    });

    navigate(`/commerce/coupons${listSearch}`, {
      state: {
        commerceCouponSaved: {
          couponId: result.data.id,
          mode: isEdit ? "edit" : "create",
        },
      },
    });
  };

  const basicItems = useMemo(() => {
    const commonItems = [
      {
        key: "couponName",
        label: activeCouponKind === "manualIssue" ? "정기 쿠폰명" : "쿠폰명",
        children: (
          <Form.Item
            name="couponName"
            rules={[{ required: true, message: "쿠폰명을 입력해 주세요." }]}
            style={{ margin: 0 }}
          >
            <Input placeholder="쿠폰명을 입력해 주세요." />
          </Form.Item>
        ),
      },
    ];

    if (activeCouponKind === "autoIssue") {
      return markRequiredDescriptionItems(
        [
          ...commonItems,
          {
            key: "autoIssueTriggerType",
            label: "발행 대상",
            children: (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Form.Item
                  name="autoIssueTriggerType"
                  rules={[
                    { required: true, message: "발행 대상을 선택해 주세요." },
                  ]}
                  style={{ margin: 0 }}
                >
                  <Radio.Group
                    className="coupon-choice-radio-group coupon-choice-radio-group--wrap"
                    options={getCouponAutoIssueTriggerOptions()}
                  />
                </Form.Item>
                <CouponPlaceholderNote
                  title="트리거별 상세 조건"
                  description="회원가입, 첫 주문, 생일, 등급 변경 세부 계약은 후속 API 연동 단계에서 구체화합니다."
                />
              </Space>
            ),
          },
        ],
        ["couponName", "autoIssueTriggerType"],
      );
    }

    if (activeCouponKind === "couponCode") {
      return markRequiredDescriptionItems(
        [
          ...commonItems,
          {
            key: "audience",
            label: "발행 대상",
            children: (
              <Form.Item
                name="audience"
                rules={[
                  { required: true, message: "발행 대상을 선택해 주세요." },
                ]}
                style={{ margin: 0 }}
              >
                <Radio.Group
                  className="coupon-choice-radio-group"
                  options={[
                    { label: "회원", value: "memberOnly" },
                    { label: "회원 및 비회원", value: "memberAndGuest" },
                  ]}
                />
              </Form.Item>
            ),
          },
          {
            key: "codeGenerationMode",
            label: "쿠폰 수량",
            children: (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Form.Item
                  name="codeGenerationMode"
                  rules={[
                    {
                      required: true,
                      message: "쿠폰 수량 방식을 선택해 주세요.",
                    },
                  ]}
                  style={{ margin: 0 }}
                >
                  <Radio.Group
                    className="coupon-choice-radio-group"
                    options={getCouponCodeGenerationOptions()}
                  />
                </Form.Item>
                {selectedCodeGenerationMode === "bulk" ? (
                  <Form.Item
                    name="codeCount"
                    rules={[
                      { required: true, message: "생성 수량을 입력해 주세요." },
                    ]}
                    style={{ margin: 0 }}
                  >
                    <InputNumber
                      min={1}
                      max={10000}
                      style={{ width: "100%" }}
                      placeholder="수량을 입력하면 코드가 자동 생성돼요. 최대 10,000개까지 가능합니다."
                    />
                  </Form.Item>
                ) : (
                  <Form.Item name="couponCode" style={{ margin: 0 }}>
                    <Input placeholder="직접 쿠폰 코드를 입력하거나 비워 두면 자동 생성돼요." />
                  </Form.Item>
                )}
              </Space>
            ),
          },
        ],
        ["couponName", "audience", "codeGenerationMode"],
      );
    }

    return markRequiredDescriptionItems(
      [
        ...commonItems,
        {
          key: "issueTargetType",
          label: "발행 대상",
          children: (
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Form.Item
                name="issueTargetType"
                rules={[
                  { required: true, message: "발행 대상을 선택해 주세요." },
                ]}
                style={{ margin: 0 }}
              >
                <Radio.Group
                  className="coupon-choice-radio-group coupon-choice-radio-group--wrap"
                  options={getCouponIssueTargetOptions()}
                />
              </Form.Item>
              {selectedIssueTargetType === "specificGroup" ? (
                <Form.Item
                  name="targetGroupId"
                  rules={[{ required: true, message: "그룹을 선택해 주세요." }]}
                  style={{ margin: 0 }}
                >
                  <Select
                    options={groupOptions}
                    placeholder={
                      groupOptions.length > 0
                        ? "그룹을 선택해 주세요."
                        : "설정 가능한 그룹이 없습니다."
                    }
                    disabled={groupOptions.length === 0}
                  />
                </Form.Item>
              ) : null}
              {selectedIssueTargetType === "specificMembers" ? (
                <Form.Item name="targetUserIdsText" style={{ margin: 0 }}>
                  <Input.TextArea
                    rows={4}
                    placeholder="회원 ID를 입력해 주세요. 여러 명이면 줄바꿈 또는 쉼표로 구분합니다."
                  />
                </Form.Item>
              ) : null}
            </Space>
          ),
        },
        ...(activeCouponKind === "customerDownload"
          ? [
              {
                key: "issueLimitMode",
                label: "쿠폰 수량",
                children: (
                  <Space
                    direction="vertical"
                    size={12}
                    style={{ width: "100%" }}
                  >
                    <Form.Item name="issueLimitMode" style={{ margin: 0 }}>
                      <Radio.Group
                        className="coupon-choice-radio-group"
                        options={[
                          { label: "제한 없음", value: "unlimited" },
                          { label: "제한", value: "limited" },
                        ]}
                      />
                    </Form.Item>
                    {selectedIssueLimitMode === "limited" ? (
                      <Form.Item name="issueLimit" style={{ margin: 0 }}>
                        <InputNumber
                          min={1}
                          style={{ width: "100%" }}
                          placeholder="발행 가능한 쿠폰 수량을 입력해 주세요."
                        />
                      </Form.Item>
                    ) : null}
                  </Space>
                ),
              },
              {
                key: "isSecretCoupon",
                label: "시크릿 쿠폰",
                children: (
                  <Space
                    direction="vertical"
                    size={8}
                    style={{ width: "100%" }}
                  >
                    <Form.Item name="isSecretCoupon" style={{ margin: 0 }}>
                      <Radio.Group
                        className="coupon-choice-radio-group"
                        options={[
                          { label: "설정", value: true },
                          { label: "설정 안 함", value: false },
                        ]}
                      />
                    </Form.Item>
                    <Text type="secondary">
                      다운로드 링크를 외부 채널에만 공유하고 싶다면 시크릿
                      쿠폰으로 운영합니다.
                    </Text>
                  </Space>
                ),
              },
            ]
          : []),
      ],
      ["couponName", "issueTargetType"],
    );
  }, [
    activeCouponKind,
    groupOptions,
    selectedCodeGenerationMode,
    selectedIssueLimitMode,
    selectedIssueTargetType,
  ]);

  const benefitItems = useMemo(
    () =>
      markRequiredDescriptionItems(
        [
          {
            key: "benefitType",
            label: "혜택",
            children: (
              <Form.Item
                name="benefitType"
                rules={[
                  { required: true, message: "혜택 유형을 선택해 주세요." },
                ]}
                style={{ margin: 0 }}
              >
                <Radio.Group
                  className="coupon-choice-radio-group coupon-choice-radio-group--wrap"
                  options={getCouponBenefitTypeOptions()}
                />
              </Form.Item>
            ),
          },
          {
            key: "benefitValue",
            label: benefitFieldMeta.valueLabel,
            children:
              selectedBenefitType === "freeShipping" ? (
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  <Form.Item name="benefitValue" hidden>
                    <InputNumber />
                  </Form.Item>
                  <Text type="secondary">
                    배송비 무료 혜택은 할인 금액 대신 배송비 면제 안내로
                    처리합니다.
                  </Text>
                </Space>
              ) : (
                <Form.Item
                  name="benefitValue"
                  rules={[
                    {
                      required: true,
                      message: benefitFieldMeta.valueRequiredMessage,
                    },
                  ]}
                  style={{ margin: 0 }}
                >
                  <InputNumber
                    min={1}
                    max={benefitFieldMeta.max}
                    style={{ width: "100%" }}
                    placeholder={benefitFieldMeta.valuePlaceholder}
                    formatter={
                      selectedBenefitType === "rateDiscount"
                        ? (value) =>
                            value === undefined ||
                            value === null ||
                            value === ""
                              ? ""
                              : `${value}%`
                        : undefined
                    }
                    parser={
                      selectedBenefitType === "rateDiscount"
                        ? (value) => value?.replaceAll("%", "") ?? ""
                        : undefined
                    }
                  />
                </Form.Item>
              ),
          },
          {
            key: "minOrderAmount",
            label: "최소 주문 금액",
            children: (
              <Form.Item
                name="minOrderAmount"
                rules={[
                  {
                    required: true,
                    message: "최소 주문 금액을 입력해 주세요.",
                  },
                ]}
                style={{ margin: 0 }}
              >
                <InputNumber
                  min={1}
                  style={{ width: "100%" }}
                  placeholder="1 이상 입력해 주세요."
                />
              </Form.Item>
            ),
          },
          ...(selectedBenefitType === "rateDiscount" ||
          selectedBenefitType === "freeShipping"
            ? [
                {
                  key: "maxDiscountAmount",
                  label: "최대 할인 금액",
                  children: (
                    <Form.Item name="maxDiscountAmount" style={{ margin: 0 }}>
                      <InputNumber
                        min={1}
                        style={{ width: "100%" }}
                        placeholder="선택 입력"
                      />
                    </Form.Item>
                  ),
                },
              ]
            : []),
          {
            key: "applicableScope",
            label: "쿠폰 적용 범위",
            children: (
              <Form.Item
                name="applicableScope"
                rules={[
                  { required: true, message: "적용 범위를 선택해 주세요." },
                ]}
                style={{ margin: 0 }}
              >
                <Radio.Group
                  className="coupon-choice-radio-group coupon-choice-radio-group--wrap"
                  options={[
                    { label: "전체 상품", value: "allProducts" },
                    { label: "특정 카테고리", value: "specificCategory" },
                    { label: "특정 상품", value: "specificProduct" },
                  ]}
                />
              </Form.Item>
            ),
          },
          {
            key: "excludedProducts",
            label: "적용 제외 상품",
            children: (
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Radio.Group
                  disabled
                  value="none"
                  className="coupon-choice-radio-group"
                  options={[
                    { label: "지정 안 함", value: "none" },
                    { label: "상품 지정", value: "custom" },
                  ]}
                />
                <Input
                  disabled
                  placeholder="상품명 또는 재고번호(SKU)로 검색해 주세요."
                />
                <Text type="secondary">
                  상품 엔티티 검색/선택 UI가 확정되면 연결합니다.
                </Text>
              </Space>
            ),
          },
          {
            key: "isStackable",
            label: "중복 할인",
            children: (
              <Form.Item name="isStackable" style={{ margin: 0 }}>
                <Radio.Group
                  className="coupon-choice-radio-group coupon-choice-radio-group--wrap"
                  options={[
                    { label: "단독으로만 사용 가능", value: false },
                    { label: "다른 쿠폰과 함께 사용 가능", value: true },
                  ]}
                />
              </Form.Item>
            ),
          },
        ],
        [
          "benefitType",
          ...(selectedBenefitType === "freeShipping" ? [] : ["benefitValue"]),
          "minOrderAmount",
          "applicableScope",
        ],
      ),
    [benefitFieldMeta, selectedBenefitType],
  );

  const operationItems = useMemo(() => {
    if (activeCouponKind === "manualIssue") {
      return markRequiredDescriptionItems(
        [
          {
            key: "validityRange",
            label: "사용 기한 설정",
            children: (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Form.Item
                  name="validityRange"
                  rules={[
                    { required: true, message: "사용 기한을 선택해 주세요." },
                  ]}
                  style={{ margin: 0 }}
                >
                  <DatePicker.RangePicker style={{ width: "100%" }} />
                </Form.Item>
                <Text type="secondary">
                  시간 단위 선택은 후속 API 계약 전까지 날짜 기준으로만
                  처리합니다.
                </Text>
              </Space>
            ),
          },
        ],
        ["validityRange"],
      );
    }

    return markRequiredDescriptionItems(
      [
        {
          key: "validityMode",
          label: "만료일 설정",
          children: (
            <Form.Item
              name="validityMode"
              rules={[
                { required: true, message: "만료일 설정을 선택해 주세요." },
              ]}
              style={{ margin: 0 }}
            >
              <Radio.Group
                className="coupon-choice-radio-group coupon-choice-radio-group--wrap"
                options={validityModeOptions}
              />
            </Form.Item>
          ),
        },
        ...(selectedValidityMode === "fixedDate"
          ? [
              {
                key: "validityRange",
                label: "사용 기한",
                children: (
                  <Space
                    direction="vertical"
                    size={12}
                    style={{ width: "100%" }}
                  >
                    <Form.Item
                      name="validityRange"
                      rules={[
                        {
                          required: true,
                          message: "사용 기한을 선택해 주세요.",
                        },
                      ]}
                      style={{ margin: 0 }}
                    >
                      <DatePicker.RangePicker style={{ width: "100%" }} />
                    </Form.Item>
                    <Text type="secondary">
                      시간 단위 설정은 후속 계약 확정 전까지 placeholder
                      성격으로 유지합니다.
                    </Text>
                  </Space>
                ),
              },
            ]
          : []),
        ...(selectedValidityMode === "afterIssued"
          ? [
              {
                key: "expireAfterDays",
                label: "발급 후 N일 만료",
                children: (
                  <Form.Item
                    name="expireAfterDays"
                    rules={[
                      { required: true, message: "만료 일수를 입력해 주세요." },
                    ]}
                    style={{ margin: 0 }}
                  >
                    <InputNumber
                      min={1}
                      style={{ width: "100%" }}
                      placeholder="발급 후 몇 일까지 사용할지 입력해 주세요."
                    />
                  </Form.Item>
                ),
              },
            ]
          : []),
        {
          key: "usageLimitMode",
          label: "사용 횟수",
          children: (
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Form.Item name="usageLimitMode" style={{ margin: 0 }}>
                <Radio.Group
                  className="coupon-choice-radio-group"
                  options={[
                    { label: "제한", value: "limited" },
                    { label: "제한 없음", value: "unlimited" },
                  ]}
                />
              </Form.Item>
              {selectedUsageLimitMode === "limited" ? (
                <Form.Item name="usageLimit" style={{ margin: 0 }}>
                  <InputNumber
                    min={1}
                    style={{ width: "100%" }}
                    placeholder="최대 사용 횟수를 입력해 주세요."
                  />
                </Form.Item>
              ) : null}
            </Space>
          ),
        },
      ],
      ["validityMode"],
    );
  }, [
    activeCouponKind,
    selectedUsageLimitMode,
    selectedValidityMode,
    validityModeOptions,
  ]);

  const alertItems = useMemo(() => {
    if (activeCouponKind === "couponCode") {
      return null;
    }

    if (activeCouponKind === "manualIssue") {
      return [
        {
          key: "pushPlaceholder",
          label: "푸시 알림(앱 사용 시)",
          children: (
            <CouponPlaceholderNote
              title="알림 미리보기"
              description="지정 발행 안내 푸시 구조만 먼저 맞추고, 실제 메시지 발송 계약은 후속 구현으로 넘깁니다."
            />
          ),
        },
      ];
    }

    return [
      {
        key: "messageCredit",
        label: "메시지 크레딧",
        children: (
          <CouponPlaceholderNote
            title="알림 발송 전 크레딧 차감"
            description="실제 잔액, 검수 상태, 차감 기준, 발송 수량 계산은 메시지 서비스 연동 후 연결합니다."
          />
        ),
      },
      {
        key: "issueAlertEnabled",
        label: "쿠폰 발급 알림",
        children: (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Form.Item name="issueAlertEnabled" style={{ margin: 0 }}>
              <Radio.Group
                className="coupon-choice-radio-group"
                options={[
                  { label: "발송 안 함", value: false },
                  { label: "발송", value: true },
                ]}
              />
            </Form.Item>
            {selectedIssueAlertEnabled ? (
              <Form.Item name="issueAlertChannel" style={{ margin: 0 }}>
                <Radio.Group
                  className="coupon-choice-radio-group coupon-choice-radio-group--wrap"
                  options={[
                    { label: "알림톡", value: "alimtalk" },
                    { label: "웹·앱 푸시", value: "webPush" },
                  ]}
                />
              </Form.Item>
            ) : null}
            <CouponPlaceholderNote
              title="알림 미리보기"
              description="알림 미리보기와 CRM 캠페인 연결은 실제 메시지 템플릿 계약 확정 전까지 placeholder로 유지합니다."
            />
          </Space>
        ),
      },
      {
        key: "expireAlertEnabled",
        label: "쿠폰 만료 알림",
        children: (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Form.Item name="expireAlertEnabled" style={{ margin: 0 }}>
              <Radio.Group
                className="coupon-choice-radio-group"
                options={[
                  { label: "발송 안 함", value: false },
                  { label: "발송", value: true },
                ]}
              />
            </Form.Item>
            {selectedExpireAlertEnabled ? (
              <Form.Item name="expireAlertChannel" style={{ margin: 0 }}>
                <Radio.Group
                  className="coupon-choice-radio-group coupon-choice-radio-group--wrap"
                  options={[
                    { label: "알림톡", value: "alimtalk" },
                    { label: "웹·앱 푸시", value: "webPush" },
                  ]}
                />
              </Form.Item>
            ) : null}
            <CouponPlaceholderNote
              title="만료 알림 미리보기"
              description="유효 기간, 발송 시점, 발송 템플릿은 추후 메시지/CRM 계약과 함께 확정합니다."
            />
          </Space>
        ),
      },
      {
        key: "linkedMessageTemplateId",
        label: "CRM 캠페인 연동",
        children: (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Form.Item name="linkedMessageTemplateId" style={{ margin: 0 }}>
              <Select
                allowClear
                options={templateOptions}
                placeholder="메시지 템플릿을 선택해 주세요."
              />
            </Form.Item>
            <Form.Item name="linkedCrmCampaignId" style={{ margin: 0 }}>
              <Select
                allowClear
                options={[
                  { label: "장바구니 상품 구매 유도", value: "CRM-CART-001" },
                  { label: "자동 발행 쿠폰 안내", value: "CRM-WELCOME-001" },
                  { label: "쿠폰 기간 만료 안내", value: "CRM-EXPIRE-001" },
                  { label: "지정 발행 쿠폰 알림", value: "CRM-MANUAL-001" },
                ]}
                placeholder="CRM 캠페인을 선택해 주세요."
              />
            </Form.Item>
          </Space>
        ),
      },
      {
        key: "adminMemo",
        label: "운영 메모",
        children: (
          <Form.Item name="adminMemo" style={{ margin: 0 }}>
            <Input.TextArea
              rows={4}
              placeholder="운영 검토 메모, 발행 목적, 주의사항을 기록해 주세요."
            />
          </Form.Item>
        ),
      },
    ];
  }, [
    activeCouponKind,
    selectedExpireAlertEnabled,
    selectedIssueAlertEnabled,
    templateOptions,
  ]);

  const memoItems = useMemo(
    () => [
      {
        key: "adminMemo",
        label: "운영 메모",
        children: (
          <Form.Item name="adminMemo" style={{ margin: 0 }}>
            <Input.TextArea
              rows={6}
              placeholder="운영 검토 메모, 내부 공유 사항, 후속 확인 포인트를 기록해 주세요."
            />
          </Form.Item>
        ),
      },
    ],
    [],
  );
  const visibleAlertItems = useMemo(
    () => alertItems?.filter((item) => item.key !== "adminMemo") ?? null,
    [alertItems],
  );
  const hasAlertSection = Boolean(visibleAlertItems?.length);
  const stepKeys = useMemo<CouponCreateSectionKey[]>(
    () => [
      "basic",
      "benefit",
      "operation",
      ...(hasAlertSection ? ["alert"] : []),
      "memo",
    ],
    [hasAlertSection],
  );
  const currentSectionKey = stepKeys[currentStep] ?? "basic";
  const sectionMetaByKey = useMemo(
    () => ({
      ...couponCreateSectionMeta,
      basic: {
        ...couponCreateSectionMeta.basic,
        description: couponKindMeta.basicDescription,
      },
      operation: {
        ...couponCreateSectionMeta.operation,
        description: couponKindMeta.operationsDescription,
      },
      alert: {
        ...couponCreateSectionMeta.alert,
        description:
          couponKindMeta.alertDescription ??
          couponCreateSectionMeta.alert.description,
      },
    }),
    [couponKindMeta],
  );
  const stepItems = useMemo(
    () =>
      stepKeys.map((stepKey) => ({
        title: sectionMetaByKey[stepKey].title,
        description: sectionMetaByKey[stepKey].description,
      })),
    [sectionMetaByKey, stepKeys],
  );

  useEffect(() => {
    setCurrentStep((previousStep) =>
      Math.min(previousStep, stepKeys.length - 1),
    );
  }, [stepKeys.length]);

  const handleStepChange = useCallback(
    (nextStep: number) => {
      setCurrentStep(Math.max(0, Math.min(nextStep, stepKeys.length - 1)));
    },
    [stepKeys.length],
  );

  const hasCachedCoupon = Boolean(couponState.data);
  const isLoadingInitialCoupon =
    isEdit && couponState.status === "pending" && !hasCachedCoupon;
  const isSubmitting = submitState.status === "pending";
  const isSaveDisabled = isSubmitting || (isEdit && !hasCachedCoupon);
  const pageTitle = isEdit
    ? "쿠폰 수정 상세"
    : `${getCouponKindLabel(activeCouponKind)} 쿠폰 등록`;

  return (
    <div className="content-editor-page">
      <PageTitle title={pageTitle} />

      {isEdit && couponState.status === "error" && !hasCachedCoupon ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="쿠폰 상세 정보를 불러오지 못했습니다."
          description={
            <Space direction="vertical">
              <span>
                {couponState.errorMessage ?? "일시적인 오류가 발생했습니다."}
              </span>
              {couponState.errorCode ? (
                <span>오류 코드: {couponState.errorCode}</span>
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
              <Button
                type="primary"
                size="large"
                loading={isSubmitting}
                disabled={isSaveDisabled}
                onClick={() => {
                  void handleSubmit();
                }}
              >
                {isEdit ? "저장" : "쿠폰 생성"}
              </Button>
            </Space>
          </div>
        }
      >
        {isLoadingInitialCoupon ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="쿠폰 상세 정보를 불러오는 중입니다."
            description="저장된 쿠폰 정보를 확인한 뒤 수정 화면을 이어서 표시합니다."
          />
        ) : null}

        {isEdit && couponState.status === "pending" && hasCachedCoupon ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="최신 쿠폰 정보를 다시 불러오는 중입니다."
            description="마지막으로 확인된 데이터를 유지한 채 상세 정보를 갱신합니다."
          />
        ) : null}

        {submitState.status === "error" ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="쿠폰 저장에 실패했습니다."
            description={
              <Space direction="vertical">
                <span>
                  {submitState.errorMessage ?? "입력값을 다시 확인해 주세요."}
                </span>
                {submitState.errorCode ? (
                  <span>오류 코드: {submitState.errorCode}</span>
                ) : null}
              </Space>
            }
          />
        ) : null}

        {!isEdit || hasCachedCoupon ? (
          <Form form={form} layout="vertical">
            <AdminEditorForm
              stepAriaLabel="쿠폰 등록 단계"
              currentStep={currentStep}
              items={stepItems}
              onStepChange={handleStepChange}
            >
              {currentSectionKey === "basic" ? (
                <AdminEditorFormSection
                  title={sectionMetaByKey.basic.title}
                  description={sectionMetaByKey.basic.description}
                >
                  {policyNotes.length > 0 ? (
                    <Alert
                      type="info"
                      showIcon
                      icon={<InfoCircleOutlined />}
                      message="운영 가이드"
                      description={
                        <Space direction="vertical" size={4}>
                          {policyNotes.map((policyNote) => (
                            <Text key={policyNote}>{policyNote}</Text>
                          ))}
                        </Space>
                      }
                    />
                  ) : null}
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={basicItems}
                  />
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === "benefit" ? (
                <AdminEditorFormSection
                  title={sectionMetaByKey.benefit.title}
                  description={sectionMetaByKey.benefit.description}
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={benefitItems}
                  />
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === "operation" ? (
                <AdminEditorFormSection
                  title={sectionMetaByKey.operation.title}
                  description={sectionMetaByKey.operation.description}
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={operationItems}
                  />
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === "alert" && visibleAlertItems ? (
                <AdminEditorFormSection
                  title={sectionMetaByKey.alert.title}
                  description={sectionMetaByKey.alert.description}
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={visibleAlertItems}
                  />
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === "memo" ? (
                <AdminEditorFormSection
                  title={sectionMetaByKey.memo.title}
                  description={sectionMetaByKey.memo.description}
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={memoItems}
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
