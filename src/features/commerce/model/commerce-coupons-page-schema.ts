import type { TabsProps } from "antd";
import type { SortOrder } from "antd/es/table/interface";

import type { CommerceCouponSubscriptionTemplate } from "./coupon-template-types";
import type { CommerceCoupon, CouponMainView, CouponStatusTab } from "./coupon-types";
import { getCouponKindDisplayLabel } from "./coupon-types";
import { matchesSearchField } from "@/shared/ui/search-bar/search-bar-utils";

// 쿠폰 목록 페이지 스키마 — Phase 4 분해로 페이지 모듈 상단에서 이동(동작 동일).
// 검색/정렬/위험 조치 타입·URL 파서·탭 매칭·목록 필터/정렬·요약 카운트를 담는다.

export type CouponSearchField = "couponName";
export type CouponSortField =
  | "couponName"
  | "couponKind"
  | "validity"
  | "couponStatus"
  | "issueCount";
export type CouponTemplateStatusTab = "all" | "active" | "paused";
export type CouponDangerState =
  | {
      entity: "coupon";
      type: "pause" | "resume" | "delete";
      coupon: CommerceCoupon;
    }
  | {
      entity: "template";
      type: "pause" | "resume" | "delete";
      template: CommerceCouponSubscriptionTemplate;
    }
  | null;

export const couponKindFilterOptions = [
  { text: "고객 다운로드", value: "customerDownload" },
  { text: "자동 발행", value: "autoIssue" },
  { text: "쿠폰 코드", value: "couponCode" },
  { text: "지정 발행", value: "manualIssue" },
] as const;

export const couponStatusColumnFilterOptions = [
  { text: "대기", value: "대기" },
  { text: "진행 중", value: "진행 중" },
  { text: "종료", value: "종료" },
] as const;

export function parseMainView(value: string | null): CouponMainView {
  return value === "subscriptionTemplate" ? "subscriptionTemplate" : "list";
}

export function parseStatusTab(value: string | null): CouponStatusTab {
  if (value === "waiting" || value === "active" || value === "ended") {
    return value;
  }

  return "all";
}

export function parseTemplateStatusTab(value: string | null): CouponTemplateStatusTab {
  if (value === "active" || value === "paused") {
    return value;
  }

  return "all";
}

export function parseSortField(value: string | null): CouponSortField | null {
  if (
    value === "couponName" ||
    value === "couponKind" ||
    value === "validity" ||
    value === "couponStatus" ||
    value === "issueCount"
  ) {
    return value;
  }

  return null;
}

export function parseCouponKindFilter(
  value: string | null,
): CommerceCoupon["couponKind"] | null {
  if (
    value === "customerDownload" ||
    value === "autoIssue" ||
    value === "couponCode" ||
    value === "manualIssue"
  ) {
    return value;
  }

  return null;
}

export function parseStatusFilterValue(value: string): CouponStatusTab | null {
  if (value === "대기") {
    return "waiting";
  }

  if (value === "진행 중") {
    return "active";
  }

  if (value === "종료") {
    return "ended";
  }

  return null;
}

export function getStatusFilterValue(statusTab: CouponStatusTab): string | null {
  if (statusTab === "waiting") {
    return "대기";
  }

  if (statusTab === "active") {
    return "진행 중";
  }

  if (statusTab === "ended") {
    return "종료";
  }

  return null;
}

export function compareCouponText(left: string, right: string): number {
  return left.localeCompare(right, "ko-KR", {
    numeric: true,
    sensitivity: "base",
  });
}

export function getCouponValiditySortValue(coupon: CommerceCoupon): string {
  if (coupon.validityMode === "fixedDate") {
    return `${coupon.validFrom ?? ""}-${coupon.validUntil ?? ""}`;
  }

  return `${coupon.expireAfterDays ?? 0}`;
}

export function matchesCouponStatusTab(
  coupon: CommerceCoupon,
  statusTab: CouponStatusTab,
): boolean {
  if (statusTab === "all") {
    return true;
  }

  if (statusTab === "waiting") {
    return coupon.couponStatus === "대기";
  }

  if (statusTab === "active") {
    return coupon.couponStatus === "진행 중";
  }

  return coupon.couponStatus === "종료";
}

export function matchesCouponTemplateStatusTab(
  template: CommerceCouponSubscriptionTemplate,
  statusTab: CouponTemplateStatusTab,
): boolean {
  if (statusTab === "all") {
    return true;
  }

  if (statusTab === "active") {
    return template.status === "진행 중";
  }

  return template.status === "발행 중지";
}

export function getDangerCopy(state: NonNullable<CouponDangerState>) {
  const entityLabel = state.entity === "coupon" ? "쿠폰" : "정기 쿠폰 템플릿";

  if (state.type === "pause") {
    return {
      title: `${entityLabel} 발행을 중지할까요?`,
      description:
        "언제든지 다시 발행을 재개할 수 있어요. 중지 사유를 기록해 주세요.",
      confirmText: "발행 중지",
      successMessage: `${entityLabel} 발행을 중지했어요`,
    };
  }

  if (state.type === "resume") {
    return {
      title: `${entityLabel} 발행을 재개할까요?`,
      description:
        "재개 후에는 기존 발행 정책과 알림 설정이 다시 적용됩니다. 재개 사유를 기록해 주세요.",
      confirmText: "발행 재개",
      successMessage: `${entityLabel} 발행을 재개했어요`,
    };
  }

  return {
    title: `${entityLabel}을 삭제할까요?`,
    description: "삭제하면 복구할 수 없으니 다시 한 번 확인해 주세요.",
    confirmText: "삭제",
    successMessage: `${entityLabel}을 삭제했어요`,
  };
}

