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
  { text: "怨좉컼 ?ㅼ슫濡쒕뱶", value: "customerDownload" },
  { text: "?먮룞 諛쒗뻾", value: "autoIssue" },
  { text: "荑좏룿 肄붾뱶", value: "couponCode" },
  { text: "吏??諛쒗뻾", value: "manualIssue" },
] as const;

const couponStatusColumnFilterOptions = [
  { text: "대기, value: "대기 },
  { text: "吏꾪뻾 以?, value: "吏꾪뻾 以? },
  { text: "醫낅즺", value: "醫낅즺" },
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
  if (value === "대기) {
    return "waiting";
  }

  if (value === "吏꾪뻾 以?) {
    return "active";
  }

  if (value === "醫낅즺") {
    return "ended";
  }

  return null;
}

function getStatusFilterValue(statusTab: CouponStatusTab): string | null {
  if (statusTab === "waiting") {
    return "대기;
  }

  if (statusTab === "active") {
    return "吏꾪뻾 以?;
  }

  if (statusTab === "ended") {
    return "醫낅즺";
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
    return coupon.couponStatus === "대기;
  }

  if (statusTab === "active") {
    return coupon.couponStatus === "吏꾪뻾 以?;
  }

  return coupon.couponStatus === "醫낅즺";
}

function matchesCouponTemplateStatusTab(
  template: CommerceCouponSubscriptionTemplate,
  statusTab: CouponTemplateStatusTab,
): boolean {
  if (statusTab === "all") {
    return true;
  }

  if (statusTab === "active") {
    return template.status === "吏꾪뻾 以?;
  }

  return template.status === "諛쒗뻾 以묒?";
}

