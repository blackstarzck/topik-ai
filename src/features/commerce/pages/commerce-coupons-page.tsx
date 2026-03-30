import {
  Alert,
  Button,
  Card,
  Descriptions,
  Dropdown,
  Modal,
  Space,
  Tabs,
  Tag,
  Typography,
  notification,
} from "antd";
import type { MenuProps, TableColumnsType, TableProps, TabsProps } from "antd";
import {
  DownOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import {
  deleteCouponSafe,
  duplicateCouponSafe,
  deleteCouponTemplateSafe,
  fetchCouponsSafe,
  fetchCouponTemplatesSafe,
  pauseCouponSafe,
  pauseCouponTemplateSafe,
  resumeCouponSafe,
  resumeCouponTemplateSafe,
} from "../api/coupons-service";
import { couponKindCardItems } from "../model/coupon-form-schema";
import type { CommerceCouponSubscriptionTemplate } from "../model/coupon-template-types";
import {
  formatCouponTemplateSchedule,
  getCouponTemplateAlertSummary,
  getCouponTemplateBenefitSummary,
  getCouponTemplateConditionSummary,
  getCouponTemplateIssueTargetSummary,
  getCouponTemplateScopeSummary,
} from "../model/coupon-template-types";
import type {
  CommerceCoupon,
  CouponMainView,
  CouponStatusTab,
} from "../model/coupon-types";
import {
  getCouponAlertSummary,
  getCouponBenefitSummary,
  getCouponConditionSummary,
  getCouponIssueSummary,
  getCouponKindDisplayLabel,
  getCouponKindLabel,
  getCouponLinkageSummary,
  getCouponValiditySummary,
} from "../model/coupon-types";
import { useCouponStore } from "../model/coupon-store";
import type { AsyncState } from "../../../shared/model/async-state";
import { AuditLogLink } from "../../../shared/ui/audit-log-link/audit-log-link";
import { ConfirmAction } from "../../../shared/ui/confirm-action/confirm-action";
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection,
} from "../../../shared/ui/detail-drawer/detail-drawer";
import { AdminListCard } from "../../../shared/ui/list-page-card/admin-list-card";
import { ListSummaryCards } from "../../../shared/ui/list-summary-cards/list-summary-cards";
import { PageTitle } from "../../../shared/ui/page-title/page-title";
import { SearchBar } from "../../../shared/ui/search-bar/search-bar";
import { matchesSearchField } from "../../../shared/ui/search-bar/search-bar-utils";
import { StatusBadge } from "../../../shared/ui/status-badge/status-badge";
import { AdminDataTable } from "../../../shared/ui/table/admin-data-table";
import { BinaryStatusSwitch } from "../../../shared/ui/table/binary-status-switch";
import { createStatusColumnTitle } from "../../../shared/ui/table/status-column-title";
import { TableActionMenu } from "../../../shared/ui/table/table-action-menu";

const { Paragraph, Text, Title } = Typography;

type CouponSearchField = "couponName";
type CouponSortField =
  | "couponName"
  | "couponKind"
  | "validity"
  | "couponStatus"
  | "issueCount";
type CouponSortOrder = "ascend" | "descend" | null;
type CouponTemplateStatusTab = "all" | "active" | "paused";
type CouponDangerState =
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

type CouponTypeCardProps = {
  title: string;
  description: string;
  onSelect: () => void;
};

type CouponTypeCardRipple = {
  id: number;
  left: number;
  top: number;
  size: number;
};

function CouponTypeSelectionCard({
  title,
  description,
  onSelect,
}: CouponTypeCardProps): JSX.Element {
  const rippleTimeoutsRef = useRef<number[]>([]);
  const [ripples, setRipples] = useState<CouponTypeCardRipple[]>([]);

  useEffect(() => {
    return () => {
      rippleTimeoutsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );
      rippleTimeoutsRef.current = [];
    };
  }, []);

  const spawnRipple = useCallback(
    (element: HTMLButtonElement, x: number, y: number) => {
      const rect = element.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.8;
      const ripple: CouponTypeCardRipple = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        left: x - size / 2,
        top: y - size / 2,
        size,
      };
      setRipples((prev) => [...prev, ripple]);
      const timeoutId = window.setTimeout(() => {
        setRipples((prev) => prev.filter((item) => item.id !== ripple.id));
        rippleTimeoutsRef.current = rippleTimeoutsRef.current.filter(
          (currentTimeoutId) => currentTimeoutId !== timeoutId,
        );
      }, 420);
      rippleTimeoutsRef.current.push(timeoutId);
    },
    [],
  );

  const scheduleSelect = useCallback(() => {
    const timeoutId = window.setTimeout(() => {
      onSelect();
      rippleTimeoutsRef.current = rippleTimeoutsRef.current.filter(
        (currentTimeoutId) => currentTimeoutId !== timeoutId,
      );
    }, 120);
    rippleTimeoutsRef.current.push(timeoutId);
  }, [onSelect]);

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      spawnRipple(
        event.currentTarget,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
      scheduleSelect();
    },
    [scheduleSelect, spawnRipple],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      spawnRipple(event.currentTarget, rect.width / 2, rect.height / 2);
      scheduleSelect();
    },
    [scheduleSelect, spawnRipple],
  );

  return (
    <button
      type="button"
      className="commerce-coupon-type-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="commerce-coupon-type-card__ripple-layer" aria-hidden>
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="commerce-coupon-type-card__ripple"
            style={{
              width: ripple.size,
              height: ripple.size,
              left: ripple.left,
              top: ripple.top,
            }}
          />
        ))}
      </span>
      <span className="commerce-coupon-type-card__content">
        <Title level={5} style={{ margin: 0 }}>
          {title}
        </Title>
        <Text type="secondary">{description}</Text>
      </span>
    </button>
  );
}

const couponKindFilterOptions = [
  { text: "고객 다운로드", value: "customerDownload" },
  { text: "자동 발행", value: "autoIssue" },
  { text: "쿠폰 코드", value: "couponCode" },
  { text: "지정 발행", value: "manualIssue" },
] as const;