export async function copyTextSafely(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function canControlIssueState(coupon: CommerceCoupon): boolean {
  return coupon.couponKind === "autoIssue";
}

// 목록 필터/정렬과 요약 카운트 — 페이지 useMemo 본문을 함수화(Phase 4 분해, 동작 동일).
export function filterAndSortCoupons(
  coupons: CommerceCoupon[],
  keyword: string,
  searchField: CouponSearchField,
  statusTab: CouponStatusTab,
  couponKindFilter: CommerceCoupon["couponKind"] | null,
  sortField: CouponSortField | null,
  sortOrder: SortOrder | null,
): CommerceCoupon[] {
  const normalizedKeyword = keyword.trim().toLowerCase();

  const nextCoupons = coupons
    .filter((coupon) => matchesCouponStatusTab(coupon, statusTab))
    .filter((coupon) =>
      couponKindFilter ? coupon.couponKind === couponKindFilter : true,
    )
    .filter((coupon) => {
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        couponName: coupon.couponName,
        id: coupon.id,
        couponCode: coupon.couponCode,
      });
    });

  if (!sortField || !sortOrder) {
    return nextCoupons.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  const direction = sortOrder === "ascend" ? 1 : -1;

  return nextCoupons.sort((left, right) => {
    if (sortField === "couponName") {
      return compareCouponText(left.couponName, right.couponName) * direction;
    }

    if (sortField === "couponKind") {
      return (
        compareCouponText(
          getCouponKindDisplayLabel(left),
          getCouponKindDisplayLabel(right),
        ) * direction
      );
    }

    if (sortField === "validity") {
      return (
        compareCouponText(
          getCouponValiditySortValue(left),
          getCouponValiditySortValue(right),
        ) * direction
      );
    }

    if (sortField === "couponStatus") {
      return (
        compareCouponText(left.couponStatus, right.couponStatus) * direction
      );
    }

    return (left.issueCount - right.issueCount) * direction;
  });
}

export function filterCouponTemplates(
  templates: CommerceCouponSubscriptionTemplate[],
  keyword: string,
  templateStatusTab: CouponTemplateStatusTab,
): CommerceCouponSubscriptionTemplate[] {
  const normalizedKeyword = keyword.trim().toLowerCase();

  return [...templates]
    .filter((template) =>
      matchesCouponTemplateStatusTab(template, templateStatusTab),
    )
    .filter((template) => {
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, "couponName", {
        couponName: template.templateName,
        id: template.id,
      });
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getCouponStatusCounts(coupons: CommerceCoupon[]) {
  return {
    all: coupons.length,
    waiting: coupons.filter(
      (coupon) => coupon.couponStatus === "대기",
    ).length,
    active: coupons.filter(
      (coupon) => coupon.couponStatus === "진행 중",
    ).length,
    ended: coupons.filter(
      (coupon) => coupon.couponStatus === "종료",
    ).length,
  };
}

export function getCouponTemplateStatusCounts(
  templates: CommerceCouponSubscriptionTemplate[],
) {
  return {
    all: templates.length,
    active: templates.filter(
      (template) => template.status === "진행 중",
    ).length,
    paused: templates.filter(
      (template) => template.status === "발행 중지",
    ).length,
  };
}

export function buildCouponStatusSummaryCards(
  couponStatusTabItems: NonNullable<TabsProps["items"]>,
  statusCounts: ReturnType<typeof getCouponStatusCounts>,
  statusTab: CouponStatusTab,
  handleStatusFilterChange: (next: CouponStatusTab) => void,
) {
  return couponStatusTabItems.map((item) => {
      const nextStatusTab = item.key as CouponStatusTab;

      if (nextStatusTab === "waiting") {
        return {
          key: item.key,
          label: "대기 쿠폰",
          value: `${statusCounts.waiting.toLocaleString()}건`,
          active: statusTab === nextStatusTab,
          onClick: () => handleStatusFilterChange(nextStatusTab),
        };
      }

      if (nextStatusTab === "active") {
        return {
          key: item.key,
          label: "진행 중 쿠폰",
          value: `${statusCounts.active.toLocaleString()}건`,
          active: statusTab === nextStatusTab,
          onClick: () => handleStatusFilterChange(nextStatusTab),
        };
      }

      if (nextStatusTab === "ended") {
        return {
          key: item.key,
          label: "종료 쿠폰",
          value: `${statusCounts.ended.toLocaleString()}건`,
          active: statusTab === nextStatusTab,
          onClick: () => handleStatusFilterChange(nextStatusTab),
        };
      }

      return {
        key: item.key,
        label: "전체 쿠폰",
        value: `${statusCounts.all.toLocaleString()}건`,
        active: statusTab === nextStatusTab,
        onClick: () => handleStatusFilterChange(nextStatusTab),
      };
  });
}

export function buildCouponTemplateSummaryCards(
  templateStatusCounts: ReturnType<typeof getCouponTemplateStatusCounts>,
  templateStatusTab: CouponTemplateStatusTab,
  handleTemplateStatusFilterChange: (next: CouponTemplateStatusTab) => void,
) {
  return [
    {
      key: "all",
      label: "전체 템플릿",
      value: `${templateStatusCounts.all.toLocaleString()}건`,
      active: templateStatusTab === "all",
      onClick: () => handleTemplateStatusFilterChange("all"),
    },
    {
      key: "active",
      label: "진행 중 템플릿",
      value: `${templateStatusCounts.active.toLocaleString()}건`,
      active: templateStatusTab === "active",
      onClick: () => handleTemplateStatusFilterChange("active"),
    },
    {
      key: "paused",
      label: "발행 중지 템플릿",
      value: `${templateStatusCounts.paused.toLocaleString()}건`,
      active: templateStatusTab === "paused",
      onClick: () => handleTemplateStatusFilterChange("paused"),
    },
  ];
}
