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
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import {
  fetchCouponTemplateSafe,
  saveCouponTemplateSafe,
} from "../api/coupons-service";
import {
  createCouponTemplateDraftDefaults,
  getCouponTemplateAlertChannelOptions,
  getCouponTemplateBenefitTypeOptions,
  getCouponTemplateCategorySelectOptions,
  getCouponTemplatePolicyNotes,
  getCouponTemplateProductSelectOptions,
  getCouponTemplateScopeOptions,
  getCouponTemplateShoppingGradeSelectOptions,
} from "../model/coupon-template-form-schema";
import type {
  CommerceCouponSubscriptionTemplate,
  CouponTemplateAlertChannel,
  CouponTemplateExcludedProductMode,
} from "../model/coupon-template-types";
import { formatCouponTemplateSchedule } from "../model/coupon-template-types";
import type { AsyncState } from "../../../shared/model/async-state";
import {
  AdminEditorForm,
  AdminEditorFormSection,
} from "../../../shared/ui/admin-editor-form/admin-editor-form";
import { markRequiredDescriptionItems } from "../../../shared/ui/descriptions/description-label";
import { AdminListCard } from "../../../shared/ui/list-page-card/admin-list-card";
import { PageTitle } from "../../../shared/ui/page-title/page-title";

const { Text } = Typography;
const couponTemplateReadOnlyFieldStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d9d9d9",
  borderRadius: 8,
  backgroundColor: "#fafafa",
};
const monthlyUsageEndDateReference = dayjs("2026-01-01");

type CouponTemplateFormValues = {
  templateName: string;
  targetGradeIds: string[];
  benefitType: CommerceCouponSubscriptionTemplate["benefitType"];
  benefitValue: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  applicableScope: CommerceCouponSubscriptionTemplate["applicableScope"];
  applicableScopeReferenceIds: string[];
  excludedProductMode: CouponTemplateExcludedProductMode;
  excludedProductIds: string[];
  isStackable: boolean;
  usageEndDayOfMonth: number;
  usageEndHour: number;
  usageEndMinute: number;
  issueAlertEnabled: boolean;
  expireAlertEnabled: boolean;
  alertChannel: CouponTemplateAlertChannel;
  adminMemo: string;
};

type CouponTemplateSectionKey =
  | "basic"
  | "benefit"
  | "operation"
  | "alert"
  | "memo";

const couponTemplateSectionMeta: Record<
  CouponTemplateSectionKey,
  { title: string; description: string }
> = {
  basic: {
    title: "기본 설정",
    description: "정기 쿠폰명과 발행 대상을 설정합니다.",
  },
  benefit: {
    title: "혜택 설정",
    description: "혜택과 적용 범위, 제외 상품 규칙을 설정합니다.",
  },
  operation: {
    title: "운영 설정",
    description: "정기 발행 시점과 쿠폰 사용 종료일을 설정합니다.",
  },
  alert: {
    title: "알림 설정",
    description: "발급 및 만료 알림 채널을 설정합니다.",
  },
  memo: {
    title: "관리자 메모",
    description: "운영 검토 메모와 내부 공유 사항을 기록합니다.",
  },
};

const couponTemplateStepFieldMap: Record<
  CouponTemplateSectionKey,
  Array<keyof CouponTemplateFormValues>
> = {
  basic: ["templateName", "targetGradeIds"],
  benefit: [
    "benefitType",
    "benefitValue",
    "maxDiscountAmount",
    "minOrderAmount",
    "applicableScope",
    "applicableScopeReferenceIds",
    "excludedProductMode",
    "excludedProductIds",
    "isStackable",
  ],
  operation: ["usageEndDayOfMonth", "usageEndHour", "usageEndMinute"],
  alert: ["issueAlertEnabled", "expireAlertEnabled", "alertChannel"],
  memo: ["adminMemo"],
};

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function findCouponTemplateStepIndexByFieldName(
  fieldName: string | number | undefined,
  stepKeys: CouponTemplateSectionKey[],
): number {
  if (typeof fieldName !== "string") {
    return 0;
  }

  const nextIndex = stepKeys.findIndex((stepKey) =>
    couponTemplateStepFieldMap[stepKey].includes(
      fieldName as keyof CouponTemplateFormValues,
    ),
  );

  return nextIndex >= 0 ? nextIndex : 0;
}

