import dayjs from 'dayjs';
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Space,
  Typography
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  fetchPolicySafe,
  savePolicySafe
} from '../api/policies-service';
import type { OperationPolicy } from '../model/policy-types';
import {
  operationPolicyCategoryValues,
  operationPolicyExposureSurfaceValues,
  operationPolicyRelatedAdminPageValues,
  operationPolicyRelatedUserPageValues,
  operationPolicyTrackingStatusValues,
  operationPolicyTypeValues
} from '../model/policy-types';
import {
  findStepIndexByFieldName,
  getFirstHiddenValidationError,
  normalizeLineList,
  normalizeOptionalText,
  parsePolicyCategoryQueryValue,
  parsePolicyEditorMode,
  parsePolicyTypeQueryValue,
  parseTrackingStatusQueryValue,
  policyCreateStepItems,
  policyTypePresetMap
} from '../model/operation-policy-create-page-schema';
import type {
  PolicyEditorMode,
  PolicyFormValues
} from '../model/operation-policy-create-page-schema';
import {
  createPolicyBasicItems,
  createPolicyBodyItems,
  createPolicyExposureItems,
  createPolicyLegalItems,
  createPolicyMemoItems,
  createPolicyTrackingItems
} from '../ui/operation-policy-create-form-items';
import type { AsyncState } from '@/shared/model/async-state';
import { routerSavedState } from '@/shared/model/router-saved-state';
import {
  AdminEditorForm,
  AdminEditorFormSection
} from '@/shared/ui/admin-editor-form/admin-editor-form';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '@/shared/ui/page-title/page-title';

const { Text } = Typography;

