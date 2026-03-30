import dayjs, { type Dayjs } from 'dayjs';
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Typography
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  fetchPolicySafe,
  savePolicySafe
} from '../api/policies-service';
import type {
  OperationPolicy,
  OperationPolicyCategory,
  OperationPolicyTrackingStatus,
  OperationPolicyType
} from '../model/policy-types';
import {
  inferOperationPolicyRelatedAdminPages,
  inferOperationPolicyRelatedUserPages,
  operationPolicyCategoryValues,
  operationPolicyExposureSurfaceValues,
  operationPolicyRelatedAdminPageValues,
  operationPolicyRelatedUserPageValues,
  operationPolicyTrackingStatusValues,
  operationPolicyTypeValues
} from '../model/policy-types';
import type { AsyncState } from '../../../shared/model/async-state';
import {
  AdminEditorForm,
  AdminEditorFormSection
} from '../../../shared/ui/admin-editor-form/admin-editor-form';
import { markRequiredDescriptionItems } from '../../../shared/ui/descriptions/description-label';
import { createDescriptionLabel } from '../../../shared/ui/descriptions/description-label';
import {
  DEFAULT_TINYMCE_PLUGINS,
  DEFAULT_TINYMCE_TOOLBAR,
  TinyMceHtmlEditor
} from '../../../shared/ui/html-editor/tiny-mce-html-editor';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Text } = Typography;

type PolicyFormValues = {
  category: OperationPolicyCategory;
  policyType: OperationPolicyType;
  title: string;
  versionLabel: string;
  effectiveDate: Dayjs | null;
  exposureSurfaces: OperationPolicy['exposureSurfaces'];
  requiresConsent: boolean;
  trackingStatus: OperationPolicyTrackingStatus;
  relatedAdminPages: OperationPolicy['relatedAdminPages'];
  relatedUserPages: OperationPolicy['relatedUserPages'];
  sourceDocumentsText: string;
  summary: string;
  legalReferencesText: string;
  bodyHtml: string;
  adminMemo: string;
};

type PolicyCreateSectionKey =
  | 'basic'
  | 'exposure'
  | 'tracking'
  | 'legal'
  | 'body'
  | 'memo';

type PolicyEditorMode = 'create' | 'edit' | 'version';

type PolicyTypePreset = {
  description: string;
  category: OperationPolicyCategory;
  trackingStatus: OperationPolicyTrackingStatus;
  relatedAdminPages: OperationPolicy['relatedAdminPages'];
  relatedUserPages: OperationPolicy['relatedUserPages'];
};