function getFirstHiddenCouponTemplateValidationError(
  values: Partial<CouponTemplateFormValues>,
  hasAlertSection: boolean,
): { field: keyof CouponTemplateFormValues } | null {
  if (!values.templateName?.trim()) {
    return { field: "templateName" };
  }

  if (
    !Array.isArray(values.targetGradeIds) ||
    values.targetGradeIds.length === 0
  ) {
    return { field: "targetGradeIds" };
  }

  if (!values.benefitType) {
    return { field: "benefitType" };
  }

  if (
    values.benefitType !== "freeShipping" &&
    !isPositiveNumber(values.benefitValue)
  ) {
    return { field: "benefitValue" };
  }

  if (!isPositiveNumber(values.minOrderAmount)) {
    return { field: "minOrderAmount" };
  }

  if (!values.applicableScope) {
    return { field: "applicableScope" };
  }

  if (
    values.applicableScope !== "allProducts" &&
    (!Array.isArray(values.applicableScopeReferenceIds) ||
      values.applicableScopeReferenceIds.length === 0)
  ) {
    return { field: "applicableScopeReferenceIds" };
  }

  if (
    values.excludedProductMode === "specific" &&
    (!Array.isArray(values.excludedProductIds) ||
      values.excludedProductIds.length === 0)
  ) {
    return { field: "excludedProductIds" };
  }

  if (typeof values.usageEndDayOfMonth !== "number") {
    return { field: "usageEndDayOfMonth" };
  }

  if (typeof values.usageEndHour !== "number") {
    return { field: "usageEndHour" };
  }

  if (typeof values.usageEndMinute !== "number") {
    return { field: "usageEndMinute" };
  }

  if (hasAlertSection) {
    const hasAnyAlert = Boolean(
      values.issueAlertEnabled || values.expireAlertEnabled,
    );

    if (hasAnyAlert && !values.alertChannel) {
      return { field: "alertChannel" };
    }
  }

  return null;
}

