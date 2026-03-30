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
  내용?쎄?: {
    description: '?쒕퉬??내용 議곌굔怨?怨꾩젙 운영 湲곗???怨좎젙?섎뒗 湲곕낯 ?쎄??낅땲??',
    category: '踰뺣쪧/?쎄?',
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('내용?쎄?'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('내용?쎄?')
  },
  '媛쒖씤?뺣낫 泥섎━諛⑹묠': {
    description: '?섏쭛 ??ぉ, 泥섎━ 紐⑹쟻, 蹂닿? 湲곌컙, ?뚭린 ?덉감瑜?怨좎??섎뒗 踰뺤쟻 臾몄꽌?낅땲??',
    category: '踰뺣쪧/?쎄?',
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('媛쒖씤?뺣낫 泥섎━諛⑹묠'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('媛쒖씤?뺣낫 泥섎━諛⑹묠')
  },
  '결제?랁솚遺??뺤콉': {
    description: '결제 ?뱀씤, 환불 媛??議곌굔, 遺遺?환불 ?쒗븳???④퍡 ?ㅻ（???뺤콉?낅땲??',
    category: '결제/由ъ썙??,
    trackingStatus: '臾몄꽌 異붿쟻',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('결제?랁솚遺??뺤콉'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('결제?랁솚遺??뺤콉')
  },
  '泥?냼??蹂댄샇?뺤콉': {
    description: '泥?냼???좏빐 ?뺣낫 李⑤떒, 신고 泥섎━, 蹂댄샇 梨낆엫???덈궡 湲곗????댁뒿?덈떎.',
    category: '커뮤니티/?덉쟾',
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('泥?냼??蹂댄샇?뺤콉'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('泥?냼??蹂댄샇?뺤콉')
  },
  '커뮤니티 게시글 ?쒖옱 ?뺤콉': {
    description: '게시글 숨김/??젣 ???곕뒗 ?뺤콉 肄붾뱶? ?대? 硫붾え 湲곗???愿由ы빀?덈떎.',
    category: '커뮤니티/?덉쟾',
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('커뮤니티 게시글 ?쒖옱 ?뺤콉'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('커뮤니티 게시글 ?쒖옱 ?뺤콉')
  },
  '異붿쿇??蹂댁긽 ?뺤콉': {
    description: '異붿쿇 ?뺤젙 ?쒖젏, 蹂댁긽 ?섎떒, ?뚯닔 洹쒖튃, ?섎룞 蹂댁젙 沅뚰븳??異붿쟻?⑸땲??',
    category: '결제/由ъ썙??,
    trackingStatus: '臾몄꽌 異붿쟻',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('異붿쿇??蹂댁긽 ?뺤콉'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('異붿쿇??蹂댁긽 ?뺤콉')
  },
  '?ъ씤??운영?뺤콉': {
    description: '?곷┰ ?먯쿇, 李④컧 ?곗꽑?쒖쐞, ?뚮㈇/蹂대쪟 洹쒖튃??異붿쟻?섎뒗 운영 ?뺤콉?낅땲??',
    category: '결제/由ъ썙??,
    trackingStatus: '臾몄꽌 異붿쟻',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('?ъ씤??운영?뺤콉'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('?ъ씤??운영?뺤콉')
  },
  '荑좏룿 운영?뺤콉': {
    description: '荑좏룿 ?좏삎蹂?운영 洹쒖튃怨??먮룞 諛쒗뻾/??젣/?몄텧 湲곗???臾띕뒗 ?뺤콉?낅땲??',
    category: '결제/由ъ썙??,
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('荑좏룿 운영?뺤콉'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('荑좏룿 운영?뺤콉')
  },
  '?대깽??운영?뺤콉': {
    description: '?대깽???몄텧, 李몄뿬 議곌굔, 蹂댁긽 ?곌껐, 醫낅즺 泥섎━ 湲곗???愿由ы빀?덈떎.',
    category: '운영/콘텐츠,
    trackingStatus: '臾몄꽌 異붿쟻',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('?대깽??운영?뺤콉'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('?대깽??운영?뺤콉')
  },
  'FAQ ?몄텧 ?뺤콉': {
    description: 'FAQ 怨듦컻 상태? ??결제/?⑤낫???몄텧 ?먮젅?댁뀡 湲곗????뺣━?⑸땲??',
    category: '운영/콘텐츠,
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('FAQ ?몄텧 ?뺤콉'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('FAQ ?몄텧 ?뺤콉')
  },
  '梨쀫큸 ?곷떞 ?꾪솚 ?뺤콉': {
    description: '梨쀫큸 fallback, ?곷떞 ?멸퀎, FAQ 李몄“ 洹쒖튃??placeholder ?④퀎?먯꽌 異붿쟻?⑸땲??',
    category: '운영/콘텐츠,
    trackingStatus: '?뺤콉 誘명솗??,
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('梨쀫큸 ?곷떞 ?꾪솚 ?뺤콉'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('梨쀫큸 ?곷떞 ?꾪솚 ?뺤콉')
  },
  '硫붿씪 발송 운영?뺤콉': {
    description: '硫붿씪 ?쒗뵆由??깅줉, 蹂몃Ц ?묒꽦, 즉시/예약 발송??운영 湲곗???愿由ы빀?덈떎.',
    category: '硫붿떆吏/알림',
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('硫붿씪 발송 운영?뺤콉'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('硫붿씪 발송 운영?뺤콉')
  },
  '?몄떆 발송 운영?뺤콉': {
    description: '?몄떆 ?쒗뵆由??깅줉, 蹂몃Ц ?묒꽦, 즉시/예약 발송??운영 湲곗???愿由ы빀?덈떎.',
    category: '硫붿떆吏/알림',
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('?몄떆 발송 운영?뺤콉'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('?몄떆 발송 운영?뺤콉')
  },
  '발송 실패/?ъ떆???뺤콉': {
    description: '실패 嫄??ъ떆??踰붿쐞, 以묐났 발송 諛⑹?, 蹂댁〈 湲곌컙??異붿쟻?⑸땲??',
    category: '硫붿떆吏/알림',
    trackingStatus: '?뺤콉 誘명솗??,
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('발송 실패/?ъ떆???뺤콉'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('발송 실패/?ъ떆???뺤콉')
  },
  '愿由ъ옄 沅뚰븳 蹂寃??뺤콉': {
    description: '권한 부여?섏젙/?뚯닔 ???뱀씤怨?媛먯궗 異붿쟻 湲곗????ㅻ（???대? ?뺤콉?낅땲??',
    category: '愿由ъ옄/蹂댁븞',
    trackingStatus: '臾몄꽌 異붿쟻',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('愿由ъ옄 沅뚰븳 蹂寃??뺤콉'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('愿由ъ옄 沅뚰븳 蹂寃??뺤콉')
  },
  '留덉????뺣낫 ?섏떊 ?숈쓽': {
    description: '硫붿씪/?몄떆 ?섏떊 ?숈쓽? 泥좏쉶 湲곗???怨좎??섎뒗 사용자?숈쓽 臾몄꽌?낅땲??',
    category: '硫붿떆吏/알림',
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('留덉????뺣낫 ?섏떊 ?숈쓽'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('留덉????뺣낫 ?섏떊 ?숈쓽')
  }
};

const policyCreateStepItems: Array<{
  key: PolicyCreateSectionKey;
  title: string;
  description: string;
}> = [
  { key: 'basic', title: '湲곕낯 ?뺣낫', description: '운영 ?곸뿭, ?뺤콉 ?좏삎, 臾몄꽌紐? },
  { key: 'exposure', title: '?몄텧 諛??숈쓽', description: '?쒗뻾?? ?몄텧 ?꾩튂, ?숈쓽 ?щ?' },
  { key: 'tracking', title: '異붿쟻 洹쇨굅', description: '?뺤콉 異붿쟻 상태, ?곌? ?붾㈃, 洹쇨굅 臾몄꽌' },
  { key: 'legal', title: '踰뺣졊 諛??붿빟', description: '?뺤콉 ?붿빟, 踰뺣졊/洹쇨굅' },
  { key: 'body', title: '?뺤콉 蹂몃Ц', description: 'TinyMCE 蹂몃Ц ?묒꽦' },
  { key: 'memo', title: '관리자 메모', description: '운영 寃??硫붾え' }
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
            label: '운영 ?곸뿭',
            children: (
              <Form.Item
                name="category"
                rules={[{ required: true, message: '운영 ?곸뿭???좏깮?섏꽭??' }]}
                style={{ margin: 0 }}
              >
                <Select options={categoryOptions} placeholder="운영 ?곸뿭 ?좏깮" />
              </Form.Item>
            )
          },
          {
            key: 'policyType',
            label: '?뺤콉 ?좏삎',
            children: (
              <Form.Item
                name="policyType"
                rules={[{ required: true, message: '?뺤콉 ?좏삎???좏깮?섏꽭??' }]}
                style={{ margin: 0 }}
              >
                <Select options={policyTypeOptions} placeholder="?뺤콉 ?좏삎 ?좏깮" />
              </Form.Item>
            )
          },
          {
            key: 'title',
            label: '臾몄꽌紐?,
            children: (
              <Form.Item
                name="title"
                rules={[{ required: true, message: '臾몄꽌紐낆쓣 ?낅젰?섏꽭??' }]}
                style={{ margin: 0 }}
              >
                <Input placeholder="臾몄꽌紐낆쓣 ?낅젰?섏꽭??" />
              </Form.Item>
            )
          },
          {
            key: 'versionLabel',
            label: '踰꾩쟾',
            children: (
              <Form.Item
                name="versionLabel"
                rules={[{ required: true, message: '踰꾩쟾???낅젰?섏꽭??' }]}
                style={{ margin: 0 }}
              >
                <Input placeholder="?? v2026.03" />
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
            label: '?쒗뻾??,
            children: (
              <Form.Item
                name="effectiveDate"
                rules={[{ required: true, message: '?쒗뻾?쇱쓣 ?좏깮?섏꽭??' }]}
                style={{ margin: 0 }}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            )
          },
          {
            key: 'exposureSurfaces',
            label: '?몄텧 ?꾩튂',
            children: (
              <Form.Item
                name="exposureSurfaces"
                rules={[
                  {
                    required: true,
                    type: 'array',
                    min: 1,
                    message: '?몄텧 ?꾩튂瑜??좏깮?섏꽭??'
                  }
                ]}
                style={{ margin: 0 }}
              >
                <Select
                  mode="multiple"
                  options={exposureSurfaceOptions}
                  placeholder="?몄텧 ?꾩튂 ?좏깮"
                />
              </Form.Item>
            )
          },
          {
            key: 'requiresConsent',
            label: '?숈쓽 ?꾩슂 ?щ?',
            children: (
              <Form.Item name="requiresConsent" style={{ margin: 0 }}>
                <Radio.Group
                  className="coupon-choice-radio-group"
                  options={[
                    { label: '怨좎???臾몄꽌', value: false },
                    { label: '?숈쓽 ?꾩슂 臾몄꽌', value: true }
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
        label: createDescriptionLabel('?뺤콉 異붿쟻 상태', {
          required: true,
          tooltip:
            '???뺤콉???ㅼ젣 肄붾뱶??諛섏쁺?먮뒗吏, 臾몄꽌 ?④퀎?몄?, ?꾩쭅 ?뺤콉 誘명솗??상태?몄? ?쒖떆?⑸땲??'
        }),
        children: (
          <Form.Item
            name="trackingStatus"
            rules={[{ required: true, message: '?뺤콉 異붿쟻 상태瑜??좏깮?섏꽭??' }]}
            style={{ margin: 0 }}
          >
            <Select options={trackingStatusOptions} placeholder="?뺤콉 異붿쟻 상태 ?좏깮" />
          </Form.Item>
        )
      },
      {
        key: 'relatedAdminPages',
        label: createDescriptionLabel('?곌? 愿由ъ옄 ?붾㈃', {
          tooltip: '???뺤콉??寃?섑븷 ???④퍡 ?뺤씤?댁빞 ?섎뒗 愿由ъ옄 ?붾㈃?낅땲??'
        }),
        children: (
          <Form.Item name="relatedAdminPages" style={{ margin: 0 }}>
            <Select
              mode="multiple"
              options={relatedAdminPageOptions}
              optionFilterProp="label"
              placeholder="?곌? 愿由ъ옄 ?붾㈃ ?좏깮"
            />
          </Form.Item>
        )
      },
      {
        key: 'relatedUserPages',
        label: createDescriptionLabel('?곌? 사용자?붾㈃', {
          tooltip:
            '?꾩옱??운영??異붿젙媛믪엯?덈떎. ?ㅼ젣 B2C ?몄텧 ?꾩튂媛 ?뺤젙?섎㈃ ?뺤씤?⑥쑝濡??밴꺽??愿由ы빀?덈떎.'
        }),
        children: (
          <Form.Item name="relatedUserPages" style={{ margin: 0 }}>
            <Select
              mode="multiple"
              options={relatedUserPageOptions}
              optionFilterProp="label"
              placeholder="?곌? 사용자?붾㈃ ?좏깮"
            />
          </Form.Item>
        )
      },
      {
        key: 'sourceDocumentsText',
        label: createDescriptionLabel('洹쇨굅 臾몄꽌', {
          tooltip:
            '愿??IA, 肄붾뱶 ?뚯씪, 운영 臾몄꽌 寃쎈줈瑜??④꺼 ?뺤콉 洹쇨굅瑜???텛?곹븷 ???덇쾶 ?⑸땲??'
        }),
        children: (
          <Form.Item name="sourceDocumentsText" style={{ margin: 0 }}>
            <Input.TextArea
              rows={4}
              placeholder="??以꾩뿉 ?섎굹???낅젰?섏꽭?? ?? docs/specs/page-ia/operation-policies-page-ia.md"
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
            label: '?뺤콉 ?붿빟',
            children: (
              <Form.Item
                name="summary"
                rules={[{ required: true, message: '?뺤콉 ?붿빟???낅젰?섏꽭??' }]}
                style={{ margin: 0 }}
              >
                <Input.TextArea
                  rows={4}
                  placeholder="운영?먭? 癒쇱? ?뺤씤?댁빞 ???듭떖 ?붿빟???낅젰?섏꽭??"
                />
              </Form.Item>
            )
          },
          {
            key: 'legalReferencesText',
            label: '踰뺣졊/洹쇨굅',
            children: (
              <Form.Item name="legalReferencesText" style={{ margin: 0 }}>
                <Input.TextArea
                  rows={4}
                  placeholder="??以꾩뿉 ?섎굹???낅젰?섏꽭?? ?? 媛쒖씤?뺣낫 蹂댄샇踰?
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
            label: '?뺤콉 蹂몃Ц',
            children: (
              <Form.Item
                name="bodyHtml"
                rules={[
                  {
                    validator: async (_, value: string | undefined) => {
                      if (isRichTextEmpty(value)) {
                        throw new Error('?뺤콉 蹂몃Ц???낅젰?섏꽭??');
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
              placeholder="寃???ъ씤?? ?꾩냽 ?묒뾽, 踰뺣Т/운영 李멸퀬 硫붾え瑜?湲곕줉?섏꽭??"
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
      ? '?뺤콉 내용 ?섏젙 상세'
      : editorMode === 'version'
        ? '?뺤콉 ??踰꾩쟾 ?깅줉 상세'
        : '?뺤콉 ?깅줉 상세';
  const loadErrorMessage =
    editorMode === 'edit'
      ? '?뺤콉 내용 ?섏젙 ??곸쓣 遺덈윭?ㅼ? 紐삵뻽?듬땲??'
      : '??踰꾩쟾 ?깅줉 湲곗? ?뺤콉??遺덈윭?ㅼ? 紐삵뻽?듬땲??';

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
              <span>{policyState.errorMessage ?? '?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'}</span>
              {policyState.errorCode ? <span>?ㅻ쪟 肄붾뱶: {policyState.errorCode}</span> : null}
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

      {editorMode === 'version' && hasCachedPolicy ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="?꾩옱 ?뺤콉 내용??蹂듭궗????踰꾩쟾 珥덉븞???묒꽦?⑸땲??"
          description="踰꾩쟾怨??쒗뻾?쇱? ??媛믪쑝濡??ㅼ떆 ?낅젰?댁빞 ?섎ŉ, 대상????踰꾩쟾? 숨김 상태濡?紐⑸줉??異붽??⑸땲??"
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
              <Button
                type="primary"
                size="large"
                loading={isSubmitting}
                disabled={isSaveDisabled}
                onClick={() => {
                  void handleSubmit();
                }}
              >
                대상              </Button>
            </Space>
          </div>
        }
      >
        {isLoadingInitialPolicy ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="?뺤콉 ?뺣낫瑜?遺덈윭?ㅻ뒗 以묒엯?덈떎."
            description="??λ맂 ?뺤콉 硫뷀?? 蹂몃Ц???뺤씤?????섏젙 ?붾㈃???댁뼱???쒖떆?⑸땲??"
          />
        ) : null}

        {isEdit && policyState.status === 'pending' && hasCachedPolicy ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="理쒖떊 ?뺤콉 ?뺣낫瑜??ㅼ떆 遺덈윭?ㅻ뒗 以묒엯?덈떎."
            description="留덉?留됱쑝濡??뺤씤???곗씠?곕? ?좎???梨?상세 ?뺣낫瑜?媛깆떊?⑸땲??"
          />
        ) : null}

        {submitState.status === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="?뺤콉 ??μ뿉 실패?덉뒿?덈떎."
            description={
              <Space direction="vertical">
                <span>{submitState.errorMessage ?? '?낅젰媛믪쓣 ?ㅼ떆 ?뺤씤?섏꽭??'}</span>
                {submitState.errorCode ? <span>?ㅻ쪟 肄붾뱶: {submitState.errorCode}</span> : null}
              </Space>
            }
          />
        ) : null}

        {!isEdit || hasCachedPolicy ? (
          <Form form={form} layout="vertical">
            <AdminEditorForm
              stepAriaLabel="?뺤콉 ?깅줉 ?④퀎"
              currentStep={currentStep}
              items={stepItems}
              onStepChange={handleStepChange}
            >
              {currentSectionKey === 'basic' ? (
                <AdminEditorFormSection
                  title="湲곕낯 ?뺣낫"
                  description="운영 ?곸뿭, ?뺤콉 ?좏삎, 臾몄꽌紐낆쓣 癒쇱? 怨좎젙?⑸땲??"
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
                            沅뚯옣 운영 ?곸뿭: {selectedPolicyPreset.category} / 異붿쟻 상태:{' '}
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
                  title="?몄텧 諛??숈쓽"
                  description="?쒗뻾?? ?몄텧 ?꾩튂, ?숈쓽 ?꾩슂 ?щ?瑜??뺤젙?⑸땲??"
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
                  title="異붿쟻 洹쇨굅"
                  description="?뺤콉 異붿쟻 상태? ?곌? ?붾㈃, 洹쇨굅 臾몄꽌瑜??④퍡 ?④퉩?덈떎."
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
                  title="踰뺣졊 諛??붿빟"
                  description="운영 ?붿빟怨?踰뺣졊 洹쇨굅瑜?癒쇱? ?뺣━?⑸땲??"
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
                  title="?뺤콉 蹂몃Ц"
                  description="TinyMCE濡?사용자?몄텧 蹂몃Ц???묒꽦?⑸땲??"
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
                  description="?꾩냽 寃??硫붾え? 운영 李멸퀬 ?ы빆??湲곕줉?⑸땲??"
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


