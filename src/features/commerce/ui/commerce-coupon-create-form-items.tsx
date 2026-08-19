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

import {
  getCouponAutoIssueTriggerOptions,
  getCouponBenefitTypeOptions,
  getCouponCodeGenerationOptions,
  getCouponIssueTargetOptions,
} from "../model/coupon-form-schema";
import type { CouponKind, CouponValidityMode } from "../model/coupon-types";
import type {
  buildCouponBenefitFieldMeta,
  CouponFormValues,
} from "../model/commerce-coupon-create-page-schema";
import { markRequiredDescriptionItems } from "../../../shared/ui/descriptions/description-label";

const { Text } = Typography;

// 쿠폰 등록 단계별 Descriptions 아이템 팩토리 — Phase 4 분해로 페이지 본문에서 이동
// (동작 동일). Form.Item 은 상위 <Form> 컨텍스트로 동작하므로 폼 인스턴스는 받지 않고,
// 워치 값과 선택 옵션만 인자로 받는다(5호 policy-create 패턴).

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

export function createCouponBasicItems({
  activeCouponKind,
  groupOptions,
  selectedCodeGenerationMode,
  selectedIssueLimitMode,
  selectedIssueTargetType,
}: {
  activeCouponKind: CouponKind;
  groupOptions: Array<{ label: string; value: string }>;
  selectedCodeGenerationMode: CouponFormValues["codeGenerationMode"] | undefined;
  selectedIssueLimitMode: CouponFormValues["issueLimitMode"] | undefined;
  selectedIssueTargetType: CouponFormValues["issueTargetType"] | undefined;
}) {
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

}

export function createCouponBenefitItems({
  benefitFieldMeta,
  selectedBenefitType,
}: {
  benefitFieldMeta: ReturnType<typeof buildCouponBenefitFieldMeta>;
  selectedBenefitType: CouponFormValues["benefitType"] | undefined;
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
                        // antd 가 넘기는 값은 number | undefined 라 빈 문자열 비교는
                        // 도달할 수 없다(남기면 number 와 string 대조가 된다).
                        value === undefined || value === null
                          ? ""
                          : `${value}%`
                    : undefined
                }
                parser={
                  selectedBenefitType === "rateDiscount"
                    ? // antd 타입은 number 반환을 요구하지만 rc-input-number 는 숫자
                      // 문자열도 그대로 파싱한다(공식 예제도 문자열을 돌려준다).
                      // 빈 입력에서 Number("") = 0 이 되어 0 이 찍히는 동작 변경을
                      // 피하려고 런타임 표현식은 유지하고 타입만 맞춘다.
                      ((value: string | undefined) => value?.replaceAll("%", "") ?? "") as unknown as (
                        displayValue: string | undefined,
                      ) => number
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
  );
}

export function createCouponOperationItems({
  activeCouponKind,
  selectedUsageLimitMode,
  selectedValidityMode,
  validityModeOptions,
}: {
  activeCouponKind: CouponKind;
  selectedUsageLimitMode: CouponFormValues["usageLimitMode"] | undefined;
  selectedValidityMode: CouponValidityMode | undefined;
  validityModeOptions: Array<{ label: string; value: string }>;
}) {
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

}

export function createCouponAlertItems({
  activeCouponKind,
  selectedExpireAlertEnabled,
  selectedIssueAlertEnabled,
  templateOptions,
}: {
  activeCouponKind: CouponKind;
  selectedExpireAlertEnabled: boolean | undefined;
  selectedIssueAlertEnabled: boolean | undefined;
  templateOptions: Array<{ label: string; value: string }>;
}) {
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

}

export function createCouponMemoItems() {
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