function CouponTemplateHelperNote({
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

function toMonthlyUsageEndDate(dayOfMonth: number | undefined): Dayjs | null {
  if (typeof dayOfMonth !== "number" || !Number.isFinite(dayOfMonth)) {
    return null;
  }

  return monthlyUsageEndDateReference.date(
    Math.max(1, Math.min(dayOfMonth, 31)),
  );
}

export default function CommerceCouponTemplateCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { templateId } = useParams<{ templateId?: string }>();
  const [form] = Form.useForm<CouponTemplateFormValues>();
  const isEdit = Boolean(templateId);
  const [reloadKey, setReloadKey] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [templateState, setTemplateState] = useState<
    AsyncState<CommerceCouponSubscriptionTemplate | null>
  >({
    status: isEdit ? "pending" : "success",
    data: null,
    errorMessage: null,
    errorCode: null,
  });
  const [submitState, setSubmitState] = useState<
    AsyncState<CommerceCouponSubscriptionTemplate | null>
  >({
    status: "idle",
    data: null,
    errorMessage: null,
    errorCode: null,
  });

  const selectedBenefitType = Form.useWatch("benefitType", form);
  const selectedApplicableScope = Form.useWatch("applicableScope", form);
  const selectedExcludedProductMode = Form.useWatch(
    "excludedProductMode",
    form,
  );
  const selectedGradeIds = Form.useWatch("targetGradeIds", form);
  const selectedIssueAlertEnabled = Form.useWatch("issueAlertEnabled", form);
  const selectedExpireAlertEnabled = Form.useWatch("expireAlertEnabled", form);
  const usageEndDayOfMonth = Form.useWatch("usageEndDayOfMonth", form);
  const usageEndHour = Form.useWatch("usageEndHour", form);
  const usageEndMinute = Form.useWatch("usageEndMinute", form);

  const listSearch = useMemo(() => {
    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.set("view", "subscriptionTemplate");
    nextSearchParams.delete("selected");
    const search = nextSearchParams.toString();
    return search ? `?${search}` : "?view=subscriptionTemplate";
  }, [location.search]);

  const benefitTypeOptions = useMemo(
    () => getCouponTemplateBenefitTypeOptions(),
    [],
  );
  const gradeOptions = useMemo(
    () => getCouponTemplateShoppingGradeSelectOptions(),
    [],
  );
  const scopeOptions = useMemo(() => getCouponTemplateScopeOptions(), []);
  const categoryOptions = useMemo(
    () => getCouponTemplateCategorySelectOptions(),
    [],
  );
  const productOptions = useMemo(
    () => getCouponTemplateProductSelectOptions(),
    [],
  );
  const alertChannelOptions = useMemo(
    () => getCouponTemplateAlertChannelOptions(),
    [],
  );
  const policyNotes = useMemo(
    () => getCouponTemplatePolicyNotes(selectedGradeIds ?? []),
    [selectedGradeIds],
  );
  const benefitFieldMeta = useMemo(() => {
    if (selectedBenefitType === "rateDiscount") {
      return {
        valueLabel: "할인 비율",
        valuePlaceholder: "1~100% 사이로 입력해 주세요.",
        valueRequiredMessage: "할인 비율을 입력해 주세요.",
        max: 100 as number | undefined,
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
  const usageEndDescription = useMemo(
    () =>
      formatCouponTemplateSchedule({
        dayOfMonth: usageEndDayOfMonth ?? 28,
        hour: usageEndHour ?? 23,
        minute: usageEndMinute ?? 59,
      }),
    [usageEndDayOfMonth, usageEndHour, usageEndMinute],
  );

  useEffect(() => {
    if (!isEdit || !templateId) {
      setTemplateState({
        status: "success",
        data: null,
        errorMessage: null,
        errorCode: null,
      });
      return;
    }

    const controller = new AbortController();

    setTemplateState((prev) => ({
      ...prev,
      status: "pending",
      errorMessage: null,
      errorCode: null,
    }));

    void fetchCouponTemplateSafe(templateId, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) {
          return;
        }

        if (result.ok) {
          setTemplateState({
            status: "success",
            data: result.data,
            errorMessage: null,
            errorCode: null,
          });
          return;
        }

        setTemplateState({
          status: "error",
          data: null,
          errorMessage: result.error.message,
          errorCode: result.error.code,
        });
      },
    );

    return () => controller.abort();
  }, [isEdit, reloadKey, templateId]);

  useEffect(() => {
    const defaults = createCouponTemplateDraftDefaults();
    const source = templateState.data;

    form.setFieldsValue({
      templateName: source?.templateName ?? defaults.templateName,
      targetGradeIds: source?.targetGradeIds ?? defaults.targetGradeIds,
      benefitType: source?.benefitType ?? defaults.benefitType,
      benefitValue: source?.benefitValue ?? defaults.benefitValue,
      maxDiscountAmount:
        source?.maxDiscountAmount ?? defaults.maxDiscountAmount,
      minOrderAmount: source?.minOrderAmount ?? defaults.minOrderAmount,
      applicableScope: source?.applicableScope ?? defaults.applicableScope,
      applicableScopeReferenceIds:
        source?.applicableScopeReferenceIds ??
        defaults.applicableScopeReferenceIds,
      excludedProductMode:
        source?.excludedProductMode ?? defaults.excludedProductMode,
      excludedProductIds:
        source?.excludedProductIds ?? defaults.excludedProductIds,
      isStackable: source?.isStackable ?? defaults.isStackable,
      usageEndDayOfMonth:
        source?.usageEndSchedule.dayOfMonth ??
        defaults.usageEndSchedule.dayOfMonth,
      usageEndHour:
        source?.usageEndSchedule.hour ?? defaults.usageEndSchedule.hour,
      usageEndMinute:
        source?.usageEndSchedule.minute ?? defaults.usageEndSchedule.minute,
      issueAlertEnabled:
        source?.issueAlertEnabled ?? defaults.issueAlertEnabled,
      expireAlertEnabled:
        source?.expireAlertEnabled ?? defaults.expireAlertEnabled,
      alertChannel: source?.alertChannel ?? defaults.alertChannel,
      adminMemo: source?.adminMemo ?? defaults.adminMemo,
    });
  }, [form, templateState.data]);

  useEffect(() => {
    if (selectedBenefitType === "freeShipping") {
      form.setFieldValue("benefitValue", 0);
      form.setFieldValue("maxDiscountAmount", null);
      return;
    }

    if (selectedBenefitType !== "rateDiscount") {
      form.setFieldValue("maxDiscountAmount", null);
    }
  }, [form, selectedBenefitType]);

  useEffect(() => {
    if (selectedApplicableScope === "allProducts") {
      form.setFieldValue("applicableScopeReferenceIds", []);
    }
  }, [form, selectedApplicableScope]);

  useEffect(() => {
    if (selectedExcludedProductMode === "none") {
      form.setFieldValue("excludedProductIds", []);
    }
  }, [form, selectedExcludedProductMode]);

  const handleBackToList = useCallback(() => {
    navigate(`/commerce/coupons${listSearch}`);
  }, [listSearch, navigate]);

  const handleReload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const basicItems = useMemo(
    () =>
      markRequiredDescriptionItems(
        [
          {
            key: "templateName",
            label: "정기 쿠폰명",
            children: (
              <Form.Item
                name="templateName"
                rules={[
                  { required: true, message: "정기 쿠폰명을 입력해 주세요." },
                ]}
                style={{ margin: 0 }}
              >
                <Input placeholder="정기 쿠폰명을 입력해 주세요." />
              </Form.Item>
            ),
          },
          {
            key: "targetGradeIds",
            label: "발행 대상",
            children: (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Form.Item
                  name="targetGradeIds"
                  rules={[
                    {
                      required: true,
                      type: "array",
                      min: 1,
                      message: "쇼핑 등급을 1개 이상 선택해 주세요.",
                    },
                  ]}
                  style={{ margin: 0 }}
                >
                  <Select
                    mode="multiple"
                    options={gradeOptions}
                    placeholder="발행 대상을 선택해 주세요."
                  />
                </Form.Item>
                <CouponTemplateHelperNote
                  title="쇼핑 등급 code table candidate"
                  description="현재는 웰컴/코어/VIP 3단계 mock 기준으로 운영하며, DB/API 전환 시 `shopping_grades` 계층으로 치환합니다."
                />
              </Space>
            ),
          },
        ],
        ["templateName", "targetGradeIds"],
      ),
    [gradeOptions],
  );

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
                  options={benefitTypeOptions}
                />
              </Form.Item>
            ),
          },
          {
            key: "benefitValue",
            label: benefitFieldMeta.valueLabel,
            children:
              selectedBenefitType === "freeShipping" ? (
                <CouponTemplateHelperNote
                  title="배송비 무료"
                  description="배송비 무료 혜택은 할인 금액 입력 없이 배송 정책만 적용됩니다."
                />
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
                  />
                </Form.Item>
              ),
          },
          {
            key: "maxDiscountAmount",
            label: "최대 할인 금액",
            children:
              selectedBenefitType === "rateDiscount" ? (
                <Form.Item name="maxDiscountAmount" style={{ margin: 0 }}>
                  <InputNumber
                    min={1}
                    style={{ width: "100%" }}
                    placeholder="최대 할인 금액을 입력해 주세요."
                  />
                </Form.Item>
              ) : (
                <Text type="secondary">사용 안 함</Text>
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
                  placeholder="최소 주문 금액을 입력해 주세요."
                />
              </Form.Item>
            ),
          },
          {
            key: "applicableScope",
            label: "쿠폰 적용 범위",
            children: (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Form.Item
                  name="applicableScope"
                  rules={[
                    {
                      required: true,
                      message: "쿠폰 적용 범위를 선택해 주세요.",
                    },
                  ]}
                  style={{ margin: 0 }}
                >
                  <Radio.Group
                    className="coupon-choice-radio-group coupon-choice-radio-group--wrap"
                    options={scopeOptions}
                  />
                </Form.Item>
                {selectedApplicableScope === "specificCategory" ? (
                  <Form.Item
                    name="applicableScopeReferenceIds"
                    rules={[
                      {
                        required: true,
                        type: "array",
                        min: 1,
                        message: "카테고리를 1개 이상 선택해 주세요.",
                      },
                    ]}
                    style={{ margin: 0 }}
                  >
                    <Select
                      mode="multiple"
                      options={categoryOptions}
                      placeholder="카테고리를 선택해 주세요."
                    />
                  </Form.Item>
                ) : null}
                {selectedApplicableScope === "specificProduct" ? (
                  <Form.Item
                    name="applicableScopeReferenceIds"
                    rules={[
                      {
                        required: true,
                        type: "array",
                        min: 1,
                        message: "상품을 1개 이상 선택해 주세요.",
                      },
                    ]}
                    style={{ margin: 0 }}
                  >
                    <Select
                      mode="multiple"
                      options={productOptions}
                      placeholder="상품을 선택해 주세요."
                    />
                  </Form.Item>
                ) : null}
              </Space>
            ),
          },
          {
            key: "excludedProductMode",
            label: "적용 제외 상품",
            children: (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Form.Item name="excludedProductMode" style={{ margin: 0 }}>
                  <Radio.Group
                    className="coupon-choice-radio-group"
                    options={[
                      { label: "지정 안 함", value: "none" },
                      { label: "상품 지정", value: "specific" },
                    ]}
                  />
                </Form.Item>
                {selectedExcludedProductMode === "specific" ? (
                  <Form.Item
                    name="excludedProductIds"
                    rules={[
                      {
                        required: true,
                        type: "array",
                        min: 1,
                        message: "제외 상품을 1개 이상 선택해 주세요.",
                      },
                    ]}
                    style={{ margin: 0 }}
                  >
                    <Select
                      mode="multiple"
                      options={productOptions}
                      placeholder="제외 상품을 선택해 주세요."
                    />
                  </Form.Item>
                ) : null}
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
        ["benefitType", "benefitValue", "minOrderAmount", "applicableScope"],
      ),
    [
      benefitTypeOptions,
      benefitFieldMeta.max,
      benefitFieldMeta.valueLabel,
      benefitFieldMeta.valuePlaceholder,
      benefitFieldMeta.valueRequiredMessage,
      categoryOptions,
      productOptions,
      scopeOptions,
      selectedApplicableScope,
      selectedBenefitType,
      selectedExcludedProductMode,
    ],
  );

  const operationItems = useMemo(
    () =>
      markRequiredDescriptionItems(
        [
          {
            key: "issueSchedule",
            label: "정기 발행 시점",
            children: (
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <div
                  aria-readonly="true"
                  style={couponTemplateReadOnlyFieldStyle}
                >
                  <Text strong>매월 1일 오전 7시</Text>
                </div>
                <Text type="secondary">
                  발행 시점은 현재 고정 정책입니다. 발행 주기 세분화는 후속 계약
                  단계에서 확정합니다.
                </Text>
              </Space>
            ),
          },
          {
            key: "usageEndSchedule",
            label: "쿠폰 사용 종료일",
            children: (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Space wrap size={8}>
                  <Form.Item
                    name="usageEndDayOfMonth"
                    getValueProps={(value: number | undefined) => ({
                      value: toMonthlyUsageEndDate(value),
                    })}
                    normalize={(value: Dayjs | null) => value?.date()}
                    rules={[
                      { required: true, message: "종료 일자를 선택해 주세요." },
                    ]}
                    style={{ margin: 0 }}
                  >
                    <DatePicker
                      allowClear={false}
                      defaultPickerValue={monthlyUsageEndDateReference}
                      format="매월 D일"
                      inputReadOnly
                      placeholder="사용 종료일 선택"
                    />
                  </Form.Item>
                  <Form.Item
                    name="usageEndHour"
                    rules={[
                      { required: true, message: "종료 시간을 입력해 주세요." },
                    ]}
                    style={{ margin: 0 }}
                  >
                    <InputNumber min={0} max={23} placeholder="시" />
                  </Form.Item>
                  <Text>시</Text>
                  <Form.Item
                    name="usageEndMinute"
                    rules={[
                      { required: true, message: "종료 분을 입력해 주세요." },
                    ]}
                    style={{ margin: 0 }}
                  >
                    <InputNumber min={0} max={59} placeholder="분" />
                  </Form.Item>
                  <Text>분</Text>
                </Space>
                <Text type="secondary">
                  현재 설정: 매월 {usageEndDescription}까지 사용 가능합니다.
                </Text>
                <Text type="secondary">
                  선택한 날짜가 없는 달은 해당 월의 말일까지 사용 가능합니다.
                </Text>
              </Space>
            ),
          },
        ],
        ["usageEndSchedule"],
      ),
    [usageEndDescription],
  );

  const alertItems = useMemo(
    () => [
      {
        key: "issueAlertEnabled",
        label: "발급 알림",
        children: (
          <Form.Item name="issueAlertEnabled" style={{ margin: 0 }}>
            <Radio.Group
              className="coupon-choice-radio-group"
              options={[
                { label: "발송 안 함", value: false },
                { label: "발송", value: true },
              ]}
            />
          </Form.Item>
        ),
      },
      {
        key: "expireAlertEnabled",
        label: "만료 알림",
        children: (
          <Form.Item name="expireAlertEnabled" style={{ margin: 0 }}>
            <Radio.Group
              className="coupon-choice-radio-group"
              options={[
                { label: "발송 안 함", value: false },
                { label: "발송", value: true },
              ]}
            />
          </Form.Item>
        ),
      },
      {
        key: "alertChannel",
        label: "알림 채널",
        children:
          selectedIssueAlertEnabled || selectedExpireAlertEnabled ? (
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Form.Item
                name="alertChannel"
                rules={[
                  { required: true, message: "알림 채널을 선택해 주세요." },
                ]}
                style={{ margin: 0 }}
              >
                <Radio.Group
                  className="coupon-choice-radio-group coupon-choice-radio-group--wrap"
                  options={alertChannelOptions}
                />
              </Form.Item>
              <CouponTemplateHelperNote
                title="알림 미리보기"
                description="정기 발행/만료 알림 메시지 템플릿은 실제 메시지 계약 확정 전까지 placeholder로 유지합니다."
              />
            </Space>
          ) : (
            <Text type="secondary">
              알림을 모두 끄면 채널을 선택할 수 없습니다.
            </Text>
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
    ],
    [
      alertChannelOptions,
      selectedExpireAlertEnabled,
      selectedIssueAlertEnabled,
    ],
  );

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
    () => alertItems.filter((item) => item.key !== "adminMemo"),
    [alertItems],
  );
  const hasAlertSection = Boolean(visibleAlertItems.length);
  const stepKeys = useMemo<CouponTemplateSectionKey[]>(
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
  const stepItems = useMemo(
    () =>
      stepKeys.map((stepKey) => ({
        title: couponTemplateSectionMeta[stepKey].title,
        description: couponTemplateSectionMeta[stepKey].description,
      })),
    [stepKeys],
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

  const hasCachedTemplate = Boolean(templateState.data);
  const isLoadingInitialTemplate =
    isEdit && templateState.status === "pending" && !hasCachedTemplate;
  const isSubmitting = submitState.status === "pending";
  const isSaveDisabled = isSubmitting || (isEdit && !hasCachedTemplate);
  const pageTitle = isEdit ? "정기 쿠폰 템플릿 수정" : "정기 쿠폰 템플릿 등록";

  const handleSubmit = useCallback(async () => {
    try {
      await form.validateFields();
    } catch (error) {
      const firstErrorFieldName = (
        error as { errorFields?: Array<{ name?: Array<string | number> }> }
      ).errorFields?.[0]?.name?.[0];

      setCurrentStep(
        findCouponTemplateStepIndexByFieldName(firstErrorFieldName, stepKeys),
      );
      return;
    }

    const partialValues = form.getFieldsValue(
      true,
    ) as Partial<CouponTemplateFormValues>;
    const hiddenValidationError = getFirstHiddenCouponTemplateValidationError(
      partialValues,
      hasAlertSection,
    );

    if (hiddenValidationError) {
      const nextStepIndex = findCouponTemplateStepIndexByFieldName(
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

    const values = form.getFieldsValue(true) as CouponTemplateFormValues;

    setSubmitState({
      status: "pending",
      data: null,
      errorMessage: null,
      errorCode: null,
    });

    const result = await saveCouponTemplateSafe({
      id: templateState.data?.id,
      templateName: values.templateName.trim(),
      targetGradeIds: values.targetGradeIds,
      benefitType: values.benefitType,
      benefitValue:
        values.benefitType === "freeShipping" ? 0 : values.benefitValue,
      minOrderAmount: values.minOrderAmount,
      maxDiscountAmount:
        values.benefitType === "rateDiscount"
          ? (values.maxDiscountAmount ?? null)
          : null,
      applicableScope: values.applicableScope,
      applicableScopeReferenceIds:
        values.applicableScope === "allProducts"
          ? []
          : values.applicableScopeReferenceIds,
      excludedProductMode: values.excludedProductMode,
      excludedProductIds:
        values.excludedProductMode === "specific"
          ? values.excludedProductIds
          : [],
      isStackable: values.isStackable,
      issueSchedule: {
        dayOfMonth: 1,
        hour: 7,
        minute: 0,
      },
      usageEndSchedule: {
        dayOfMonth: values.usageEndDayOfMonth,
        hour: values.usageEndHour,
        minute: values.usageEndMinute,
      },
      status: templateState.data?.status ?? "진행 중",
      issueAlertEnabled: values.issueAlertEnabled,
      expireAlertEnabled: values.expireAlertEnabled,
      alertChannel: values.alertChannel,
      adminMemo: values.adminMemo ?? "",
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

    const nextSearchParams = new URLSearchParams(listSearch.replace(/^\?/, ""));
    nextSearchParams.set("selected", result.data.id);
    const nextSearch = nextSearchParams.toString();

    navigate(`/commerce/coupons?${nextSearch}`, {
      state: {
        commerceCouponTemplateSaved: {
          templateId: result.data.id,
          mode: isEdit ? "edit" : "create",
        },
      },
    });
  }, [
    form,
    hasAlertSection,
    isEdit,
    listSearch,
    navigate,
    stepKeys,
    templateState.data,
  ]);

  return (
    <div className="content-editor-page">
      <PageTitle title={pageTitle} />

      {isEdit && templateState.status === "error" && !hasCachedTemplate ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="정기 쿠폰 템플릿을 불러오지 못했습니다."
          description={
            <Space direction="vertical">
              <span>
                {templateState.errorMessage ?? "일시적인 오류가 발생했습니다."}
              </span>
              {templateState.errorCode ? (
                <span>오류 코드: {templateState.errorCode}</span>
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
                {isEdit ? "저장" : "템플릿 생성"}
              </Button>
            </Space>
          </div>
        }
      >
        {isLoadingInitialTemplate ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="정기 쿠폰 템플릿 정보를 불러오는 중입니다."
            description="저장된 템플릿 정보를 확인한 뒤 수정 화면을 이어서 표시합니다."
          />
        ) : null}

        {isEdit && templateState.status === "pending" && hasCachedTemplate ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="최신 템플릿 정보를 다시 불러오는 중입니다."
            description="마지막으로 확인된 데이터를 유지한 채 상세 정보를 갱신합니다."
          />
        ) : null}

        {submitState.status === "error" ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="정기 쿠폰 템플릿 저장에 실패했습니다."
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

        {!isEdit || hasCachedTemplate ? (
          <Form form={form} layout="vertical">
            <AdminEditorForm
              stepAriaLabel="정기 쿠폰 템플릿 등록 단계"
              currentStep={currentStep}
              items={stepItems}
              onStepChange={handleStepChange}
            >
              {currentSectionKey === "basic" ? (
                <AdminEditorFormSection
                  title={couponTemplateSectionMeta.basic.title}
                  description={couponTemplateSectionMeta.basic.description}
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
                  title={couponTemplateSectionMeta.benefit.title}
                  description={couponTemplateSectionMeta.benefit.description}
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
                  title={couponTemplateSectionMeta.operation.title}
                  description={couponTemplateSectionMeta.operation.description}
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

              {currentSectionKey === "alert" && visibleAlertItems.length > 0 ? (
                <AdminEditorFormSection
                  title={couponTemplateSectionMeta.alert.title}
                  description={couponTemplateSectionMeta.alert.description}
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
                  title={couponTemplateSectionMeta.memo.title}
                  description={couponTemplateSectionMeta.memo.description}
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
