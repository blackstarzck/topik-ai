import {
  DatePicker,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Typography,
} from "antd";

import type { Dayjs } from 'dayjs';

import {
  couponTemplateReadOnlyFieldStyle,
  monthlyUsageEndDateReference,
  toMonthlyUsageEndDate,
  type CouponTemplateFormValues,
} from "../model/commerce-coupon-template-create-page-schema";
import { markRequiredDescriptionItems } from "@/shared/ui/descriptions/description-label";

const { Text } = Typography;

// 정기 쿠폰 템플릿 단계별 Descriptions 아이템 팩토리 — Phase 4 분해로 이동(동작 동일).
// Form.Item 은 상위 <Form> 컨텍스트로 동작하므로 폼 인스턴스는 받지 않고,
// 워치 값·옵션·파생 카피만 인자로 받는다(5호·15호 패턴).

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

export function createCouponTemplateBasicItems({
  gradeOptions,
}: {
  gradeOptions: Array<{ label: string; value: string }>;
}) {
  return markRequiredDescriptionItems(
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
  );
}

export function createCouponTemplateBenefitItems({
  benefitTypeOptions,
  benefitFieldMeta,
  categoryOptions,
  productOptions,
  scopeOptions,
  selectedApplicableScope,
  selectedBenefitType,
  selectedExcludedProductMode,
}: {
  benefitTypeOptions: Array<{ label: string; value: string }>;
  benefitFieldMeta: {
    valueLabel: string;
    valuePlaceholder: string;
    valueRequiredMessage: string;
    max: number | undefined;
  };
  categoryOptions: Array<{ label: string; value: string }>;
  productOptions: Array<{ label: string; value: string }>;
  scopeOptions: Array<{ label: string; value: string }>;
  selectedApplicableScope: CouponTemplateFormValues["applicableScope"] | undefined;
  selectedBenefitType: CouponTemplateFormValues["benefitType"] | undefined;
  selectedExcludedProductMode: CouponTemplateFormValues["excludedProductMode"] | undefined;
}) {
  return markRequiredDescriptionItems(
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
  );
}

export function createCouponTemplateOperationItems({
  usageEndDescription,
}: {
  usageEndDescription: string;
}) {
  return markRequiredDescriptionItems(
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
  );
}

export function createCouponTemplateAlertItems({
  alertChannelOptions,
  selectedExpireAlertEnabled,
  selectedIssueAlertEnabled,
}: {
  alertChannelOptions: Array<{ label: string; value: string }>;
  selectedExpireAlertEnabled: boolean | undefined;
  selectedIssueAlertEnabled: boolean | undefined;
}) {
  return [
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
];
}

export function createCouponTemplateMemoItems() {
  return [
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
];
}
