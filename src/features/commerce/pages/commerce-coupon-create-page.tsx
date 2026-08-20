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
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import dayjs from "dayjs";

import { fetchCouponSafe, saveCouponSafe } from "../api/coupons-service";
import { fetchMessageOptionSourcesSafe } from "@/features/message/api/messages-service";
import type {
  MessageGroup,
  MessageTemplate,
} from "@/features/message/model/types";
import {
  createCouponDraftDefaults,
  getCouponPolicyNotes,
  parseCouponUserIds,
  serializeCouponUserIds,
} from "../model/coupon-form-schema";
import {
  getCouponKindLabel,
  type CommerceCoupon,
} from "../model/coupon-types";
import {
  buildCouponBenefitFieldMeta,
  buildCouponValidityModeOptions,
  couponCreateSectionMeta,
  couponCreateStepFieldMap,
  couponKindMetaMap,
  createDefaultValidityRange,
  findCouponStepIndexByFieldName,
  getAllowedValidityModes,
  getFirstHiddenCouponValidationError,
  parseCouponKind,
  resolveCouponStatus,
  type CouponCreateSectionKey,
  type CouponFormValues,
} from "../model/commerce-coupon-create-page-schema";
import {
  createCouponAlertItems,
  createCouponBasicItems,
  createCouponBenefitItems,
  createCouponMemoItems,
  createCouponOperationItems,
} from "../ui/commerce-coupon-create-form-items";
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

export default function CommerceCouponCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { couponId } = useParams<{ couponId?: string }>();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<CouponFormValues>();
  const [groups, setGroups] = useState<MessageGroup[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
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
  const benefitFieldMeta = useMemo(
    () => buildCouponBenefitFieldMeta(selectedBenefitType),
    [selectedBenefitType],
  );
  const validityModeOptions = useMemo(
    () => buildCouponValidityModeOptions(activeCouponKind),
    [activeCouponKind],
  );

  useEffect(() => {
    const controller = new AbortController();

    void fetchMessageOptionSourcesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted || !result.ok) {
        return;
      }

      setGroups(result.data.groups);
      setTemplates(result.data.templates);
    });

    return () => controller.abort();
  }, []);

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
      state: routerSavedState("commerceCouponSaved", {
        couponId: result.data.id,
        mode: isEdit ? "edit" : "create",
      }),
    });
  };

  const basicItems = useMemo(
    () =>
      createCouponBasicItems({
        activeCouponKind,
        groupOptions,
        selectedCodeGenerationMode,
        selectedIssueLimitMode,
        selectedIssueTargetType,
      }),
    [
      activeCouponKind,
      groupOptions,
      selectedCodeGenerationMode,
      selectedIssueLimitMode,
      selectedIssueTargetType,
    ],
  );

  const benefitItems = useMemo(
    () => createCouponBenefitItems({ benefitFieldMeta, selectedBenefitType }),
    [benefitFieldMeta, selectedBenefitType],
  );

  const operationItems = useMemo(
    () =>
      createCouponOperationItems({
        activeCouponKind,
        selectedUsageLimitMode,
        selectedValidityMode,
        validityModeOptions,
      }),
    [
      activeCouponKind,
      selectedUsageLimitMode,
      selectedValidityMode,
      validityModeOptions,
    ],
  );

  const alertItems = useMemo(
    () =>
      createCouponAlertItems({
        activeCouponKind,
        selectedExpireAlertEnabled,
        selectedIssueAlertEnabled,
        templateOptions,
      }),
    [
      activeCouponKind,
      selectedExpireAlertEnabled,
      selectedIssueAlertEnabled,
      templateOptions,
    ],
  );

  const memoItems = useMemo(() => createCouponMemoItems(), []);
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
      ...(hasAlertSection ? (["alert"] as const) : []),
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
          style={{ marginBottom: SPACE.base }}
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
            style={{ marginBottom: SPACE.sm }}
            message="쿠폰 상세 정보를 불러오는 중입니다."
            description="저장된 쿠폰 정보를 확인한 뒤 수정 화면을 이어서 표시합니다."
          />
        ) : null}

        {isEdit && couponState.status === "pending" && hasCachedCoupon ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: SPACE.sm }}
            message="최신 쿠폰 정보를 다시 불러오는 중입니다."
            description="마지막으로 확인된 데이터를 유지한 채 상세 정보를 갱신합니다."
          />
        ) : null}

        {submitState.status === "error" ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: SPACE.sm }}
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