export default function OperationPolicyCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { policyId } = useParams<{ policyId?: string }>();
  const editorSearchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const [form] = Form.useForm<PolicyFormValues>();
  const requestedMode = parsePolicyEditorMode(editorSearchParams.get('mode'));
  const versionSourcePolicyId = editorSearchParams.get('sourcePolicyId');
  const editorMode: PolicyEditorMode = policyId
    ? 'edit'
    : requestedMode === 'version' && versionSourcePolicyId
      ? 'version'
      : 'create';
  const isEdit = editorMode === 'edit';
  const sourcePolicyId = isEdit ? policyId ?? null : versionSourcePolicyId;
  const [reloadKey, setReloadKey] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [policyState, setPolicyState] = useState<AsyncState<OperationPolicy | null>>({
    status: editorMode === 'create' ? 'success' : 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [submitState, setSubmitState] = useState<AsyncState<OperationPolicy | null>>({
    status: 'idle',
    data: null,
    errorMessage: null,
    errorCode: null
  });

  const selectedPolicyType = Form.useWatch('policyType', form);

  const listSearch = useMemo(() => {
    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.delete('mode');
    nextSearchParams.delete('sourcePolicyId');
    nextSearchParams.delete('selected');
    const search = nextSearchParams.toString();
    return search ? `?${search}` : '';
  }, [location.search]);

  const categoryOptions = useMemo(
    () => operationPolicyCategoryValues.map((value) => ({ label: value, value })),
    []
  );
  const policyTypeOptions = useMemo(
    () => operationPolicyTypeValues.map((value) => ({ label: value, value })),
    []
  );
  const exposureSurfaceOptions = useMemo(
    () => operationPolicyExposureSurfaceValues.map((value) => ({ label: value, value })),
    []
  );
  const trackingStatusOptions = useMemo(
    () => operationPolicyTrackingStatusValues.map((value) => ({ label: value, value })),
    []
  );
  const relatedAdminPageOptions = useMemo(
    () =>
      operationPolicyRelatedAdminPageValues.map((value) => ({
        label: value,
        value
      })),
    []
  );
  const relatedUserPageOptions = useMemo(
    () =>
      operationPolicyRelatedUserPageValues.map((value) => ({
        label: value,
        value
      })),
    []
  );
  const selectedPolicyPreset = useMemo(
    () => (selectedPolicyType ? policyTypePresetMap[selectedPolicyType] : null),
    [selectedPolicyType]
  );
  const createDefaultsFromQuery = useMemo(() => {
    return {
      policyType: parsePolicyTypeQueryValue(editorSearchParams.get('policyType')),
      category: parsePolicyCategoryQueryValue(editorSearchParams.get('category')),
      trackingStatus: parseTrackingStatusQueryValue(
        editorSearchParams.get('trackingStatus')
      )
    };
  }, [editorSearchParams]);

  useEffect(() => {
    if (editorMode !== 'create' || policyState.data) {
      return;
    }

    const nextValues: Partial<PolicyFormValues> = {};

    if (!form.getFieldValue('policyType') && createDefaultsFromQuery.policyType) {
      nextValues.policyType = createDefaultsFromQuery.policyType;
    }

    if (!form.getFieldValue('category') && createDefaultsFromQuery.category) {
      nextValues.category = createDefaultsFromQuery.category;
    }

    if (
      !form.getFieldValue('trackingStatus') &&
      createDefaultsFromQuery.trackingStatus
    ) {
      nextValues.trackingStatus = createDefaultsFromQuery.trackingStatus;
    }

    if (Object.keys(nextValues).length > 0) {
      form.setFieldsValue(nextValues);
    }
  }, [createDefaultsFromQuery, editorMode, form, policyState.data]);

  useEffect(() => {
    if (editorMode !== 'create' || policyState.data || !selectedPolicyPreset) {
      return;
    }

    const nextValues: Partial<PolicyFormValues> = {};

    if (!form.getFieldValue('category')) {
      nextValues.category = selectedPolicyPreset.category;
    }

    if (!form.getFieldValue('trackingStatus')) {
      nextValues.trackingStatus = selectedPolicyPreset.trackingStatus;
    }

    if (!(form.getFieldValue('relatedAdminPages')?.length ?? 0)) {
      nextValues.relatedAdminPages = selectedPolicyPreset.relatedAdminPages;
    }

    if (!(form.getFieldValue('relatedUserPages')?.length ?? 0)) {
      nextValues.relatedUserPages = selectedPolicyPreset.relatedUserPages;
    }

    if (Object.keys(nextValues).length > 0) {
      form.setFieldsValue(nextValues);
    }
  }, [editorMode, form, policyState.data, selectedPolicyPreset]);

  useEffect(() => {
    if (!sourcePolicyId) {
      setPolicyState({
        status: 'success',
        data: null,
        errorMessage: null,
        errorCode: null
      });
      return;
    }

    const controller = new AbortController();

    setPolicyState((previousState) => ({
      ...previousState,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchPolicySafe(sourcePolicyId, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setPolicyState({
          status: 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setPolicyState({
        status: 'error',
        data: null,
        errorMessage: result.error.message,
        errorCode: result.error.code
      });
    });

    return () => controller.abort();
  }, [reloadKey, sourcePolicyId]);

  useEffect(() => {
    const source = policyState.data;

    if (!source) {
      return;
    }

    form.setFieldsValue({
      category: source.category,
      policyType: source.policyType,
      title: source.title,
      versionLabel: editorMode === 'version' ? '' : source.versionLabel,
      effectiveDate:
        editorMode === 'version'
          ? null
          : source.effectiveDate
            ? dayjs(source.effectiveDate)
            : null,
      exposureSurfaces: source.exposureSurfaces,
      requiresConsent: source.requiresConsent,
      trackingStatus: source.trackingStatus,
      relatedAdminPages: source.relatedAdminPages,
      relatedUserPages: source.relatedUserPages,
      sourceDocumentsText: source.sourceDocuments.join('\n'),
      summary: source.summary,
      legalReferencesText: source.legalReferences.join('\n'),
      bodyHtml: source.bodyHtml,
      adminMemo: source.adminMemo
    });
  }, [editorMode, form, policyState.data]);

  const handleBackToList = useCallback(() => {
    navigate(`/operation/policies${listSearch}`);
  }, [listSearch, navigate]);

  const handleReload = useCallback(() => {
    setReloadKey((previousValue) => previousValue + 1);
  }, []);

  const basicItems = useMemo(
    () => createPolicyBasicItems({ categoryOptions, policyTypeOptions }),
    [categoryOptions, policyTypeOptions]
  );

  const exposureItems = useMemo(
    () => createPolicyExposureItems({ exposureSurfaceOptions }),
    [exposureSurfaceOptions]
  );

  const trackingItems = useMemo(
    () =>
      createPolicyTrackingItems({
        trackingStatusOptions,
        relatedAdminPageOptions,
        relatedUserPageOptions
      }),
    [relatedAdminPageOptions, relatedUserPageOptions, trackingStatusOptions]
  );

  const legalItems = useMemo(() => createPolicyLegalItems(), []);

  const bodyItems = useMemo(() => createPolicyBodyItems({ policyId }), [policyId]);

  const memoItems = useMemo(() => createPolicyMemoItems(), []);

  const stepItems = useMemo(
    () =>
      policyCreateStepItems.map((item) => ({
        title: item.title,
        description: item.description
      })),
    []
  );
  const currentSectionKey = policyCreateStepItems[currentStep]?.key ?? 'basic';

  const handleStepChange = useCallback((nextStep: number) => {
    setCurrentStep(
      Math.max(0, Math.min(nextStep, policyCreateStepItems.length - 1))
    );
  }, []);

  const hasCachedPolicy = Boolean(policyState.data);
  const isLoadingInitialPolicy =
    editorMode !== 'create' && policyState.status === 'pending' && !hasCachedPolicy;
  const isSubmitting = submitState.status === 'pending';
  const isSaveDisabled =
    isSubmitting || (editorMode !== 'create' && !hasCachedPolicy);
  const resolvedPageTitle =
    editorMode === 'edit'
      ? '정책 내용 수정 상세'
      : editorMode === 'version'
        ? '정책 새 버전 등록 상세'
        : '정책 등록 상세';
  const loadErrorMessage =
    editorMode === 'edit'
      ? '정책 내용 수정 대상을 불러오지 못했습니다.'
      : '새 버전 등록 기준 정책을 불러오지 못했습니다.';

  const handleSubmit = useCallback(async () => {
    try {
      await form.validateFields();
    } catch (error) {
      const firstErrorFieldName = (
        error as { errorFields?: Array<{ name?: Array<string | number> }> }
      ).errorFields?.[0]?.name?.[0];

      setCurrentStep(findStepIndexByFieldName(firstErrorFieldName));
      return;
    }

    const partialValues = form.getFieldsValue(true) as Partial<PolicyFormValues>;
    const hiddenValidationError = getFirstHiddenValidationError(partialValues);

    if (hiddenValidationError) {
      setCurrentStep(findStepIndexByFieldName(hiddenValidationError.field));

      window.setTimeout(() => {
        void form.validateFields([hiddenValidationError.field]).catch(() => undefined);
      }, 0);

      return;
    }

    const values = form.getFieldsValue(true) as PolicyFormValues;

    if (!values.effectiveDate) {
      return;
    }

    setSubmitState({
      status: 'pending',
      data: null,
      errorMessage: null,
      errorCode: null
    });

    const result = await savePolicySafe({
      id: isEdit ? policyState.data?.id : undefined,
      mode: editorMode,
      category: values.category,
      policyType: values.policyType,
      title: normalizeOptionalText(values.title),
      versionLabel: normalizeOptionalText(values.versionLabel),
      effectiveDate: values.effectiveDate.format('YYYY-MM-DD'),
      exposureSurfaces: values.exposureSurfaces,
      requiresConsent: values.requiresConsent,
      trackingStatus: values.trackingStatus,
      relatedAdminPages: values.relatedAdminPages ?? [],
      relatedUserPages: values.relatedUserPages ?? [],
      sourceDocuments: normalizeLineList(values.sourceDocumentsText),
      summary: normalizeOptionalText(values.summary),
      legalReferences: normalizeLineList(values.legalReferencesText),
      bodyHtml: values.bodyHtml,
      adminMemo: normalizeOptionalText(values.adminMemo)
    });

    if (!result.ok) {
      setSubmitState({
        status: 'error',
        data: null,
        errorMessage: result.error.message,
        errorCode: result.error.code
      });
      return;
    }

    setSubmitState({
      status: 'success',
      data: result.data,
      errorMessage: null,
      errorCode: null
    });

    navigate(`/operation/policies${listSearch}`, {
      replace: true,
      state: routerSavedState('operationPolicySaved', {
        policyId: result.data.id,
        mode:
          editorMode === 'edit'
            ? 'edit'
            : editorMode === 'version'
              ? 'version'
              : 'create'
      })
    });
  }, [editorMode, form, isEdit, listSearch, navigate, policyState.data]);

  return (
    <div className="content-editor-page">
      <PageTitle title={resolvedPageTitle} />

      {editorMode !== 'create' && policyState.status === 'error' && !hasCachedPolicy ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={loadErrorMessage}
          description={
            <Space direction="vertical">
              <span>{policyState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</span>
              {policyState.errorCode ? <span>오류 코드: {policyState.errorCode}</span> : null}
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

      {editorMode === 'version' && hasCachedPolicy ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="현재 정책 내용을 복사해 새 버전 초안을 작성합니다."
          description="버전과 시행일은 새 값으로 다시 입력해야 하며, 저장 후 새 버전은 숨김 상태로 목록에 추가됩니다."
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
                저장
              </Button>
            </Space>
          </div>
        }
      >
        {isLoadingInitialPolicy ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="정책 정보를 불러오는 중입니다."
            description="저장된 정책 메타와 본문을 확인한 뒤 수정 화면을 이어서 표시합니다."
          />
        ) : null}

        {isEdit && policyState.status === 'pending' && hasCachedPolicy ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="최신 정책 정보를 다시 불러오는 중입니다."
            description="마지막으로 확인된 데이터를 유지한 채 상세 정보를 갱신합니다."
          />
        ) : null}

        {submitState.status === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="정책 저장에 실패했습니다."
            description={
              <Space direction="vertical">
                <span>{submitState.errorMessage ?? '입력값을 다시 확인하세요.'}</span>
                {submitState.errorCode ? <span>오류 코드: {submitState.errorCode}</span> : null}
              </Space>
            }
          />
        ) : null}

        {!isEdit || hasCachedPolicy ? (
          <Form form={form} layout="vertical">
            <AdminEditorForm
              stepAriaLabel="정책 등록 단계"
              currentStep={currentStep}
              items={stepItems}
              onStepChange={handleStepChange}
            >
              {currentSectionKey === 'basic' ? (
                <AdminEditorFormSection
                  title="기본 정보"
                  description="운영 영역, 정책 유형, 문서명을 먼저 고정합니다."
                >
                  {selectedPolicyPreset ? (
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message={selectedPolicyType}
                      description={
                        <Space direction="vertical" size={4}>
                          <Text>{selectedPolicyPreset.description}</Text>
                          <Text>
                            권장 운영 영역: {selectedPolicyPreset.category} / 추적 상태:{' '}
                            {selectedPolicyPreset.trackingStatus}
                          </Text>
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

              {currentSectionKey === 'exposure' ? (
                <AdminEditorFormSection
                  title="노출 및 동의"
                  description="시행일, 노출 위치, 동의 필요 여부를 확정합니다."
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={exposureItems}
                  />
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === 'tracking' ? (
                <AdminEditorFormSection
                  title="추적 근거"
                  description="정책 추적 상태와 연관 화면, 근거 문서를 함께 남깁니다."
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={trackingItems}
                  />
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === 'legal' ? (
                <AdminEditorFormSection
                  title="법령 및 요약"
                  description="운영 요약과 법령 근거를 먼저 정리합니다."
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={legalItems}
                  />
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === 'body' ? (
                <AdminEditorFormSection
                  title="정책 본문"
                  description="TinyMCE로 사용자 노출 본문을 작성합니다."
                >
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    className="admin-form-descriptions admin-editor-form-descriptions"
                    items={bodyItems}
                  />
                </AdminEditorFormSection>
              ) : null}

              {currentSectionKey === 'memo' ? (
                <AdminEditorFormSection
                  title="관리자 메모"
                  description="후속 검수 메모와 운영 참고 사항을 기록합니다."
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
