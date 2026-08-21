import { Button, Dropdown, Modal, Space, Typography, notification } from "antd";
import type { MenuProps, TableColumnsType, TableProps, TabsProps } from "antd";
import { DownOutlined, PlusOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  fetchCouponPlanTierSafe,
  fetchCouponsSafe,
  fetchCouponTemplatesSafe,
} from "../api/coupons-service";
import type { CouponPlanTier } from "../api/coupons-service";
import {
  buildCouponStatusSummaryCards,
  buildCouponTemplateSummaryCards,
  filterAndSortCoupons,
  filterCouponTemplates,
  getCouponStatusCounts,
  getCouponTemplateStatusCounts,
  getDangerCopy,
  parseCouponKindFilter,
  parseMainView,
  parseSortField,
  parseStatusFilterValue,
  parseStatusTab,
  parseTemplateStatusTab,
} from "../model/commerce-coupons-page-schema";
import type {
  CouponDangerState,
  CouponSearchField,
  CouponTemplateStatusTab,
} from "../model/commerce-coupons-page-schema";
import { couponKindCardItems } from "../model/coupon-form-schema";
import type { CommerceCouponSubscriptionTemplate } from "../model/coupon-template-types";
import type {
  CommerceCoupon,
  CouponStatusTab,
} from "../model/coupon-types";
import type { CouponActionContext } from "../ui/commerce-coupons-actions";
import {
  runCopyCouponCode,
  runCopyDownloadLink,
  runDangerConfirm,
  runDuplicateCoupon,
} from "../ui/commerce-coupons-actions";
import {
  createCouponColumns,
  createCouponTemplateColumns,
} from "../ui/commerce-coupons-columns";
import { CommerceCouponsDetailDrawer } from "../ui/commerce-coupons-detail-drawer";
import { CommerceCouponsListSection } from "../ui/commerce-coupons-list-section";
import { CouponTypeSelectionCard } from "../ui/commerce-coupon-type-card";
import type { AsyncState } from "@/shared/model/async-state";
import { useRouterStateNotice } from "@/shared/model/use-router-state-notice";
import { AuditLogLink } from "@/shared/ui/audit-log-link/audit-log-link";
import { ConfirmAction } from "@/shared/ui/confirm-action/confirm-action";
import {
  isInitialSummaryLoad,
  ListSummaryCards,
} from "@/shared/ui/list-summary-cards/list-summary-cards";
import { PageTitle } from "@/shared/ui/page-title/page-title";
import { parseSortOrder } from '@/shared/ui/table/table-column-utils';

const { Text } = Typography;