function getDangerCopy(state: NonNullable<CouponDangerState>) {
  const entityLabel = state.entity === "coupon" ? "荑좏룿" : "?뺢린 荑좏룿 ?쒗뵆由?;

  if (state.type === "pause") {
    return {
      title: `${entityLabel} 諛쒗뻾??以묒??좉퉴??`,
      description:
        "?몄젣?좎? ?ㅼ떆 諛쒗뻾???ш컻?????덉뼱?? 以묒? 사유瑜?湲곕줉??二쇱꽭??",
      confirmText: "諛쒗뻾 以묒?",
      successMessage: `${entityLabel} 諛쒗뻾??以묒??덉뼱??,
    };
  }

  if (state.type === "resume") {
    return {
      title: `${entityLabel} 諛쒗뻾???ш컻?좉퉴??`,
      description:
        "?ш컻 ?꾩뿉??湲곗〈 諛쒗뻾 ?뺤콉怨?알림 ?ㅼ젙???ㅼ떆 ?곸슜?⑸땲?? ?ш컻 사유瑜?湲곕줉??二쇱꽭??",
      confirmText: "諛쒗뻾 ?ш컻",
      successMessage: `${entityLabel} 諛쒗뻾???ш컻?덉뼱??,
    };
  }

  return {
    title: `${entityLabel}????젣?좉퉴??`,
    description: "??젣?섎㈃ 蹂듦뎄?????놁쑝???ㅼ떆 ??踰??뺤씤??二쇱꽭??",
    confirmText: "??젣",
    successMessage: `${entityLabel}????젣?덉뼱??,
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
            ? "荑좏룿 ?앹꽦?덉뼱??
            : "荑좏룿 ?섏젙?덉뼱??,
        description: (
          <Space direction="vertical">
            <Text>대상?좏삎: 荑좏룿</Text>
            <Text>대상ID: {state.commerceCouponSaved.couponId}</Text>
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
            ? "?뺢린 荑좏룿 ?쒗뵆由우쓣 ?앹꽦?덉뼱??
            : "?뺢린 荑좏룿 ?쒗뵆由우쓣 ?섏젙?덉뼱??,
        description: (
          <Space direction="vertical">
            <Text>대상?좏삎: ?뺢린 荑좏룿 ?쒗뵆由?/Text>
            <Text>대상ID: {state.commerceCouponTemplateSaved.templateId}</Text>
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
        (coupon) => coupon.couponStatus === "대기,
      ).length,
      active: couponsState.data.filter(
        (coupon) => coupon.couponStatus === "吏꾪뻾 以?,
      ).length,
      ended: couponsState.data.filter(
        (coupon) => coupon.couponStatus === "醫낅즺",
      ).length,
    }),
    [couponsState.data],
  );

  const couponMainTabItems = useMemo<NonNullable<TabsProps["items"]>>(
    () => [
      { key: "list", label: "荑좏룿 紐⑸줉" },
      { key: "subscriptionTemplate", label: "?뺢린 荑좏룿 ?쒗뵆由? },
    ],
    [],
  );
  const couponStatusTabItems = useMemo<NonNullable<TabsProps["items"]>>(
    () => [
      { key: "all", label: `전체 ${statusCounts.all}` },
      { key: "waiting", label: `대기${statusCounts.waiting}` },
      { key: "active", label: `吏꾪뻾 以?${statusCounts.active}` },
      { key: "ended", label: `醫낅즺 ${statusCounts.ended}` },
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
            <Text strong>일반 荑좏룿 留뚮뱾湲?/Text>
          </div>
        ),
        onClick: () => setCreateTypeModalOpen(true),
      },
      {
        key: "subscription-template",
        label: (
          <div className="commerce-coupon-create-menu-item">
            <Text strong>?뺢린 荑좏룿 ?쒗뵆由?留뚮뱾湲?/Text>
            <Text type="secondary">?붾퀎 ?뺢린 諛쒗뻾 荑좏룿 ??/Text>
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
            label: "대기荑좏룿",
            value: `${statusCounts.waiting.toLocaleString()}嫄?,
            active: statusTab === nextStatusTab,
            onClick: () => handleStatusFilterChange(nextStatusTab),
          };
        }

        if (nextStatusTab === "active") {
          return {
            key: item.key,
            label: "吏꾪뻾 以?荑좏룿",
            value: `${statusCounts.active.toLocaleString()}嫄?,
            active: statusTab === nextStatusTab,
            onClick: () => handleStatusFilterChange(nextStatusTab),
          };
        }

        if (nextStatusTab === "ended") {
          return {
            key: item.key,
            label: "醫낅즺 荑좏룿",
            value: `${statusCounts.ended.toLocaleString()}嫄?,
            active: statusTab === nextStatusTab,
            onClick: () => handleStatusFilterChange(nextStatusTab),
          };
        }

        return {
          key: item.key,
          label: "전체 荑좏룿",
          value: `${statusCounts.all.toLocaleString()}嫄?,
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
        (template) => template.status === "吏꾪뻾 以?,
      ).length,
      paused: templatesState.data.filter(
        (template) => template.status === "諛쒗뻾 以묒?",
      ).length,
    }),
    [templatesState.data],
  );
  const couponTemplateSummaryCards = useMemo(
    () => [
      {
        key: "all",
        label: "전체 ?쒗뵆由?,
        value: `${templateStatusCounts.all.toLocaleString()}嫄?,
        active: templateStatusTab === "all",
        onClick: () => handleTemplateStatusFilterChange("all"),
      },
      {
        key: "active",
        label: "吏꾪뻾 以??쒗뵆由?,
        value: `${templateStatusCounts.active.toLocaleString()}嫄?,
        active: templateStatusTab === "active",
        onClick: () => handleTemplateStatusFilterChange("active"),
      },
      {
        key: "paused",
        label: "諛쒗뻾 以묒? ?쒗뵆由?,
        value: `${templateStatusCounts.paused.toLocaleString()}嫄?,
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
              荑좏룿 留뚮뱾湲?              <DownOutlined />
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
          message: "荑좏룿 ?ㅼ슫濡쒕뱶 留곹겕瑜?蹂듭궗?덉뼱??,
          description: (
            <Space direction="vertical">
              <Text>{coupon.downloadUrl}</Text>
              <Text type="secondary">대상ID: {coupon.id}</Text>
            </Space>
          ),
        });
      } catch (error) {
        notificationApi.error({
          message: "荑좏룿 ?ㅼ슫濡쒕뱶 留곹겕瑜?蹂듭궗?섏? 紐삵뻽?댁슂",
          description:
            error instanceof Error
              ? error.message
              : "?대┰蹂대뱶 ?묎렐??실패?덉뒿?덈떎.",
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
          message: "荑좏룿 肄붾뱶瑜?蹂듭궗?덉뼱??,
          description: (
            <Space direction="vertical">
              <Text>{coupon.couponCode}</Text>
              <Text type="secondary">대상ID: {coupon.id}</Text>
            </Space>
          ),
        });
      } catch (error) {
        notificationApi.error({
          message: "荑좏룿 肄붾뱶瑜?蹂듭궗?섏? 紐삵뻽?댁슂",
          description:
            error instanceof Error
              ? error.message
              : "?대┰蹂대뱶 ?묎렐??실패?덉뒿?덈떎.",
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
          message: "荑좏룿 蹂듭젣??실패?덉뼱??,
          description: result.error.message,
        });
        return;
      }

      notificationApi.success({
        message: "荑좏룿??蹂듭젣?덉뼱??,
        description: (
          <Space direction="vertical">
            <Text>대상ID: {result.data.id}</Text>
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
              대상?좏삎:{" "}
              {dangerState.entity === "coupon" ? "荑좏룿" : "?뺢린 荑좏룿 ?쒗뵆由?}
            </Text>
            <Text>대상ID: {targetId}</Text>
            <Text>사유/洹쇨굅: {reason}</Text>
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
          label: "?섏젙",
          onClick: () => openEditPage(coupon),
        },
        {
          key: "duplicate",
          label: "蹂듭젣",
          onClick: () => {
            void handleDuplicateCoupon(coupon);
          },
        },
      ];

      if (coupon.downloadUrl) {
        items.push({
          key: "copy-download-link",
          label: "?ㅼ슫濡쒕뱶 留곹겕 蹂듭궗",
          onClick: () => {
            void handleCopyDownloadLink(coupon);
          },
        });
      }

      if (coupon.couponCode) {
        items.push({
          key: "copy-code",
          label: "肄붾뱶 蹂듭궗",
          onClick: () => {
            void handleCopyCouponCode(coupon);
          },
        });
      }

      items.push({
        key: "delete-coupon",
        danger: true,
        label: "??젣",
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
        label: "?섏젙",
        onClick: () => openTemplateEditPage(template),
      },
      {
        key:
          template.status === "諛쒗뻾 以묒?"
            ? "resume-template"
            : "pause-template",
        label: template.status === "諛쒗뻾 以묒?" ? "諛쒗뻾 ?ш컻" : "諛쒗뻾 以묒?",
        onClick: () =>
          setDangerState({
            entity: "template",
            type: template.status === "諛쒗뻾 以묒?" ? "resume" : "pause",
            template,
          }),
      },
      {
        key: "delete-template",
        label: "??젣",
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
        title: "荑좏룿紐?,
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
        title: "?뺤떇",
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
        title: "諛쒗뻾 ?뺣낫",
        key: "issueSummary",
        width: 188,
        render: (_, record) => <Text>{getCouponIssueSummary(record)}</Text>,
      },
      {
        title: "?쒗깮 / ?ъ슜 議곌굔",
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
        title: "?좏슚 湲곌컙",
        dataIndex: "validitySummary",
        field: "validity",
        width: 172,
        sorter: true,
        sortOrder: sortField === "validity" ? sortOrder : null,
        render: (_, record) => getCouponValiditySummary(record),
      },
      {
        title: createStatusColumnTitle("상태", ["대기, "吏꾪뻾 以?, "醫낅즺"]),
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
        title: "諛쒗뻾 상태",
        key: "issueState",
        width: 132,
        onCell: () => ({
          onClick: (event) => event.stopPropagation(),
        }),
        render: (_, record) =>
          canControlIssueState(record) ? (
            <BinaryStatusSwitch
              checked={record.issueState !== "諛쒗뻾 以묒?"}
              checkedLabel="諛쒗뻾"
              uncheckedLabel="諛쒗뻾 以묒?"
              onToggle={() =>
                setDangerState({
                  entity: "coupon",
                  type: record.issueState === "諛쒗뻾 以묒?" ? "resume" : "pause",
                  coupon: record,
                })
              }
            />
          ) : (
            <Text type="secondary">?대떦 ?놁쓬</Text>
          ),
      },
      {
        title: "諛쒓툒 / ?ъ슜",
        dataIndex: "issueCount",
        field: "issueCount",
        width: 132,
        sorter: true,
        sortOrder: sortField === "issueCount" ? sortOrder : null,
        render: (_, record) =>
          `${record.issueCount.toLocaleString()} / ${record.useCount.toLocaleString()}`,
      },
      {
        title: "?≪뀡",
        key: "actions",
        width: 96,
        onCell: () => ({
          onClick: (event) => event.stopPropagation(),
        }),
        render: (_, record) => (
          <TableActionMenu
            buttonLabel="?붾낫湲?
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
        title: "?쒗뵆由용챸 / ?쒗깮",
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
        title: "荑좏룿 ?ъ슜 醫낅즺??,
        key: "usageEndSchedule",
        width: 180,
        render: (_, record) =>
          formatCouponTemplateSchedule(record.usageEndSchedule),
      },
      { title: "?깅줉??, dataIndex: "createdAt", key: "createdAt", width: 160 },
      {
        title: "?섏젙??,
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
        title: "?≪뀡",
        key: "actions",
        width: 96,
        onCell: () => ({
          onClick: (event) => event.stopPropagation(),
        }),
        render: (_, record) => (
          <TableActionMenu
            buttonLabel="?붾낫湲?
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
      <PageTitle title="荑좏룿" />

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
                mainView === "list" ? "荑좏룿紐? : "?뺢린 荑좏룿紐?
              }
              summary={
                <Text type="secondary">
                  珥?{currentToolbarCount.toLocaleString()}嫄?                </Text>
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
            message="Free 踰꾩쟾? 荑좏룿 1媛쒓퉴吏留??앹꽦?????덉뒿?덈떎."
            description="대상?쒖젏???앹꽦 ?쒗븳??嫄몃━誘濡? ?좏삎蹂??낅젰????작성일?ㅼ뿉???쒗븳 ?ㅻ쪟媛 諛쒖깮?????덉뒿?덈떎."
          />
        ) : null}

        {mainView === "list" && couponsState.status === "error" ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="荑좏룿 紐⑸줉??遺덈윭?ㅼ? 紐삵뻽?댁슂"
            description={
              <Space direction="vertical">
                <Text>
                  {couponsState.errorMessage ?? "?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎."}
                </Text>
                {couponsState.errorCode ? (
                  <Text type="secondary">
                    ?ㅻ쪟 肄붾뱶: {couponsState.errorCode}
                  </Text>
                ) : null}
                {hasCachedCoupons ? (
                  <Text type="secondary">
                    留덉?留?성공 상태瑜??좎???梨?紐⑸줉???뺤씤?????덉뒿?덈떎.
                  </Text>
                ) : null}
              </Space>
            }
            action={
              <Button size="small" onClick={handleReload}>
                ?ㅼ떆 ?쒕룄
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
            message="?뺢린 荑좏룿 ?쒗뵆由?紐⑸줉??遺덈윭?ㅼ? 紐삵뻽?댁슂"
            description={
              <Space direction="vertical">
                <Text>
                  {templatesState.errorMessage ??
                    "?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎."}
                </Text>
                {templatesState.errorCode ? (
                  <Text type="secondary">
                    ?ㅻ쪟 肄붾뱶: {templatesState.errorCode}
                  </Text>
                ) : null}
                {hasCachedTemplates ? (
                  <Text type="secondary">
                    留덉?留?성공 상태瑜??좎???梨?紐⑸줉???뺤씤?????덉뒿?덈떎.
                  </Text>
                ) : null}
              </Space>
            }
            action={
              <Button size="small" onClick={handleReload}>
                ?ㅼ떆 ?쒕룄
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
                message="?좏깮??議곌굔??留욌뒗 ?뺢린 荑좏룿 ?쒗뵆由우씠 ?놁뼱??
                description="寃?됱뼱瑜?議곗젙?댁꽌 ?ㅼ떆 ?뺤씤??二쇱꽭??"
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
                    <Text strong>?앹꽦???뺢린 荑좏룿 ?쒗뵆由우씠 ?놁뼱??/Text>
                    <Text type="secondary">
                      ?뺢린 荑좏룿 ?쒗뵆由우쓣 ?ㅼ젙?섎㈃ 留ㅼ썡 1???ㅼ쟾 7?쒖뿉 ?먮룞?쇰줈
                      荑좏룿??諛쒗뻾?????덉뼱??
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
                    ?꾩쭅 ?앹꽦??荑좏룿???놁뼱??                  </Title>
                  <Text
                    type="secondary"
                    className="commerce-coupon-empty-state__description"
                  >
                    ?좎씤, ?앹씪, 諛곗넚鍮?臾대즺 ???ㅼ뼇??荑좏룿??留뚮뱾??蹂댁꽭??                  </Text>
                  <Button
                    size="large"
                    icon={<QuestionCircleOutlined />}
                    onClick={() => setEmptyGuideOpen((prev) => !prev)}
                  >
                    荑좏룿? ??留뚮뱾?댁빞 ?좉퉴??
                  </Button>
                </Space>
                {emptyGuideOpen ? (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 16, textAlign: "left" }}
                    message="荑좏룿 운영 媛?대뱶"
                    description={
                      <Space direction="vertical" size={4}>
                        <Text>
                          怨좉컼 ?ㅼ슫濡쒕뱶??留곹겕???꾨줈紐⑥뀡???곹빀?⑸땲??
                        </Text>
                        <Text>
                          ?먮룞 諛쒗뻾? 회원媛?? 泥?二쇰Ц, ?앹씪 媛숈? ?몃━嫄곗뿉
                          ?곌껐?⑸땲??
                        </Text>
                        <Text>
                          荑좏룿 肄붾뱶 ?앹꽦? ?몃? 梨꾨꼸 ?쒗쑕???ㅽ봽?쇱씤 罹좏럹?몄뿉
                          ?곹빀?⑸땲??
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
                message="?좏깮??議곌굔??留욌뒗 荑좏룿???놁뼱??
                description="상태 ?? 寃?됱뼱, ?좏슚 湲곌컙??議곗젙?댁꽌 ?ㅼ떆 ?뺤씤??二쇱꽭??"
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
            ? `荑좏룿 상세 쨌 ${selectedCoupon.id}`
            : selectedTemplate
              ? `?뺢린 荑좏룿 ?쒗뵆由?상세 쨌 ${selectedTemplate.id}`
              : "荑좏룿 상세"
        }
        destroyOnHidden
        width={760}
        onClose={closeDetail}
        headerMeta={
          selectedCoupon ? (
            <Space wrap size={8}>
              <StatusBadge status={selectedCoupon.couponStatus} />
              {selectedCoupon.issueState === "諛쒗뻾 以묒?" ? (
                <StatusBadge status={selectedCoupon.issueState} />
              ) : null}
              <Tag color="blue">
                {getCouponKindLabel(selectedCoupon.couponKind)}
              </Tag>
            </Space>
          ) : selectedTemplate ? (
            <Space wrap size={8}>
              <StatusBadge status={selectedTemplate.status} />
              <Tag color="blue">?쇳븨 등급</Tag>
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
                  留곹겕 蹂듭궗
                </Button>
              ) : null}
              {selectedCoupon.couponCode ? (
                <Button
                  size="large"
                  onClick={() => {
                    void handleCopyCouponCode(selectedCoupon);
                  }}
                >
                  肄붾뱶 蹂듭궗
                </Button>
              ) : null}
              <Button size="large" onClick={() => openEditPage(selectedCoupon)}>
                ?섏젙
              </Button>
              {canControlIssueState(selectedCoupon) ? (
                <Button
                  size="large"
                  onClick={() =>
                    setDangerState({
                      entity: "coupon",
                      type:
                        selectedCoupon.issueState === "諛쒗뻾 以묒?"
                          ? "resume"
                          : "pause",
                      coupon: selectedCoupon,
                    })
                  }
                >
                  {selectedCoupon.issueState === "諛쒗뻾 以묒?"
                    ? "諛쒗뻾 ?ш컻"
                    : "諛쒗뻾 以묒?"}
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
                ??젣
              </Button>
            </Space>
          ) : selectedTemplate ? (
            <Space wrap>
              <Button
                size="large"
                onClick={() => openTemplateEditPage(selectedTemplate)}
              >
                ?섏젙
              </Button>
              <Button
                size="large"
                onClick={() =>
                  setDangerState({
                    entity: "template",
                    type:
                      selectedTemplate.status === "諛쒗뻾 以묒?"
                        ? "resume"
                        : "pause",
                    template: selectedTemplate,
                  })
                }
              >
                {selectedTemplate.status === "諛쒗뻾 以묒?"
                  ? "諛쒗뻾 ?ш컻"
                  : "諛쒗뻾 以묒?"}
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
                ??젣
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedCoupon ? (
          <DetailDrawerBody>
            <Alert
              type={
                selectedCoupon.issueState === "諛쒗뻾 以묒?" ? "warning" : "info"
              }
              showIcon
              message={
                selectedCoupon.issueState === "諛쒗뻾 以묒?"
                  ? "?꾩옱 諛쒗뻾 以묒? 상태?낅땲??"
                  : "荑좏룿 운영 상세瑜?鍮좊Ⅴ寃??뺤씤?????덉뒿?덈떎."
              }
              description={
                selectedCoupon.issueState === "諛쒗뻾 以묒?"
                  ? "??λ맂 ?뺤콉? ?좎??섏?留??좉퇋 諛쒗뻾? 以묒??⑸땲?? ?ш컻 ??대상알림 ?뺤콉???④퍡 ?뺤씤??二쇱꽭??"
                  : "?됰룞 ?源? 留곹겕/肄붾뱶, 알림 ?곕룞, ?ъ슜 ?꾪솴源뚯? ??Drawer?먯꽌 諛붾줈 寃?섑븷 ???덉뒿?덈떎."
              }
            />

            <DetailDrawerSection title="湲곕낯 ?뺣낫">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: "id", label: "荑좏룿 ID", children: selectedCoupon.id },
                  {
                    key: "name",
                    label: "荑좏룿紐?,
                    children: selectedCoupon.couponName,
                  },
                  {
                    key: "kind",
                    label: "荑좏룿 ?뺤떇",
                    children: getCouponKindDisplayLabel(selectedCoupon),
                  },
                  {
                    key: "status",
                    label: "상태",
                    children: (
                      <Space wrap>
                        <StatusBadge status={selectedCoupon.couponStatus} />
                        {selectedCoupon.issueState === "諛쒗뻾 以묒?" ? (
                          <StatusBadge status={selectedCoupon.issueState} />
                        ) : null}
                      </Space>
                    ),
                  },
                  {
                    key: "updated",
                    label: "최근 수정",
                    children: `${selectedCoupon.updatedAt} 쨌 ${selectedCoupon.updatedBy}`,
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="?쒗깮 / ?ъ슜 議곌굔">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "benefit",
                    label: "?쒗깮",
                    children: getCouponBenefitSummary(selectedCoupon),
                  },
                  {
                    key: "condition",
                    label: "?ъ슜 議곌굔",
                    children: getCouponConditionSummary(selectedCoupon),
                  },
                  {
                    key: "validity",
                    label: "?좏슚 湲곌컙",
                    children: getCouponValiditySummary(selectedCoupon),
                  },
                  {
                    key: "usageLimit",
                    label: "?ъ슜 ?잛닔",
                    children:
                      selectedCoupon.usageLimitMode === "limited"
                        ? `${selectedCoupon.usageLimit ?? 0}??
                        : "?쒗븳 ?놁쓬",
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="諛쒗뻾 ?뺤콉">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "issueSummary",
                    label: "諛쒗뻾 ?뺣낫",
                    children: getCouponIssueSummary(selectedCoupon),
                  },
                  {
                    key: "secret",
                    label: "?쒗겕由?荑좏룿",
                    children: selectedCoupon.isSecretCoupon
                      ? "?ъ슜"
                      : "?ъ슜 ????,
                  },
                  {
                    key: "issueLimit",
                    label: "諛쒗뻾 ?섎웾",
                    children:
                      selectedCoupon.issueLimitMode === "limited"
                        ? `${selectedCoupon.issueLimit ?? 0}媛?
                        : "?쒗븳 ?놁쓬",
                  },
                  {
                    key: "downloadLimit",
                    label: "?ㅼ슫濡쒕뱶 ?섎웾",
                    children:
                      selectedCoupon.downloadLimitMode === "limited"
                        ? `${selectedCoupon.downloadLimit ?? 0}媛?
                        : "?쒗븳 ?놁쓬",
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="留곹겕 / 肄붾뱶 / ?곕룞">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "downloadUrl",
                    label: "?ㅼ슫濡쒕뱶 留곹겕",
                    children: selectedCoupon.downloadUrl || "?놁쓬",
                  },
                  {
                    key: "couponCode",
                    label: "荑좏룿 肄붾뱶",
                    children: selectedCoupon.couponCode || "?놁쓬",
                  },
                  {
                    key: "linkage",
                    label: "硫붿떆吏/CRM ?곕룞",
                    children: getCouponLinkageSummary(selectedCoupon),
                  },
                  {
                    key: "issueAlert",
                    label: "諛쒓툒 알림",
                    children: getCouponAlertSummary(selectedCoupon.issueAlert),
                  },
                  {
                    key: "expireAlert",
                    label: "?뚮㈇ 알림",
                    children: getCouponAlertSummary(selectedCoupon.expireAlert),
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="?ъ슜 ?꾪솴">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "counts",
                    label: "諛쒓툒 / ?ㅼ슫濡쒕뱶 / ?ъ슜",
                    children: `${selectedCoupon.issueCount.toLocaleString()} / ${selectedCoupon.downloadCount.toLocaleString()} / ${selectedCoupon.useCount.toLocaleString()}`,
                  },
                  {
                    key: "lastIssued",
                    label: "理쒓렐 諛쒓툒",
                    children: selectedCoupon.lastIssuedAt || "?놁쓬",
                  },
                  {
                    key: "lastDownloaded",
                    label: "理쒓렐 ?ㅼ슫濡쒕뱶",
                    children: selectedCoupon.lastDownloadedAt || "?놁쓬",
                  },
                  {
                    key: "lastUsed",
                    label: "理쒓렐 ?ъ슜",
                    children: selectedCoupon.lastUsedAt || "?놁쓬",
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="운영 硫붾え / ?뺤콉 硫붾え">
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                  {selectedCoupon.adminMemo || "운영 硫붾え媛 ?놁뒿?덈떎."}
                </Paragraph>
                <Card size="small" title="?뺤콉 硫붾え">
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
                selectedTemplate.status === "諛쒗뻾 以묒?" ? "warning" : "info"
              }
              showIcon
              message={
                selectedTemplate.status === "諛쒗뻾 以묒?"
                  ? "?꾩옱 ?뺢린 諛쒗뻾 以묒? 상태?낅땲??"
                  : "留ㅼ썡 ?먮룞 諛쒗뻾 ?뺤콉??諛붾줈 寃?섑븷 ???덉뒿?덈떎."
              }
              description={
                selectedTemplate.status === "諛쒗뻾 以묒?"
                  ? "湲곗〈 諛쒓툒 荑좏룿? ?좎??섍퀬, ?댄썑 諛쒓툒遺꾨쭔 硫덉땅?덈떎. ?ш컻 ?꾩뿉 대상등급怨?알림 ?뺤콉???④퍡 ?뺤씤??二쇱꽭??"
                  : "諛쒗뻾 대상 ?쒗깮, ?ъ슜 醫낅즺?? 알림 ?ㅼ젙????Drawer?먯꽌 ?④퍡 寃?좏븷 ???덉뒿?덈떎."
              }
            />

            <DetailDrawerSection title="湲곕낯 ?뺣낫">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "id",
                    label: "?쒗뵆由?ID",
                    children: selectedTemplate.id,
                  },
                  {
                    key: "name",
                    label: "?뺢린 荑좏룿紐?,
                    children: selectedTemplate.templateName,
                  },
                  {
                    key: "status",
                    label: "상태",
                    children: <StatusBadge status={selectedTemplate.status} />,
                  },
                  {
                    key: "issueTarget",
                    label: "諛쒗뻾 대상,
                    children:
                      getCouponTemplateIssueTargetSummary(selectedTemplate),
                  },
                  {
                    key: "updated",
                    label: "최근 수정",
                    children: `${selectedTemplate.updatedAt} 쨌 ${selectedTemplate.updatedBy}`,
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="?쒗깮 / ?ъ슜 議곌굔">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "benefit",
                    label: "?쒗깮",
                    children: getCouponTemplateBenefitSummary(selectedTemplate),
                  },
                  {
                    key: "condition",
                    label: "?ъ슜 議곌굔",
                    children:
                      getCouponTemplateConditionSummary(selectedTemplate),
                  },
                  {
                    key: "scope",
                    label: "荑좏룿 ?곸슜 踰붿쐞",
                    children: getCouponTemplateScopeSummary(selectedTemplate),
                  },
                  {
                    key: "usageEnd",
                    label: "荑좏룿 ?ъ슜 醫낅즺??,
                    children: formatCouponTemplateSchedule(
                      selectedTemplate.usageEndSchedule,
                    ),
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="諛쒗뻾 ?뺤콉">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "issueSchedule",
                    label: "?뺢린 諛쒗뻾 ?쒖젏",
                    children: formatCouponTemplateSchedule(
                      selectedTemplate.issueSchedule,
                    ),
                  },
                  {
                    key: "lastIssuedAt",
                    label: "理쒓렐 諛쒗뻾",
                    children: selectedTemplate.lastIssuedAt || "?꾩쭅 ?놁쓬",
                  },
                  {
                    key: "nextIssuedAt",
                    label: "?ㅼ쓬 諛쒗뻾 ?덉젙",
                    children: selectedTemplate.nextIssuedAt || "?꾩쭅 ?놁쓬",
                  },
                  {
                    key: "issuedCouponCount",
                    label: "?꾩쟻 諛쒗뻾 荑좏룿",
                    children: `${selectedTemplate.issuedCouponCount.toLocaleString()}??,
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="알림 ?ㅼ젙">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: "alertSummary",
                    label: "알림 ?붿빟",
                    children: getCouponTemplateAlertSummary(selectedTemplate),
                  },
                  {
                    key: "issueAlertEnabled",
                    label: "諛쒓툒 알림",
                    children: selectedTemplate.issueAlertEnabled
                      ? "?ъ슜"
                      : "誘몄궗??,
                  },
                  {
                    key: "expireAlertEnabled",
                    label: "?뚮㈇ 알림",
                    children: selectedTemplate.expireAlertEnabled
                      ? "?ъ슜"
                      : "誘몄궗??,
                  },
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="운영 硫붾え / ?뺤콉 硫붾え">
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                  {selectedTemplate.adminMemo || "운영 硫붾え媛 ?놁뒿?덈떎."}
                </Paragraph>
                <Card size="small" title="?뺤콉 硫붾え">
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
        title="荑좏룿 ?좏삎 ?좏깮"
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
            Tip. ?대뼡 荑좏룿??留뚮뱾?댁빞 ?좎? 怨좊????뚮뒗 운영 媛?대뱶? ?ㅼ젣 ?꾩엫??            ?뺤콉???④퍡 ?뺤씤??二쇱꽭??
          </Text>
        </Space>
      </Modal>
    </div>
  );
}


