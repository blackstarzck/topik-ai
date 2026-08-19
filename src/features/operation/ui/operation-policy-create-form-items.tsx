import { DatePicker, Form, Input, Radio, Select } from 'antd';
import type { DescriptionsProps } from 'antd';

import type {
  OperationPolicy,
  OperationPolicyCategory,
  OperationPolicyTrackingStatus,
  OperationPolicyType
} from '../model/policy-types';
import { isRichTextEmpty } from '../model/operation-policy-create-page-schema';
import {
  createDescriptionLabel,
  markRequiredDescriptionItems
} from '@/shared/ui/descriptions/description-label';
import {
  DEFAULT_TINYMCE_PLUGINS,
  DEFAULT_TINYMCE_TOOLBAR,
  TinyMceHtmlEditor
} from '@/shared/ui/html-editor/tiny-mce-html-editor';

// 정책 등록 단계별 Descriptions 아이템 팩토리 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// Form.Item 은 상위 <Form> 컨텍스트로 동작하므로 폼 인스턴스는 받지 않고,
// 선택 옵션과 편집 대상 식별자만 인자로 받는다.

type PolicySelectOption<Value extends string> = { label: Value; value: Value };

export type PolicyBasicItemsOptions = {
  categoryOptions: Array<PolicySelectOption<OperationPolicyCategory>>;
  policyTypeOptions: Array<PolicySelectOption<OperationPolicyType>>;
};

export function createPolicyBasicItems({
  categoryOptions,
  policyTypeOptions
}: PolicyBasicItemsOptions): DescriptionsProps['items'] {
  return markRequiredDescriptionItems(
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
  );
}

export type PolicyExposureItemsOptions = {
  exposureSurfaceOptions: Array<
    PolicySelectOption<OperationPolicy['exposureSurfaces'][number]>
  >;
};

export function createPolicyExposureItems({
  exposureSurfaceOptions
}: PolicyExposureItemsOptions): DescriptionsProps['items'] {
  return markRequiredDescriptionItems(
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
  );
}

export type PolicyTrackingItemsOptions = {
  trackingStatusOptions: Array<PolicySelectOption<OperationPolicyTrackingStatus>>;
  relatedAdminPageOptions: Array<
    PolicySelectOption<OperationPolicy['relatedAdminPages'][number]>
  >;
  relatedUserPageOptions: Array<
    PolicySelectOption<OperationPolicy['relatedUserPages'][number]>
  >;
};

export function createPolicyTrackingItems({
  trackingStatusOptions,
  relatedAdminPageOptions,
  relatedUserPageOptions
}: PolicyTrackingItemsOptions): DescriptionsProps['items'] {
  return [
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
  ];
}

export function createPolicyLegalItems(): DescriptionsProps['items'] {
  return markRequiredDescriptionItems(
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
  );
}

export type PolicyBodyItemsOptions = {
  policyId: string | undefined;
};

export function createPolicyBodyItems({
  policyId
}: PolicyBodyItemsOptions): DescriptionsProps['items'] {
  return markRequiredDescriptionItems(
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
  );
}

export function createPolicyMemoItems(): DescriptionsProps['items'] {
  return [
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
  ];
}