const couponStatusColumnFilterOptions = [
  { text: "대기", value: "대기" },
  { text: "진행 중", value: "진행 중" },
  { text: "종료", value: "종료" },
] as const;

function parseMainView(value: string | null): CouponMainView {
  return value === "subscriptionTemplate" ? "subscriptionTemplate" : "list";
}

function parseStatusTab(value: string | null): CouponStatusTab {
  if (value === "waiting" || value === "active" || value === "ended") {
    return value;
  }

  return "all";
}

function parseTemplateStatusTab(value: string | null): CouponTemplateStatusTab {
  if (value === "active" || value === "paused") {
    return value;
  }

  return "all";
}

function parseSortField(value: string | null): CouponSortField | null {
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

function parseSortOrder(value: string | null): CouponSortOrder {
  return value === "ascend" || value === "descend" ? value : null;
}

function parseCouponKindFilter(
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

function parseStatusFilterValue(value: string): CouponStatusTab | null {
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

function getStatusFilterValue(statusTab: CouponStatusTab): string | null {
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

function compareCouponText(left: string, right: string): number {
  return left.localeCompare(right, "ko-KR", {
    numeric: true,
    sensitivity: "base",
  });
}

function getCouponValiditySortValue(coupon: CommerceCoupon): string {
  if (coupon.validityMode === "fixedDate") {
    return `${coupon.validFrom ?? ""}-${coupon.validUntil ?? ""}`;
  }

  return `${coupon.expireAfterDays ?? 0}`;
}

function matchesCouponStatusTab(
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

function matchesCouponTemplateStatusTab(
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

function getDangerCopy(state: NonNullable<CouponDangerState>) {
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

async function copyTextSafely(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function canControlIssueState(coupon: CommerceCoupon): boolean {
  return coupon.couponKind === "autoIssue";
}

export default function CommerceCouponsPage(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const planTier = useCouponStore((state) => state.planTier);
  const mainView = parseMainView(searchParams.get("view"));
  const statusTab = parseStatusTab(searchParams.get("statusTab"));
  const templateStatusTab = parseTemplateStatusTab(
    searchParams.get("templateStatus"),
  );
  const searchField: CouponSearchField = "couponName";
  const couponKindFilter = parseCouponKindFilter(
    searchParams.get("couponKind"),
  );
  const sortField = parseSortField(searchParams.get("sortField"));
  const sortOrder = parseSortOrder(searchParams.get("sortOrder"));
  const keyword = searchParams.get("keyword") ?? "";
  const selectedDetailId = searchParams.get("selected") ?? "";

  const [couponsState, setCouponsState] = useState<
    AsyncState<CommerceCoupon[]>
  >({
    status: "pending",
    data: [],
    errorMessage: null,
    errorCode: null,
  });
  const [templatesState, setTemplatesState] = useState<
    AsyncState<CommerceCouponSubscriptionTemplate[]>
  >({
    status: "pending",
    data: [],
    errorMessage: null,
    errorCode: null,
  });
  const [dangerState, setDangerState] = useState<CouponDangerState>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [createTypeModalOpen, setCreateTypeModalOpen] = useState(false);
  const [emptyGuideOpen, setEmptyGuideOpen] = useState(false);
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();
  const handledSavedStateRef = useRef<string | null>(null);

  const listSearch = useMemo(() => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("selected");
    const search = nextSearchParams.toString();
    return search ? `?${search}` : "";
  }, [searchParams]);

  const commitParams = useCallback(
    (
      next: Partial<
        Record<
          | "view"
          | "statusTab"
          | "templateStatus"
          | "couponKind"
          | "sortField"
          | "sortOrder"
          | "keyword"
          | "selected",
          string | null
        >
      >,
    ) => {
      const merged = new URLSearchParams(searchParams);

      Object.entries(next).forEach(([key, value]) => {
        if (!value || value === "all") {
          merged.delete(key);
          return;
        }

        merged.set(key, value);
      });

      setSearchParams(merged, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    const controller = new AbortController();

    setCouponsState((prev) => ({
      ...prev,
      status: "pending",
      errorMessage: null,
      errorCode: null,
    }));

    void fetchCouponsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setCouponsState({
          status: result.data.length === 0 ? "empty" : "success",
          data: result.data,
          errorMessage: null,
          errorCode: null,
        });
        return;
      }

      setCouponsState((prev) => ({
        ...prev,
        status: "error",
        errorMessage: result.error.message,
        errorCode: result.error.code,
      }));
    });

    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();

    setTemplatesState((prev) => ({
      ...prev,
      status: "pending",
      errorMessage: null,
      errorCode: null,
    }));

    void fetchCouponTemplatesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setTemplatesState({
          status: result.data.length === 0 ? "empty" : "success",
          data: result.data,
          errorMessage: null,
          errorCode: null,
        });
        return;
      }

      setTemplatesState((prev) => ({
        ...prev,
        status: "error",
        errorMessage: result.error.message,
        errorCode: result.error.code,
      }));
    });

    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const state = location.state as {
      commerceCouponSaved?: {
        couponId: string;
        mode: "create" | "edit";
      };
      commerceCouponTemplateSaved?: {
        templateId: string;
        mode: "create" | "edit";
      };
    } | null;

    if (!state?.commerceCouponSaved && !state?.commerceCouponTemplateSaved) {
      return;
    }

    const savedStateKey = state.commerceCouponSaved
      ? `coupon:${state.commerceCouponSaved.mode}:${state.commerceCouponSaved.couponId}`
      : `template:${state?.commerceCouponTemplateSaved?.mode}:${state?.commerceCouponTemplateSaved?.templateId}`;

    if (handledSavedStateRef.current === savedStateKey) {
      return;
    }

    handledSavedStateRef.current = savedStateKey;

    if (state.commerceCouponSaved) {
      notificationApi.success({
        message:
          state.commerceCouponSaved.mode === "create"
            ? "쿠폰 생성했어요"
            : "쿠폰 수정했어요",
        description: (
          <Space direction="vertical">
            <Text>대상 유형: 쿠폰</Text>
            <Text>대상 ID: {state.commerceCouponSaved.couponId}</Text>
            <AuditLogLink
              targetType="CommerceCoupon"
              targetId={state.commerceCouponSaved.couponId}
            />
          </Space>
        ),
      });
      return;
    }

    if (state.commerceCouponTemplateSaved) {
      notificationApi.success({
        message:
          state.commerceCouponTemplateSaved.mode === "create"
            ? "정기 쿠폰 템플릿을 생성했어요"
            : "정기 쿠폰 템플릿을 수정했어요",
        description: (
          <Space direction="vertical">
            <Text>대상 유형: 정기 쿠폰 템플릿</Text>
            <Text>대상 ID: {state.commerceCouponTemplateSaved.templateId}</Text>
            <AuditLogLink
              targetType="CommerceCouponTemplate"
              targetId={state.commerceCouponTemplateSaved.templateId}
            />
          </Space>
        ),
      });
    }
  }, [location.state, notificationApi]);

  const filteredCoupons = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    const nextCoupons = couponsState.data
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
  }, [
    couponKindFilter,
    couponsState.data,
    keyword,
    searchField,
    sortField,
    sortOrder,
    statusTab,
  ]);

  const filteredTemplates = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return [...templatesState.data]
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
  }, [keyword, templateStatusTab, templatesState.data]);

  const selectedCoupon = useMemo(
    () =>
      selectedDetailId
        ? (couponsState.data.find((coupon) => coupon.id === selectedDetailId) ??
          null)
        : null,
    [couponsState.data, selectedDetailId],
  );

  const selectedTemplate = useMemo(
    () =>
      selectedDetailId
        ? (templatesState.data.find(
            (template) => template.id === selectedDetailId,
          ) ?? null)
        : null,
    [selectedDetailId, templatesState.data],
  );

  useEffect(() => {
    if (!selectedDetailId) {
      return;
    }

    if (mainView === "list") {
      const canValidateSelected =
        couponsState.status === "success" ||
        couponsState.status === "empty" ||
        (couponsState.status === "error" && couponsState.data.length > 0);

      if (!canValidateSelected || selectedCoupon) {
        return;
      }

      commitParams({ selected: null });
      return;
    }

    const canValidateSelected =
      templatesState.status === "success" ||
      templatesState.status === "empty" ||
      (templatesState.status === "error" && templatesState.data.length > 0);

    if (!canValidateSelected || selectedTemplate) {
      return;
    }

    commitParams({ selected: null });
  }, [
    commitParams,
    couponsState.data.length,
    couponsState.status,
    mainView,
    selectedCoupon,
    selectedDetailId,
    selectedTemplate,
    templatesState.data.length,
    templatesState.status,
  ]);

  const statusCounts = useMemo(
    () => ({
      all: couponsState.data.length,
      waiting: couponsState.data.filter(
        (coupon) => coupon.couponStatus === "대기",
      ).length,
      active: couponsState.data.filter(
        (coupon) => coupon.couponStatus === "진행 중",
      ).length,
      ended: couponsState.data.filter(
        (coupon) => coupon.couponStatus === "종료",
      ).length,
    }),
    [couponsState.data],
  );

  const couponMainTabItems = useMemo<NonNullable<TabsProps["items"]>>(
    () => [
      { key: "list", label: "쿠폰 목록" },
      { key: "subscriptionTemplate", label: "정기 쿠폰 템플릿" },
    ],
    [],
  );
  const couponStatusTabItems = useMemo<NonNullable<TabsProps["items"]>>(
    () => [
      { key: "all", label: `전체 ${statusCounts.all}` },
      { key: "waiting", label: `대기 ${statusCounts.waiting}` },
      { key: "active", label: `진행 중 ${statusCounts.active}` },
      { key: "ended", label: `종료 ${statusCounts.ended}` },
    ],
    [
      statusCounts.active,
      statusCounts.all,
      statusCounts.ended,
      statusCounts.waiting,
    ],
  );

  const openCreatePage = useCallback(
    (couponKind: CommerceCoupon["couponKind"]) => {
      setCreateTypeModalOpen(false);
      navigate({
        pathname: "/commerce/coupons/create",
        search:
          `${listSearch ? `${listSearch}&` : "?"}type=${couponKind}`.replace(
            "?&",
            "?",
          ),
      });
    },
    [listSearch, navigate],
  );

  const openSubscriptionTemplateCreatePage = useCallback(() => {
    navigate({
      pathname: "/commerce/coupons/template/create",
      search: listSearch || "?view=subscriptionTemplate",
    });
  }, [listSearch, navigate]);

  const handleSearchFieldChange = useCallback(() => undefined, []);

  const createMenuItems = useMemo<NonNullable<MenuProps["items"]>>(
    () => [
      {
        key: "general-coupon",
        label: (
          <div className="commerce-coupon-create-menu-item">
            <Text strong>일반 쿠폰 만들기</Text>
          </div>
        ),
        onClick: () => setCreateTypeModalOpen(true),
      },
      {
        key: "subscription-template",
        label: (
          <div className="commerce-coupon-create-menu-item">
            <Text strong>정기 쿠폰 템플릿 만들기</Text>
            <Text type="secondary">월별 정기 발행 쿠폰 등</Text>
          </div>
        ),
        onClick: openSubscriptionTemplateCreatePage,
      },
    ],
    [openSubscriptionTemplateCreatePage],
  );

  const openEditPage = useCallback(
    (coupon: CommerceCoupon) => {
      navigate({
        pathname: `/commerce/coupons/create/${coupon.id}`,
        search: listSearch,
      });
    },
    [listSearch, navigate],
  );

  const openTemplateEditPage = useCallback(
    (template: CommerceCouponSubscriptionTemplate) => {
      navigate({
        pathname: `/commerce/coupons/template/create/${template.id}`,
        search: listSearch || "?view=subscriptionTemplate",
      });
    },
    [listSearch, navigate],
  );

  const openDetail = useCallback(
    (couponId: string) => commitParams({ selected: couponId }),
    [commitParams],
  );

  const closeDetail = useCallback(
    () => commitParams({ selected: null }),
    [commitParams],
  );

  const handleReload = useCallback(() => setReloadKey((prev) => prev + 1), []);

  const handleStatusFilterChange = useCallback(
    (nextStatusTab: CouponStatusTab) => {
      commitParams({ statusTab: nextStatusTab, selected: null });
    },
    [commitParams],
  );
  const handleTemplateStatusFilterChange = useCallback(
    (nextStatusTab: CouponTemplateStatusTab) => {
      commitParams({ templateStatus: nextStatusTab, selected: null });
    },
    [commitParams],
  );

  const couponStatusSummaryCards = useMemo(
    () =>
      couponStatusTabItems.map((item) => {
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
      }),
    [
      couponStatusTabItems,
      handleStatusFilterChange,
      statusCounts.active,
      statusCounts.all,
      statusCounts.ended,
      statusCounts.waiting,
      statusTab,
    ],
  );
  const templateStatusCounts = useMemo(
    () => ({
      all: templatesState.data.length,
      active: templatesState.data.filter(
        (template) => template.status === "진행 중",
      ).length,
      paused: templatesState.data.filter(
        (template) => template.status === "발행 중지",
      ).length,
    }),
    [templatesState.data],
  );
  const couponTemplateSummaryCards = useMemo(
    () => [
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
    ],
    [
      handleTemplateStatusFilterChange,
      templateStatusCounts.active,
      templateStatusCounts.all,
      templateStatusCounts.paused,
      templateStatusTab,
    ],
  );

  const couponToolbarActions = useMemo(
    () => (
      <>
        <Dropdown
          trigger={["click"]}
          placement="bottomRight"
          menu={{ items: createMenuItems }}
        >
          <Button type="primary" size="large" icon={<PlusOutlined />}>
            <Space size={6}>
              쿠폰 만들기
              <DownOutlined />
            </Space>
          </Button>
        </Dropdown>
      </>
    ),
    [createMenuItems],
  );

  const handleCopyDownloadLink = useCallback(
    async (coupon: CommerceCoupon) => {
      if (!coupon.downloadUrl) {
        return;
      }

      try {
        await copyTextSafely(coupon.downloadUrl);
        notificationApi.success({
          message: "쿠폰 다운로드 링크를 복사했어요",
          description: (
            <Space direction="vertical">
              <Text>{coupon.downloadUrl}</Text>
              <Text type="secondary">대상 ID: {coupon.id}</Text>
            </Space>
          ),
        });
      } catch (error) {
        notificationApi.error({
          message: "쿠폰 다운로드 링크를 복사하지 못했어요",
          description:
            error instanceof Error
              ? error.message
              : "클립보드 접근에 실패했습니다.",
        });
      }
    },
    [notificationApi],
  );

  const handleCopyCouponCode = useCallback(
    async (coupon: CommerceCoupon) => {
      if (!coupon.couponCode) {
        return;
      }

      try {
        await copyTextSafely(coupon.couponCode);
        notificationApi.success({
          message: "쿠폰 코드를 복사했어요",
          description: (
            <Space direction="vertical">
              <Text>{coupon.couponCode}</Text>
              <Text type="secondary">대상 ID: {coupon.id}</Text>
            </Space>
          ),
        });
      } catch (error) {
        notificationApi.error({
          message: "쿠폰 코드를 복사하지 못했어요",
          description:
            error instanceof Error
              ? error.message
              : "클립보드 접근에 실패했습니다.",
        });
      }
    },
    [notificationApi],
  );

  const handleDuplicateCoupon = useCallback(
    async (coupon: CommerceCoupon) => {
      const result = await duplicateCouponSafe({ couponId: coupon.id });

      if (!result.ok) {
        notificationApi.error({
          message: "쿠폰 복제에 실패했어요",
          description: result.error.message,
        });
        return;
      }

      notificationApi.success({
        message: "쿠폰을 복제했어요",
        description: (
          <Space direction="vertical">
            <Text>대상 ID: {result.data.id}</Text>
            <AuditLogLink
              targetType="CommerceCoupon"
              targetId={result.data.id}
            />
          </Space>
        ),
      });

      navigate({
        pathname: `/commerce/coupons/create/${result.data.id}`,
        search: listSearch,
      });
    },
    [listSearch, navigate, notificationApi],
  );

  const handleDangerConfirm = useCallback(
    async (reason: string) => {
      if (!dangerState) {
        return;
      }

      const dangerCopy = getDangerCopy(dangerState);
      const targetType =
        dangerState.entity === "coupon"
          ? "CommerceCoupon"
          : "CommerceCouponTemplate";
      const targetId =
        dangerState.entity === "coupon"
          ? dangerState.coupon.id
          : dangerState.template.id;
      const result =
        dangerState.entity === "coupon"
          ? dangerState.type === "pause"
            ? await pauseCouponSafe({ couponId: dangerState.coupon.id, reason })
            : dangerState.type === "resume"
              ? await resumeCouponSafe({
                  couponId: dangerState.coupon.id,
                  reason,
                })
              : await deleteCouponSafe({
                  couponId: dangerState.coupon.id,
                  reason,
                })
          : dangerState.type === "pause"
            ? await pauseCouponTemplateSafe({
                templateId: dangerState.template.id,
                reason,
              })
            : dangerState.type === "resume"
              ? await resumeCouponTemplateSafe({
                  templateId: dangerState.template.id,
                  reason,
                })
              : await deleteCouponTemplateSafe({
                  templateId: dangerState.template.id,
                  reason,
                });

      if (!result.ok) {
        notificationApi.error({
          message: `${dangerCopy.title} 실패`,
          description: result.error.message,
        });
        return;
      }

      if (dangerState.entity === "coupon") {
        setCouponsState((prev) => {
          if (dangerState.type === "delete") {
            const nextData = prev.data.filter(
              (coupon) => coupon.id !== result.data.id,
            );
            return {
              status: nextData.length === 0 ? "empty" : "success",
              data: nextData,
              errorMessage: null,
              errorCode: null,
            };
          }

          return {
            status: prev.data.length === 0 ? "empty" : "success",
            data: prev.data.map((coupon) =>
              coupon.id === result.data.id ? result.data : coupon,
            ),
            errorMessage: null,
            errorCode: null,
          };
        });
      } else {
        setTemplatesState((prev) => {
          if (dangerState.type === "delete") {
            const nextData = prev.data.filter(
              (template) => template.id !== result.data.id,
            );
            return {
              status: nextData.length === 0 ? "empty" : "success",
              data: nextData,
              errorMessage: null,
              errorCode: null,
            };
          }

          return {
            status: prev.data.length === 0 ? "empty" : "success",
            data: prev.data.map((template) =>
              template.id === result.data.id ? result.data : template,
            ),
            errorMessage: null,
            errorCode: null,
          };
        });
      }

      if (
        selectedDetailId === result.data.id &&
        dangerState.type === "delete"
      ) {
        closeDetail();
      }

      notificationApi.success({
        message: dangerCopy.successMessage,
        description: (
          <Space direction="vertical">
            <Text>
              대상 유형:{" "}
              {dangerState.entity === "coupon" ? "쿠폰" : "정기 쿠폰 템플릿"}
            </Text>
            <Text>대상 ID: {targetId}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType={targetType} targetId={targetId} />
          </Space>
        ),
      });

      setDangerState(null);
    },
    [closeDetail, dangerState, notificationApi, selectedDetailId],
  );

  const handleTableChange = useCallback<
    NonNullable<TableProps<CommerceCoupon>["onChange"]>
  >(
    (_, filters, sorter) => {
      const nextKindFilter = Array.isArray(filters.couponKind)
        ? String(filters.couponKind[0] ?? "")
        : "";
      const nextStatusFilter = Array.isArray(filters.couponStatus)
        ? String(filters.couponStatus[0] ?? "")
        : "";
      const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const nextField =
        nextSorter && typeof nextSorter.field === "string"
          ? parseSortField(nextSorter.field)
          : null;

      commitParams({
        couponKind: nextKindFilter || null,
        statusTab: nextStatusFilter
          ? parseStatusFilterValue(nextStatusFilter)
          : null,
        sortField: nextField,
        sortOrder: nextField ? (nextSorter?.order ?? null) : null,
      });
    },
    [commitParams],
  );

  const createActionMenuItems = useCallback(
    (coupon: CommerceCoupon) => {
      const items = [
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
    },
    [
      handleCopyCouponCode,
      handleCopyDownloadLink,
      handleDuplicateCoupon,
      openEditPage,
    ],
  );

  const createTemplateActionMenuItems = useCallback(
    (template: CommerceCouponSubscriptionTemplate) => [
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
    ],
    [openTemplateEditPage],
  );

  const columns = useMemo<TableColumnsType<CommerceCoupon>>(
    () => [
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
    ],
    [createActionMenuItems, couponKindFilter, sortField, sortOrder, statusTab],
  );
  const subscriptionTemplateColumns = useMemo<
    TableColumnsType<CommerceCouponSubscriptionTemplate>
  >(
    () => [
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
    ],
    [createTemplateActionMenuItems],
  );

  const hasCachedCoupons = couponsState.data.length > 0;
  const hasCachedTemplates = templatesState.data.length > 0;
  const isFilteredEmpty =
    couponsState.status !== "empty" &&
    couponsState.data.length > 0 &&
    filteredCoupons.length === 0;
  const isTemplateFilteredEmpty =
    templatesState.status !== "empty" &&
    templatesState.data.length > 0 &&
    filteredTemplates.length === 0;
  const currentToolbarCount =
    mainView === "list" ? filteredCoupons.length : filteredTemplates.length;

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="쿠폰" />

      <ListSummaryCards
        items={
          mainView === "list"
            ? couponStatusSummaryCards
            : couponTemplateSummaryCards
        }
      />
      <AdminListCard
        toolbar={
          <div className="admin-list-card-toolbar-stack">
            <Tabs
              activeKey={mainView}
              items={couponMainTabItems}
              onChange={(nextView) =>
                commitParams({ view: nextView, selected: null })
              }
              className="admin-list-card-toolbar-tabs"
            />
            <SearchBar
              searchField={searchField}
              searchFieldOptions={[{ label: "전체", value: "couponName" }]}
              showSingleFieldSelect
              keyword={keyword}
              onSearchFieldChange={handleSearchFieldChange}
              onKeywordChange={(event) =>
                commitParams({ keyword: event.target.value, selected: null })
              }
              keywordPlaceholder={
                mainView === "list" ? "쿠폰명" : "정기 쿠폰명"
              }
              summary={
                <Text type="secondary">
                  총 {currentToolbarCount.toLocaleString()}건
                </Text>
              }
              actions={couponToolbarActions}
            />
          </div>
        }
      >
        {planTier === "free" ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="Free 버전은 쿠폰 1개까지만 생성할 수 있습니다."
            description="저장 시점에 생성 제한이 걸리므로, 유형별 입력을 다 작성한 뒤에도 제한 오류가 발생할 수 있습니다."
          />
        ) : null}

        {mainView === "list" && couponsState.status === "error" ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="쿠폰 목록을 불러오지 못했어요"
            description={
              <Space direction="vertical">
                <Text>
                  {couponsState.errorMessage ?? "일시적인 오류가 발생했습니다."}
                </Text>
                {couponsState.errorCode ? (
                  <Text type="secondary">
                    오류 코드: {couponsState.errorCode}
                  </Text>
                ) : null}
                {hasCachedCoupons ? (
                  <Text type="secondary">
                    마지막 성공 상태를 유지한 채 목록을 확인할 수 있습니다.
                  </Text>
                ) : null}
              </Space>
            }
            action={
              <Button size="small" onClick={handleReload}>
                다시 시도
              </Button>
            }
          />
        ) : null}

        {mainView === "subscriptionTemplate" &&
        templatesState.status === "error" ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="정기 쿠폰 템플릿 목록을 불러오지 못했어요"
            description={
              <Space direction="vertical">
                <Text>
                  {templatesState.errorMessage ??
                    "일시적인 오류가 발생했습니다."}
                </Text>
                {templatesState.errorCode ? (
                  <Text type="secondary">
                    오류 코드: {templatesState.errorCode}
                  </Text>
                ) : null}
                {hasCachedTemplates ? (
                  <Text type="secondary">
                    마지막 성공 상태를 유지한 채 목록을 확인할 수 있습니다.
                  </Text>
                ) : null}
              </Space>
            }
            action={
              <Button size="small" onClick={handleReload}>
                다시 시도
              </Button>
            }
          />
        ) : null}

        {mainView === "subscriptionTemplate" ? (
          <>
            {isTemplateFilteredEmpty ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message="선택한 조건에 맞는 정기 쿠폰 템플릿이 없어요"
                description="검색어를 조정해서 다시 확인해 주세요."
              />
            ) : null}

            <AdminDataTable<CommerceCouponSubscriptionTemplate>
              rowKey="id"
              columns={subscriptionTemplateColumns}
              dataSource={filteredTemplates}
              pagination={false}
              loading={
                templatesState.status === "pending" && !hasCachedTemplates
              }
              onRow={(record) => ({
                onClick: () => openDetail(record.id),
                style: { cursor: "pointer" },
              })}
              locale={{
                emptyText: (
                  <Space direction="vertical" size={4}>
                    <Text strong>생성한 정기 쿠폰 템플릿이 없어요</Text>
                    <Text type="secondary">
                      정기 쿠폰 템플릿을 설정하면 매월 1일 오전 7시에 자동으로
                      쿠폰을 발행할 수 있어요.
                    </Text>
                  </Space>
                ),
              }}
            />
          </>
        ) : (
          <>
            {couponsState.status === "empty" ? (
              <div className="commerce-coupon-empty-state">
                <Space direction="vertical" size={6} align="center">
                  <Title
                    level={5}
                    className="commerce-coupon-empty-state__title"
                  >
                    아직 생성한 쿠폰이 없어요
                  </Title>
                  <Text
                    type="secondary"
                    className="commerce-coupon-empty-state__description"
                  >
                    할인, 생일, 배송비 무료 등 다양한 쿠폰을 만들어 보세요
                  </Text>
                  <Button
                    size="large"
                    icon={<QuestionCircleOutlined />}
                    onClick={() => setEmptyGuideOpen((prev) => !prev)}
                  >
                    쿠폰은 왜 만들어야 할까요?
                  </Button>
                </Space>
                {emptyGuideOpen ? (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 16, textAlign: "left" }}
                    message="쿠폰 운영 가이드"
                    description={
                      <Space direction="vertical" size={4}>
                        <Text>
                          고객 다운로드는 링크형 프로모션에 적합합니다.
                        </Text>
                        <Text>
                          자동 발행은 회원가입, 첫 주문, 생일 같은 트리거에
                          연결합니다.
                        </Text>
                        <Text>
                          쿠폰 코드 생성은 외부 채널 제휴나 오프라인 캠페인에
                          적합합니다.
                        </Text>
                      </Space>
                    }
                  />
                ) : null}
              </div>
            ) : null}

            {isFilteredEmpty ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message="선택한 조건에 맞는 쿠폰이 없어요"
                description="상태 탭, 검색어, 유효 기간을 조정해서 다시 확인해 주세요."
              />
            ) : null}

            <AdminDataTable<CommerceCoupon>
              rowKey="id"
              columns={columns}
              dataSource={filteredCoupons}
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
              }}
              loading={couponsState.status === "pending" && !hasCachedCoupons}
              onChange={handleTableChange}
              onRow={(record) => ({
                onClick: () => openDetail(record.id),
                style: { cursor: "pointer" },
              })}
              scroll={{ x: 1360 }}
            />
          </>
        )}
      </AdminListCard>

      {dangerState ? (
        <ConfirmAction
          open
          title={getDangerCopy(dangerState).title}
          description={getDangerCopy(dangerState).description}
          targetType={
            dangerState.entity === "coupon"
              ? "CommerceCoupon"
              : "CommerceCouponTemplate"
          }
          targetId={
            dangerState.entity === "coupon"
              ? dangerState.coupon.id
              : dangerState.template.id
          }
          confirmText={getDangerCopy(dangerState).confirmText}
          onCancel={() => setDangerState(null)}
          onConfirm={handleDangerConfirm}
        />
      ) : null}

      <DetailDrawer
        open={Boolean(selectedCoupon || selectedTemplate)}
        title={
          selectedCoupon
            ? `쿠폰 상세 · ${selectedCoupon.id}`
            : selectedTemplate
              ? `정기 쿠폰 템플릿 상세 · ${selectedTemplate.id}`
              : "쿠폰 상세"
        }
        destroyOnHidden
        width={760}
        onClose={closeDetail}
        headerMeta={
          selectedCoupon ? (
            <Space wrap size={8}>
              <StatusBadge status={selectedCoupon.couponStatus} />
              {selectedCoupon.issueState === "발행 중지" ? (
                <StatusBadge status={selectedCoupon.issueState} />
              ) : null}
              <Tag color="blue">
                {getCouponKindLabel(selectedCoupon.couponKind)}
              </Tag>
            </Space>
          ) : selectedTemplate ? (
            <Space wrap size={8}>
              <StatusBadge status={selectedTemplate.status} />
              <Tag color="blue">쇼핑 등급</Tag>
            </Space>
          ) : null
        }
        footerStart={
          selectedCoupon ? (
            <AuditLogLink
              targetType="CommerceCoupon"
              targetId={selectedCoupon.id}
            />
          ) : selectedTemplate ? (
            <AuditLogLink
              targetType="CommerceCouponTemplate"
              targetId={selectedTemplate.id}
            />
          ) : null
        }
        footerEnd={
          selectedCoupon ? (
            <Space wrap>
              {selectedCoupon.downloadUrl ? (
                <Button
                  size="large"
                  onClick={() => {
                    void handleCopyDownloadLink(selectedCoupon);
                  }}
                >
                  링크 복사
                </Button>
              ) : null}
              {selectedCoupon.couponCode ? (
                <Button
                  size="large"
                  onClick={() => {
                    void handleCopyCouponCode(selectedCoupon);
                  }}
                >
                  코드 복사
                </Button>
              ) : null}
              <Button size="large" onClick={() => openEditPage(selectedCoupon)}>
                수정
              </Button>
              {canControlIssueState(selectedCoupon) ? (
                <Button
                  size="large"
                  onClick={() =>
                    setDangerState({
                      entity: "coupon",
                      type:
                        selectedCoupon.issueState === "발행 중지"
                          ? "resume"
                          : "pause",
                      coupon: selectedCoupon,
                    })
                  }
                >
                  {selectedCoupon.issueState === "발행 중지"
                    ? "발행 재개"
                    : "발행 중지"}
                </Button>
              ) : null}
              <Button
                size="large"
                danger
                onClick={() =>
                  setDangerState({
                    entity: "coupon",
                    type: "delete",
                    coupon: selectedCoupon,
                  })
                }
              >
                삭제
              </Button>
            </Space>
          ) : selectedTemplate ? (
            <Space wrap>
              <Button
                size="large"
                onClick={() => openTemplateEditPage(selectedTemplate)}
              >
                수정
              </Button>
              <Button
                size="large"
                onClick={() =>
                  setDangerState({
                    entity: "template",
                    type:
                      selectedTemplate.status === "발행 중지"
                        ? "resume"
                        : "pause",
                    template: selectedTemplate,
                  })
                }
              >
                {selectedTemplate.status === "발행 중지"
                  ? "발행 재개"
                  : "발행 중지"}
              </Button>
              <Button
                size="large"
                danger
                onClick={() =>
                  setDangerState({
                    entity: "template",
                    type: "delete",
                    template: selectedTemplate,
                  })
                }
              >
                삭제
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedCoupon ? (
          <DetailDrawerBody>
            <Alert
              type={
                selectedCoupon.issueState === "발행 중지" ? "warning" : "info"
              }
              showIcon
              message={
                selectedCoupon.issueState === "발행 중지"
                  ? "현재 발행 중지 상태입니다."
                  : "쿠폰 운영 상세를 빠르게 확인할 수 있습니다."
              }
              description={
                selectedCoupon.issueState === "발행 중지"
                  ? "저장된 정책은 유지되지만 신규 발행은 중지됩니다. 재개 전 대상/알림 정책을 함께 확인해 주세요."
                  : "행동 타깃, 링크/코드, 알림 연동, 사용 현황까지 이 Drawer에서 바로 검수할 수 있습니다."
              }
            />

            <DetailDrawerSection title="기본 정보">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: "id", label: "쿠폰 ID", children: selectedCoupon.id },
                  {
                    key: "name",
                    label: "쿠폰명",
                    children: selectedCoupon.couponName,
                  },
                  {
                    key: "kind",
                    label: "쿠폰 형식",
                    children: getCouponKindDisplayLabel(selectedCoupon),
                  },
                  {
                    key: "status",
                    label: "상태",
                    children: (
                      <Space wrap>
                        <StatusBadge status={selectedCoupon.couponStatus} />
                        {selectedCoupon.issueState === "발행 중지" ? (
                          <StatusBadge status={selectedCoupon.issueState} />
                        ) : null}
                      </Space>
                    ),
                  },
                  {
                    key: "updated",
                    label: "최근 수정",
                    children: `${selectedCoupon.updatedAt} · ${selectedCoupon.updatedBy}`,
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="혜택 / 사용 조건">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "benefit",
                    label: "혜택",
                    children: getCouponBenefitSummary(selectedCoupon),
                  },
                  {
                    key: "condition",
                    label: "사용 조건",
                    children: getCouponConditionSummary(selectedCoupon),
                  },
                  {
                    key: "validity",
                    label: "유효 기간",
                    children: getCouponValiditySummary(selectedCoupon),
                  },
                  {
                    key: "usageLimit",
                    label: "사용 횟수",
                    children:
                      selectedCoupon.usageLimitMode === "limited"
                        ? `${selectedCoupon.usageLimit ?? 0}회`
                        : "제한 없음",
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="발행 정책">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "issueSummary",
                    label: "발행 정보",
                    children: getCouponIssueSummary(selectedCoupon),
                  },
                  {
                    key: "secret",
                    label: "시크릿 쿠폰",
                    children: selectedCoupon.isSecretCoupon
                      ? "사용"
                      : "사용 안 함",
                  },
                  {
                    key: "issueLimit",
                    label: "발행 수량",
                    children:
                      selectedCoupon.issueLimitMode === "limited"
                        ? `${selectedCoupon.issueLimit ?? 0}개`
                        : "제한 없음",
                  },
                  {
                    key: "downloadLimit",
                    label: "다운로드 수량",
                    children:
                      selectedCoupon.downloadLimitMode === "limited"
                        ? `${selectedCoupon.downloadLimit ?? 0}개`
                        : "제한 없음",
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="링크 / 코드 / 연동">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "downloadUrl",
                    label: "다운로드 링크",
                    children: selectedCoupon.downloadUrl || "없음",
                  },
                  {
                    key: "couponCode",
                    label: "쿠폰 코드",
                    children: selectedCoupon.couponCode || "없음",
                  },
                  {
                    key: "linkage",
                    label: "메시지/CRM 연동",
                    children: getCouponLinkageSummary(selectedCoupon),
                  },
                  {
                    key: "issueAlert",
                    label: "발급 알림",
                    children: getCouponAlertSummary(selectedCoupon.issueAlert),
                  },
                  {
                    key: "expireAlert",
                    label: "소멸 알림",
                    children: getCouponAlertSummary(selectedCoupon.expireAlert),
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="사용 현황">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "counts",
                    label: "발급 / 다운로드 / 사용",
                    children: `${selectedCoupon.issueCount.toLocaleString()} / ${selectedCoupon.downloadCount.toLocaleString()} / ${selectedCoupon.useCount.toLocaleString()}`,
                  },
                  {
                    key: "lastIssued",
                    label: "최근 발급",
                    children: selectedCoupon.lastIssuedAt || "없음",
                  },
                  {
                    key: "lastDownloaded",
                    label: "최근 다운로드",
                    children: selectedCoupon.lastDownloadedAt || "없음",
                  },
                  {
                    key: "lastUsed",
                    label: "최근 사용",
                    children: selectedCoupon.lastUsedAt || "없음",
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="운영 메모 / 정책 메모">
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                  {selectedCoupon.adminMemo || "운영 메모가 없습니다."}
                </Paragraph>
                <Card size="small" title="정책 메모">
                  <Space direction="vertical" size={8}>
                    {selectedCoupon.policyNotes.map((policyNote) => (
                      <Text key={policyNote}>{policyNote}</Text>
                    ))}
                  </Space>
                </Card>
              </Space>
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : selectedTemplate ? (
          <DetailDrawerBody>
            <Alert
              type={
                selectedTemplate.status === "발행 중지" ? "warning" : "info"
              }
              showIcon
              message={
                selectedTemplate.status === "발행 중지"
                  ? "현재 정기 발행 중지 상태입니다."
                  : "매월 자동 발행 정책을 바로 검수할 수 있습니다."
              }
              description={
                selectedTemplate.status === "발행 중지"
                  ? "기존 발급 쿠폰은 유지되고, 이후 발급분만 멈춥니다. 재개 전에 대상 등급과 알림 정책을 함께 확인해 주세요."
                  : "발행 대상, 혜택, 사용 종료일, 알림 설정을 이 Drawer에서 함께 검토할 수 있습니다."
              }
            />

            <DetailDrawerSection title="기본 정보">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "id",
                    label: "템플릿 ID",
                    children: selectedTemplate.id,
                  },
                  {
                    key: "name",
                    label: "정기 쿠폰명",
                    children: selectedTemplate.templateName,
                  },
                  {
                    key: "status",
                    label: "상태",
                    children: <StatusBadge status={selectedTemplate.status} />,
                  },
                  {
                    key: "issueTarget",
                    label: "발행 대상",
                    children:
                      getCouponTemplateIssueTargetSummary(selectedTemplate),
                  },
                  {
                    key: "updated",
                    label: "최근 수정",
                    children: `${selectedTemplate.updatedAt} · ${selectedTemplate.updatedBy}`,
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="혜택 / 사용 조건">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "benefit",
                    label: "혜택",
                    children: getCouponTemplateBenefitSummary(selectedTemplate),
                  },
                  {
                    key: "condition",
                    label: "사용 조건",
                    children:
                      getCouponTemplateConditionSummary(selectedTemplate),
                  },
                  {
                    key: "scope",
                    label: "쿠폰 적용 범위",
                    children: getCouponTemplateScopeSummary(selectedTemplate),
                  },
                  {
                    key: "usageEnd",
                    label: "쿠폰 사용 종료일",
                    children: formatCouponTemplateSchedule(
                      selectedTemplate.usageEndSchedule,
                    ),
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="발행 정책">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "issueSchedule",
                    label: "정기 발행 시점",
                    children: formatCouponTemplateSchedule(
                      selectedTemplate.issueSchedule,
                    ),
                  },
                  {
                    key: "lastIssuedAt",
                    label: "최근 발행",
                    children: selectedTemplate.lastIssuedAt || "아직 없음",
                  },
                  {
                    key: "nextIssuedAt",
                    label: "다음 발행 예정",
                    children: selectedTemplate.nextIssuedAt || "아직 없음",
                  },
                  {
                    key: "issuedCouponCount",
                    label: "누적 발행 쿠폰",
                    children: `${selectedTemplate.issuedCouponCount.toLocaleString()}장`,
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="알림 설정">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "alertSummary",
                    label: "알림 요약",
                    children: getCouponTemplateAlertSummary(selectedTemplate),
                  },
                  {
                    key: "issueAlertEnabled",
                    label: "발급 알림",
                    children: selectedTemplate.issueAlertEnabled
                      ? "사용"
                      : "미사용",
                  },
                  {
                    key: "expireAlertEnabled",
                    label: "소멸 알림",
                    children: selectedTemplate.expireAlertEnabled
                      ? "사용"
                      : "미사용",
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="운영 메모 / 정책 메모">
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                  {selectedTemplate.adminMemo || "운영 메모가 없습니다."}
                </Paragraph>
                <Card size="small" title="정책 메모">
                  <Space direction="vertical" size={8}>
                    {selectedTemplate.policyNotes.map((policyNote) => (
                      <Text key={policyNote}>{policyNote}</Text>
                    ))}
                  </Space>
                </Card>
              </Space>
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}
      </DetailDrawer>

      <Modal
        open={createTypeModalOpen}
        title="쿠폰 유형 선택"
        footer={null}
        destroyOnHidden
        onCancel={() => setCreateTypeModalOpen(false)}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {couponKindCardItems.map((item) => (
            <CouponTypeSelectionCard
              key={item.value}
              title={item.title}
              description={item.description}
              onSelect={() => openCreatePage(item.value)}
            />
          ))}
          <Text type="secondary">
            Tip. 어떤 쿠폰을 만들어야 할지 고민될 때는 운영 가이드와 실제 아임웹
            정책을 함께 확인해 주세요.
          </Text>
        </Space>
      </Modal>
    </div>
  );
}
