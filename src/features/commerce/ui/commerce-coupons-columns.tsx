import { Space, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import type { SortOrder } from "antd/es/table/interface";

import {
  canControlIssueState,
  couponKindFilterOptions,
  couponStatusColumnFilterOptions,
  getStatusFilterValue,
} from "../model/commerce-coupons-page-schema";
import type {
  CouponDangerState,
  CouponSortField,
} from "../model/commerce-coupons-page-schema";
import type { CommerceCouponSubscriptionTemplate } from "../model/coupon-template-types";
import {
  formatCouponTemplateSchedule,
  getCouponTemplateBenefitSummary,
} from "../model/coupon-template-types";
import type { CommerceCoupon, CouponStatusTab } from "../model/coupon-types";
import {
  getCouponBenefitSummary,
  getCouponConditionSummary,
  getCouponIssueSummary,
  getCouponKindDisplayLabel,
  getCouponValiditySummary,
} from "../model/coupon-types";
import { StatusBadge } from "@/shared/ui/status-badge/status-badge";
import { BinaryStatusSwitch } from "@/shared/ui/table/binary-status-switch";
import { createStatusColumnTitle } from "@/shared/ui/table/status-column-title";
import {
  TableActionMenu,
  type TableActionMenuItem,
} from "@/shared/ui/table/table-action-menu";

const { Text } = Typography;

// 쿠폰 목록/정기 템플릿 컬럼 — Phase 4 분해로 페이지 useMemo 본문에서 이동(동작 동일).
// URL 정렬/필터 상태·행 조치 핸들러는 페이지가 소유하고 인자로 받으며,
// 행 액션 메뉴 빌더는 컬럼과 함께 이 팩토리 내부에서 조립한다.
export type CouponColumnsContext = {
  sortField: CouponSortField | null;
  sortOrder: SortOrder | null;
  couponKindFilter: CommerceCoupon["couponKind"] | null;
  statusTab: CouponStatusTab;
  openEditPage: (coupon: CommerceCoupon) => void;
  handleDuplicateCoupon: (coupon: CommerceCoupon) => Promise<void>;
  handleCopyDownloadLink: (coupon: CommerceCoupon) => Promise<void>;
  handleCopyCouponCode: (coupon: CommerceCoupon) => Promise<void>;
  setDangerState: (next: CouponDangerState) => void;
};

export function createCouponColumns({
  sortField,
  sortOrder,
  couponKindFilter,
  statusTab,
  openEditPage,
  handleDuplicateCoupon,
  handleCopyDownloadLink,
  handleCopyCouponCode,
  setDangerState,
}: CouponColumnsContext): TableColumnsType<CommerceCoupon> {
  // 원문 useMemo 제네릭과 동일하게, sorter 식별용 잉여 속성 field 를 허용하기 위한 단언.
  const createActionMenuItems = (coupon: CommerceCoupon): TableActionMenuItem[] => {
    const items: TableActionMenuItem[] = [
      {
        key: "edit",
        label: "수정",
        onClick: () => openEditPage(coupon),
      },
      {
        key: "duplicate",
        label: "복제",
        onClick: () => {
          void handleDuplicateCoupon(coupon);
        },
      },
    ];

    if (coupon.downloadUrl) {
      items.push({
        key: "copy-download-link",
        label: "다운로드 링크 복사",
        onClick: () => {
          void handleCopyDownloadLink(coupon);
        },
      });
    }

    if (coupon.couponCode) {
      items.push({
        key: "copy-code",
        label: "코드 복사",
        onClick: () => {
          void handleCopyCouponCode(coupon);
        },
      });
    }

    items.push({
      key: "delete-coupon",
      danger: true,
      label: "삭제",
      onClick: () =>
        setDangerState({ entity: "coupon", type: "delete", coupon }),
    });

    return items;
  };

  return [
    {
      title: "쿠폰명",
      dataIndex: "couponName",
      width: 240,
      sorter: true,
      sortOrder: sortField === "couponName" ? sortOrder : null,
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.id}</Text>
        </Space>
      ),
    },
    {
      title: "형식",
      dataIndex: "couponKind",
      field: "couponKind",
      width: 132,
      filters: [...couponKindFilterOptions],
      filteredValue: couponKindFilter ? [couponKindFilter] : null,
      sorter: true,
      sortOrder: sortField === "couponKind" ? sortOrder : null,
      render: (_, record) => (
        <Tag color="blue">{getCouponKindDisplayLabel(record)}</Tag>
      ),
    },
    {
      title: "발행 정보",
      key: "issueSummary",
      width: 188,
      render: (_, record) => <Text>{getCouponIssueSummary(record)}</Text>,
    },
    {
      title: "혜택 / 사용 조건",
      key: "benefitConditionSummary",
      width: 280,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text>{getCouponBenefitSummary(record)}</Text>
          <Text type="secondary">{getCouponConditionSummary(record)}</Text>
        </Space>
      ),
    },
    {
      title: "유효 기간",
      dataIndex: "validitySummary",
      field: "validity",
      width: 172,
      sorter: true,
      sortOrder: sortField === "validity" ? sortOrder : null,
      render: (_, record) => getCouponValiditySummary(record),
    },
    {
      title: createStatusColumnTitle("상태", ["대기", "진행 중", "종료"]),
      dataIndex: "couponStatus",
      field: "couponStatus",
      width: 124,
      filters: [...couponStatusColumnFilterOptions],
      filteredValue: getStatusFilterValue(statusTab)
        ? [getStatusFilterValue(statusTab) as string]
        : null,
      sorter: true,
      sortOrder: sortField === "couponStatus" ? sortOrder : null,
      render: (value: CommerceCoupon["couponStatus"]) => (
        <StatusBadge status={value} />
      ),
    },
    {
      title: "발행 상태",
      key: "issueState",
      width: 132,
      onCell: () => ({
        onClick: (event) => event.stopPropagation(),
      }),
      render: (_, record) =>
        canControlIssueState(record) ? (
          <BinaryStatusSwitch
            checked={record.issueState !== "발행 중지"}
            checkedLabel="발행"
            uncheckedLabel="발행 중지"
            onToggle={() =>
              setDangerState({
                entity: "coupon",
                type: record.issueState === "발행 중지" ? "resume" : "pause",
                coupon: record,
              })
            }
          />
        ) : (
          <Text type="secondary">해당 없음</Text>
        ),
    },
    {
      title: "발급 / 사용",
      dataIndex: "issueCount",
      field: "issueCount",
      width: 132,
      sorter: true,
      sortOrder: sortField === "issueCount" ? sortOrder : null,
      render: (_, record) =>
        `${record.issueCount.toLocaleString()} / ${record.useCount.toLocaleString()}`,
    },
    {
      title: "액션",
      key: "actions",
      width: 96,
      onCell: () => ({
        onClick: (event) => event.stopPropagation(),
      }),
      render: (_, record) => (
        <TableActionMenu
          buttonLabel="더보기"
          items={createActionMenuItems(record)}
        />
      ),
    },
  ] as TableColumnsType<CommerceCoupon>;
}