export default function CommerceCouponsPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [planTier, setPlanTier] = useState<CouponPlanTier>("pro");
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
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();

  useEffect(() => {
    let mounted = true;

    void fetchCouponPlanTierSafe().then((result) => {
      if (mounted && result.ok) {
        setPlanTier(result.data);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

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

  // 생산자는 두 키 중 하나만 싣는다 — 키마다 훅을 한 번씩 호출한다.
  useRouterStateNotice(
    "commerceCouponSaved",
    (saved) => `coupon:${saved.mode}:${saved.couponId}`,
    (saved) => {
      notificationApi.success({
        message: saved.mode === "create" ? "쿠폰 생성했어요" : "쿠폰 수정했어요",
        description: (
          <Space direction="vertical">
            <Text>대상 유형: 쿠폰</Text>
            <Text>대상 ID: {saved.couponId}</Text>
            <AuditLogLink targetType="CommerceCoupon" targetId={saved.couponId} />
          </Space>
        ),
      });
    },
  );

  useRouterStateNotice(
    "commerceCouponTemplateSaved",
    (saved) => `template:${saved.mode}:${saved.templateId}`,
    (saved) => {
      notificationApi.success({
        message:
          saved.mode === "create"
            ? "정기 쿠폰 템플릿을 생성했어요"
            : "정기 쿠폰 템플릿을 수정했어요",
        description: (
          <Space direction="vertical">
            <Text>대상 유형: 정기 쿠폰 템플릿</Text>
            <Text>대상 ID: {saved.templateId}</Text>
            <AuditLogLink
              targetType="CommerceCouponTemplate"
              targetId={saved.templateId}
            />
          </Space>
        ),
      });
    },
  );

  const filteredCoupons = useMemo(
    () =>
      filterAndSortCoupons(
        couponsState.data,
        keyword,
        searchField,
        statusTab,
        couponKindFilter,
        sortField,
        sortOrder,
      ),
    [
      couponKindFilter,
      couponsState.data,
      keyword,
      searchField,
      sortField,
      sortOrder,
      statusTab,
    ],
  );

  const filteredTemplates = useMemo(
    () => filterCouponTemplates(templatesState.data, keyword, templateStatusTab),
    [keyword, templateStatusTab, templatesState.data],
  );

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
    () => getCouponStatusCounts(couponsState.data),
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
      buildCouponStatusSummaryCards(
        couponStatusTabItems,
        statusCounts,
        statusTab,
        handleStatusFilterChange,
      ),
    [couponStatusTabItems, handleStatusFilterChange, statusCounts, statusTab],
  );
  const templateStatusCounts = useMemo(
    () => getCouponTemplateStatusCounts(templatesState.data),
    [templatesState.data],
  );
  const couponTemplateSummaryCards = useMemo(
    () =>
      buildCouponTemplateSummaryCards(
        templateStatusCounts,
        templateStatusTab,
        handleTemplateStatusFilterChange,
      ),
    [handleTemplateStatusFilterChange, templateStatusCounts, templateStatusTab],
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

  const actionContext = useMemo<CouponActionContext>(
    () => ({
      notificationApi,
      navigate,
      listSearch,
      setCouponsState,
      setTemplatesState,
      setDangerState,
      closeDetail,
    }),
    [closeDetail, listSearch, navigate, notificationApi],
  );

  const handleCopyDownloadLink = useCallback(
    async (coupon: CommerceCoupon) => runCopyDownloadLink(actionContext, coupon),
    [actionContext],
  );

  const handleCopyCouponCode = useCallback(
    async (coupon: CommerceCoupon) => runCopyCouponCode(actionContext, coupon),
    [actionContext],
  );

  const handleDuplicateCoupon = useCallback(
    async (coupon: CommerceCoupon) => runDuplicateCoupon(actionContext, coupon),
    [actionContext],
  );

  const handleDangerConfirm = useCallback(
    async (reason: string) =>
      runDangerConfirm(actionContext, dangerState, selectedDetailId, reason),
    [actionContext, dangerState, selectedDetailId],
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


  const columns = useMemo<TableColumnsType<CommerceCoupon>>(
    () =>
      createCouponColumns({
        sortField,
        sortOrder,
        couponKindFilter,
        statusTab,
        openEditPage,
        handleDuplicateCoupon,
        handleCopyDownloadLink,
        handleCopyCouponCode,
        setDangerState,
      }),
    [
      couponKindFilter,
      handleCopyCouponCode,
      handleCopyDownloadLink,
      handleDuplicateCoupon,
      openEditPage,
      sortField,
      sortOrder,
      statusTab,
    ],
  );
  const subscriptionTemplateColumns = useMemo<
    TableColumnsType<CommerceCouponSubscriptionTemplate>
  >(
    () =>
      createCouponTemplateColumns({
        openTemplateEditPage,
        setDangerState,
      }),
    [openTemplateEditPage],
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
        loading={
          mainView === "list"
            ? isInitialSummaryLoad(couponsState.status, hasCachedCoupons)
            : isInitialSummaryLoad(templatesState.status, hasCachedTemplates)
        }
      />
      <CommerceCouponsListSection
        mainView={mainView}
        searchField={searchField}
        keyword={keyword}
        commitParams={commitParams}
        couponMainTabItems={couponMainTabItems}
        currentToolbarCount={currentToolbarCount}
        couponToolbarActions={couponToolbarActions}
        planTier={planTier}
        couponsState={couponsState}
        templatesState={templatesState}
        hasCachedCoupons={hasCachedCoupons}
        hasCachedTemplates={hasCachedTemplates}
        isFilteredEmpty={isFilteredEmpty}
        isTemplateFilteredEmpty={isTemplateFilteredEmpty}
        filteredCoupons={filteredCoupons}
        filteredTemplates={filteredTemplates}
        columns={columns}
        subscriptionTemplateColumns={subscriptionTemplateColumns}
        handleTableChange={handleTableChange}
        openDetail={openDetail}
        handleReload={handleReload}
      />

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

      <CommerceCouponsDetailDrawer
        selectedCoupon={selectedCoupon}
        selectedTemplate={selectedTemplate}
        closeDetail={closeDetail}
        handleCopyDownloadLink={handleCopyDownloadLink}
        handleCopyCouponCode={handleCopyCouponCode}
        openEditPage={openEditPage}
        openTemplateEditPage={openTemplateEditPage}
        setDangerState={setDangerState}
      />

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
