import { InfoCircleOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Space,
  Typography,
} from "antd";
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
import type { CommerceCouponSubscriptionTemplate } from "../model/coupon-template-types";
import { formatCouponTemplateSchedule } from "../model/coupon-template-types";
import {
  couponTemplateSectionMeta,
  findCouponTemplateStepIndexByFieldName,
  getFirstHiddenCouponTemplateValidationError,
  type CouponTemplateFormValues,
  type CouponTemplateSectionKey,
} from "../model/commerce-coupon-template-create-page-schema";
import {
  createCouponTemplateAlertItems,
  createCouponTemplateBasicItems,
  createCouponTemplateBenefitItems,
  createCouponTemplateMemoItems,
  createCouponTemplateOperationItems,
} from "../ui/commerce-coupon-template-create-form-items";
import type { AsyncState } from "@/shared/model/async-state";
import { routerSavedState } from "@/shared/model/router-saved-state";
import {
  AdminEditorForm,
  AdminEditorFormSection,
} from "@/shared/ui/admin-editor-form/admin-editor-form";
import { AdminListCard } from "@/shared/ui/list-page-card/admin-list-card";
import { PageTitle } from "@/shared/ui/page-title/page-title";
import { SPACE } from '@/shared/styles/design-tokens';

const { Text } = Typography;
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
    () => createCouponTemplateBasicItems({ gradeOptions }),
    [gradeOptions],
  );

  const benefitItems = useMemo(
    () =>
      createCouponTemplateBenefitItems({
        benefitTypeOptions,
        benefitFieldMeta,
        categoryOptions,
        productOptions,
        scopeOptions,
        selectedApplicableScope,
        selectedBenefitType,
        selectedExcludedProductMode,
      }),
    [
      benefitTypeOptions,
      benefitFieldMeta,
      categoryOptions,
      productOptions,
      scopeOptions,
      selectedApplicableScope,
      selectedBenefitType,
      selectedExcludedProductMode,
    ],
  );

  const operationItems = useMemo(
    () => createCouponTemplateOperationItems({ usageEndDescription }),
    [usageEndDescription],
  );

  const alertItems = useMemo(
    () =>
      createCouponTemplateAlertItems({
        alertChannelOptions,
        selectedExpireAlertEnabled,
        selectedIssueAlertEnabled,
      }),
    [
      alertChannelOptions,
      selectedExpireAlertEnabled,
      selectedIssueAlertEnabled,
    ],
  );

  const memoItems = useMemo(() => createCouponTemplateMemoItems(), []);
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
      ...(hasAlertSection ? (["alert"] as const) : []),
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
      state: routerSavedState("commerceCouponTemplateSaved", {
        templateId: result.data.id,
        mode: isEdit ? "edit" : "create",
      }),
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
          style={{ marginBottom: SPACE.base }}
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
            style={{ marginBottom: SPACE.sm }}
            message="정기 쿠폰 템플릿 정보를 불러오는 중입니다."
            description="저장된 템플릿 정보를 확인한 뒤 수정 화면을 이어서 표시합니다."
          />
        ) : null}

        {isEdit && templateState.status === "pending" && hasCachedTemplate ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: SPACE.sm }}
            message="최신 템플릿 정보를 다시 불러오는 중입니다."
            description="마지막으로 확인된 데이터를 유지한 채 상세 정보를 갱신합니다."
          />
        ) : null}

        {submitState.status === "error" ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: SPACE.sm }}
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