export type CouponTemplateColumnsContext = {
  openTemplateEditPage: (template: CommerceCouponSubscriptionTemplate) => void;
  setDangerState: (next: CouponDangerState) => void;
};

export function createCouponTemplateColumns({
  openTemplateEditPage,
  setDangerState,
}: CouponTemplateColumnsContext): TableColumnsType<CommerceCouponSubscriptionTemplate> {
  const createTemplateActionMenuItems = (
    template: CommerceCouponSubscriptionTemplate,
  ): TableActionMenuItem[] => [
    {
      key: "edit",
      label: "수정",
      onClick: () => openTemplateEditPage(template),
    },
    {
      key:
        template.status === "발행 중지"
          ? "resume-template"
          : "pause-template",
      label: template.status === "발행 중지" ? "발행 재개" : "발행 중지",
      onClick: () =>
        setDangerState({
          entity: "template",
          type: template.status === "발행 중지" ? "resume" : "pause",
          template,
        }),
    },
    {
      key: "delete-template",
      label: "삭제",
      danger: true,
      onClick: () =>
        setDangerState({
          entity: "template",
          type: "delete",
          template,
        }),
    },
  ];

  return [
    {
      title: "템플릿명 / 혜택",
      dataIndex: "templateName",
      key: "templateName",
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.templateName}</Text>
          <Text type="secondary">
            {getCouponTemplateBenefitSummary(record)}
          </Text>
        </Space>
      ),
    },
    {
      title: "상태",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: CommerceCouponSubscriptionTemplate["status"]) => (
        <StatusBadge status={value} />
      ),
    },
    {
      title: "쿠폰 사용 종료일",
      key: "usageEndSchedule",
      width: 180,
      render: (_, record) =>
        formatCouponTemplateSchedule(record.usageEndSchedule),
    },
    { title: "등록일", dataIndex: "createdAt", key: "createdAt", width: 160 },
    {
      title: "수정일",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Text>{value}</Text>
          <Text type="secondary">{record.updatedBy}</Text>
        </Space>
      ),
    },
    {
      title: "액션",
      key: "actions",
      width: 96,
      onCell: () => ({
        onClick: (event) => event.stopPropagation(),
      }),
      render: (_, record) => (
        <TableActionMenu
          buttonLabel="더보기"
          items={createTemplateActionMenuItems(record)}
        />
      ),
    },
  ];
}