const policyTypePresetMap: Record<OperationPolicyType, PolicyTypePreset> = {
  이용약관: {
    description: '서비스 이용 조건과 계정 운영 기준을 고정하는 기본 약관입니다.',
    category: '법률/약관',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('이용약관'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('이용약관')
  },
  '개인정보 처리방침': {
    description: '수집 항목, 처리 목적, 보관 기간, 파기 절차를 고지하는 법적 문서입니다.',
    category: '법률/약관',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('개인정보 처리방침'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('개인정보 처리방침')
  },
  '결제ㆍ환불 정책': {
    description: '결제 승인, 환불 가능 조건, 부분 환불 제한을 함께 다루는 정책입니다.',
    category: '결제/리워드',
    trackingStatus: '문서 추적',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('결제ㆍ환불 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('결제ㆍ환불 정책')
  },
  '청소년 보호정책': {
    description: '청소년 유해 정보 차단, 신고 처리, 보호 책임자 안내 기준을 담습니다.',
    category: '커뮤니티/안전',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('청소년 보호정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('청소년 보호정책')
  },
  '커뮤니티 게시글 제재 정책': {
    description: '게시글 숨김/삭제 시 쓰는 정책 코드와 내부 메모 기준을 관리합니다.',
    category: '커뮤니티/안전',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('커뮤니티 게시글 제재 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('커뮤니티 게시글 제재 정책')
  },
  '추천인 보상 정책': {
    description: '추천 확정 시점, 보상 수단, 회수 규칙, 수동 보정 권한을 추적합니다.',
    category: '결제/리워드',
    trackingStatus: '문서 추적',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('추천인 보상 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('추천인 보상 정책')
  },
  '포인트 운영정책': {
    description: '적립 원천, 차감 우선순위, 소멸/보류 규칙을 추적하는 운영 정책입니다.',
    category: '결제/리워드',
    trackingStatus: '문서 추적',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('포인트 운영정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('포인트 운영정책')
  },
  '쿠폰 운영정책': {
    description: '쿠폰 유형별 운영 규칙과 자동 발행/삭제/노출 기준을 묶는 정책입니다.',
    category: '결제/리워드',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('쿠폰 운영정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('쿠폰 운영정책')
  },
  '이벤트 운영정책': {
    description: '이벤트 노출, 참여 조건, 보상 연결, 종료 처리 기준을 관리합니다.',
    category: '운영/콘텐츠',
    trackingStatus: '문서 추적',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('이벤트 운영정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('이벤트 운영정책')
  },
  'FAQ 노출 정책': {
    description: 'FAQ 공개 상태와 홈/결제/온보딩 노출 큐레이션 기준을 정리합니다.',
    category: '운영/콘텐츠',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('FAQ 노출 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('FAQ 노출 정책')
  },
  '챗봇 상담 전환 정책': {
    description: '챗봇 fallback, 상담 인계, FAQ 참조 규칙을 placeholder 단계에서 추적합니다.',
    category: '운영/콘텐츠',
    trackingStatus: '정책 미확정',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('챗봇 상담 전환 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('챗봇 상담 전환 정책')
  },
  '메일 발송 운영정책': {
    description: '메일 템플릿 등록, 본문 작성, 즉시/예약 발송의 운영 기준을 관리합니다.',
    category: '메시지/알림',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('메일 발송 운영정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('메일 발송 운영정책')
  },
  '푸시 발송 운영정책': {
    description: '푸시 템플릿 등록, 본문 작성, 즉시/예약 발송의 운영 기준을 관리합니다.',
    category: '메시지/알림',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('푸시 발송 운영정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('푸시 발송 운영정책')
  },
  '발송 실패/재시도 정책': {
    description: '실패 건 재시도 범위, 중복 발송 방지, 보존 기간을 추적합니다.',
    category: '메시지/알림',
    trackingStatus: '정책 미확정',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('발송 실패/재시도 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('발송 실패/재시도 정책')
  },
  '관리자 권한 변경 정책': {
    description: '권한 부여/수정/회수 시 승인과 감사 추적 기준을 다루는 내부 정책입니다.',
    category: '관리자/보안',
    trackingStatus: '문서 추적',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('관리자 권한 변경 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('관리자 권한 변경 정책')
  },
  '마케팅 정보 수신 동의': {
    description: '메일/푸시 수신 동의와 철회 기준을 고지하는 사용자 동의 문서입니다.',
    category: '메시지/알림',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('마케팅 정보 수신 동의'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('마케팅 정보 수신 동의')
  }
};

const policyCreateStepItems: Array<{
  key: PolicyCreateSectionKey;
  title: string;
  description: string;
}> = [
  { key: 'basic', title: '기본 정보', description: '운영 영역, 정책 유형, 문서명' },
  { key: 'exposure', title: '노출 및 동의', description: '시행일, 노출 위치, 동의 여부' },
  { key: 'tracking', title: '추적 근거', description: '정책 추적 상태, 연관 화면, 근거 문서' },
  { key: 'legal', title: '법령 및 요약', description: '정책 요약, 법령/근거' },
  { key: 'body', title: '정책 본문', description: 'TinyMCE 본문 작성' },
  { key: 'memo', title: '관리자 메모', description: '운영 검수 메모' }
];

const policyCreateStepFieldMap: Record<
  PolicyCreateSectionKey,
  Array<keyof PolicyFormValues>
> = {
  basic: ['category', 'policyType', 'title', 'versionLabel'],
  exposure: ['effectiveDate', 'exposureSurfaces', 'requiresConsent'],
  tracking: [
    'trackingStatus',
    'relatedAdminPages',
    'relatedUserPages',
    'sourceDocumentsText'
  ],
  legal: ['summary', 'legalReferencesText'],
  body: ['bodyHtml'],
  memo: ['adminMemo']
};

function parsePolicyTypeQueryValue(value: string | null): OperationPolicyType | undefined {
  if (!value) {
    return undefined;
  }

  return operationPolicyTypeValues.includes(value as OperationPolicyType)
    ? (value as OperationPolicyType)
    : undefined;
}

function parsePolicyCategoryQueryValue(
  value: string | null
): OperationPolicyCategory | undefined {
  if (!value) {
    return undefined;
  }

  return operationPolicyCategoryValues.includes(value as OperationPolicyCategory)
    ? (value as OperationPolicyCategory)
    : undefined;
}

function parseTrackingStatusQueryValue(
  value: string | null
): OperationPolicyTrackingStatus | undefined {
  if (!value) {
    return undefined;
  }

  return operationPolicyTrackingStatusValues.includes(
    value as OperationPolicyTrackingStatus
  )
    ? (value as OperationPolicyTrackingStatus)
    : undefined;
}

function parsePolicyEditorMode(value: string | null): PolicyEditorMode {
  if (value === 'version') {
    return 'version';
  }

  return 'create';
}

function findStepIndexByFieldName(fieldName: string | number | undefined): number {
  if (typeof fieldName !== 'string') {
    return 0;
  }

  const matchedStepIndex = policyCreateStepItems.findIndex((item) =>
    policyCreateStepFieldMap[item.key].includes(fieldName as keyof PolicyFormValues)
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

function normalizeLineList(text: string | undefined): string[] {
  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeOptionalText(value: string | undefined): string {
  return value?.trim() ?? '';
}

function getFirstHiddenValidationError(values: Partial<PolicyFormValues>): {
  field: keyof PolicyFormValues;
} | null {
  if (!values.category) {
    return { field: 'category' };
  }

  if (!values.policyType) {
    return { field: 'policyType' };
  }

  if (!values.title?.trim()) {
    return { field: 'title' };
  }

  if (!values.versionLabel?.trim()) {
    return { field: 'versionLabel' };
  }

  if (!values.effectiveDate) {
    return { field: 'effectiveDate' };
  }

  if (!values.exposureSurfaces?.length) {
    return { field: 'exposureSurfaces' };
  }

  if (!values.trackingStatus) {
    return { field: 'trackingStatus' };
  }

  if (!values.summary?.trim()) {
    return { field: 'summary' };
  }

  if (isRichTextEmpty(values.bodyHtml)) {
    return { field: 'bodyHtml' };
  }

  return null;
}

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
    () =>
      markRequiredDescriptionItems(
        [
          {
            key: 'category',
            label: '운영 영역',
            children: (
              <Form.Item
                name="category"
                rules={[{ required: true, message: '운영 영역을 선택하세요.' }]}
                style={{ margin: 0 }}
              >
                <Select options={categoryOptions} placeholder="운영 영역 선택" />
              </Form.Item>
            )
          },
          {
            key: 'policyType',
            label: '정책 유형',
            children: (
              <Form.Item
                name="policyType"
                rules={[{ required: true, message: '정책 유형을 선택하세요.' }]}
                style={{ margin: 0 }}
              >
                <Select options={policyTypeOptions} placeholder="정책 유형 선택" />
              </Form.Item>
            )
          },
          {
            key: 'title',
            label: '문서명',
            children: (
              <Form.Item
                name="title"
                rules={[{ required: true, message: '문서명을 입력하세요.' }]}
                style={{ margin: 0 }}
              >
                <Input placeholder="문서명을 입력하세요." />
              </Form.Item>
            )
          },
          {
            key: 'versionLabel',
            label: '버전',
            children: (
              <Form.Item
                name="versionLabel"
                rules={[{ required: true, message: '버전을 입력하세요.' }]}
                style={{ margin: 0 }}
              >
                <Input placeholder="예: v2026.03" />
              </Form.Item>
            )
          }
        ],
        ['category', 'policyType', 'title', 'versionLabel']
      ),
    [categoryOptions, policyTypeOptions]
  );

  const exposureItems = useMemo(
    () =>
      markRequiredDescriptionItems(
        [
          {
            key: 'effectiveDate',
            label: '시행일',
            children: (
              <Form.Item
                name="effectiveDate"
                rules={[{ required: true, message: '시행일을 선택하세요.' }]}
                style={{ margin: 0 }}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            )
          },
          {
            key: 'exposureSurfaces',
            label: '노출 위치',
            children: (
              <Form.Item
                name="exposureSurfaces"
                rules={[
                  {
                    required: true,
                    type: 'array',
                    min: 1,
                    message: '노출 위치를 선택하세요.'
                  }
                ]}
                style={{ margin: 0 }}
              >
                <Select
                  mode="multiple"
                  options={exposureSurfaceOptions}
                  placeholder="노출 위치 선택"
                />
              </Form.Item>
            )
          },
          {
            key: 'requiresConsent',
            label: '동의 필요 여부',
            children: (
              <Form.Item name="requiresConsent" style={{ margin: 0 }}>
                <Radio.Group
                  className="coupon-choice-radio-group"
                  options={[
                    { label: '고지형 문서', value: false },
                    { label: '동의 필요 문서', value: true }
                  ]}
                />
              </Form.Item>
            )
          }
        ],
        ['effectiveDate', 'exposureSurfaces']
      ),
    [exposureSurfaceOptions]
  );

  const trackingItems = useMemo(
    () => [
      {
        key: 'trackingStatus',
        label: createDescriptionLabel('정책 추적 상태', {
          required: true,
          tooltip:
            '이 정책이 실제 코드에 반영됐는지, 문서 단계인지, 아직 정책 미확정 상태인지 표시합니다.'
        }),
        children: (
          <Form.Item
            name="trackingStatus"
            rules={[{ required: true, message: '정책 추적 상태를 선택하세요.' }]}
            style={{ margin: 0 }}
          >
            <Select options={trackingStatusOptions} placeholder="정책 추적 상태 선택" />
          </Form.Item>
        )
      },
      {
        key: 'relatedAdminPages',
        label: createDescriptionLabel('연관 관리자 화면', {
          tooltip: '이 정책을 검수할 때 함께 확인해야 하는 관리자 화면입니다.'
        }),
        children: (
          <Form.Item name="relatedAdminPages" style={{ margin: 0 }}>
            <Select
              mode="multiple"
              options={relatedAdminPageOptions}
              optionFilterProp="label"
              placeholder="연관 관리자 화면 선택"
            />
          </Form.Item>
        )
      },
      {
        key: 'relatedUserPages',
        label: createDescriptionLabel('연관 사용자 화면', {
          tooltip:
            '현재는 운영상 추정값입니다. 실제 B2C 노출 위치가 확정되면 확인됨으로 승격해 관리합니다.'
        }),
        children: (
          <Form.Item name="relatedUserPages" style={{ margin: 0 }}>
            <Select
              mode="multiple"
              options={relatedUserPageOptions}
              optionFilterProp="label"
              placeholder="연관 사용자 화면 선택"
            />
          </Form.Item>
        )
      },
      {
        key: 'sourceDocumentsText',
        label: createDescriptionLabel('근거 문서', {
          tooltip:
            '관련 IA, 코드 파일, 운영 문서 경로를 남겨 정책 근거를 역추적할 수 있게 합니다.'
        }),
        children: (
          <Form.Item name="sourceDocumentsText" style={{ margin: 0 }}>
            <Input.TextArea
              rows={4}
              placeholder="한 줄에 하나씩 입력하세요. 예: docs/specs/page-ia/operation-policies-page-ia.md"
            />
          </Form.Item>
        )
      }
    ],
    [relatedAdminPageOptions, relatedUserPageOptions, trackingStatusOptions]
  );

  const legalItems = useMemo(
    () =>
      markRequiredDescriptionItems(
        [
          {
            key: 'summary',
            label: '정책 요약',
            children: (
              <Form.Item
                name="summary"
                rules={[{ required: true, message: '정책 요약을 입력하세요.' }]}
                style={{ margin: 0 }}
              >
                <Input.TextArea
                  rows={4}
                  placeholder="운영자가 먼저 확인해야 할 핵심 요약을 입력하세요."
                />
              </Form.Item>
            )
          },
          {
            key: 'legalReferencesText',
            label: '법령/근거',
            children: (
              <Form.Item name="legalReferencesText" style={{ margin: 0 }}>
                <Input.TextArea
                  rows={4}
                  placeholder="한 줄에 하나씩 입력하세요. 예: 개인정보 보호법"
                />
              </Form.Item>
            )
          }
        ],
        ['summary']
      ),
    []
  );

  const bodyItems = useMemo(
    () =>
      markRequiredDescriptionItems(
        [
          {
            key: 'bodyHtml',
            label: '정책 본문',
            children: (
              <Form.Item
                name="bodyHtml"
                rules={[
                  {
                    validator: async (_, value: string | undefined) => {
                      if (isRichTextEmpty(value)) {
                        throw new Error('정책 본문을 입력하세요.');
                      }
                    }
                  }
                ]}
                style={{ margin: 0 }}
              >
                <TinyMceHtmlEditor
                  editorId={`operation-policy-${policyId ?? 'create'}`}
                  plugins={DEFAULT_TINYMCE_PLUGINS}
                  toolbar={DEFAULT_TINYMCE_TOOLBAR}
                  height={420}
                />
              </Form.Item>
            )
          }
        ],
        ['bodyHtml']
      ),
    [policyId]
  );

  const memoItems = useMemo(
    () => [
      {
        key: 'adminMemo',
        label: '관리자 메모',
        children: (
          <Form.Item name="adminMemo" style={{ margin: 0 }}>
            <Input.TextArea
              rows={6}
              placeholder="검수 포인트, 후속 작업, 법무/운영 참고 메모를 기록하세요."
            />
          </Form.Item>
        )
      }
    ],
    []
  );

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
      state: {
        operationPolicySaved: {
          policyId: result.data.id,
          mode:
            editorMode === 'edit'
              ? 'edit'
              : editorMode === 'version'
                ? 'version'
                : 'create'
        }
      }
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
