import { Alert, Button, Space, Tabs, Typography } from "antd";
import type { TableColumnsType, TableProps, TabsProps } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import type { CouponSearchField } from "../model/commerce-coupons-page-schema";
import type { CommerceCouponSubscriptionTemplate } from "../model/coupon-template-types";
import type {
  CommerceCoupon,
  CouponMainView,
} from "../model/coupon-types";
import type { AsyncState } from "@/shared/model/async-state";
import { AdminListCard } from "@/shared/ui/list-page-card/admin-list-card";
import { SearchBar } from "@/shared/ui/search-bar/search-bar";
import { AdminDataTable } from "@/shared/ui/table/admin-data-table";
import type { CouponPlanTier } from "../api/coupons-service";

const { Text, Title } = Typography;

// 쿠폰 목록 섹션 — 메인 탭+검색 툴바+상태 알림+테이블 2종을 Phase 4 분해로 페이지에서
// 이동(동작 동일). URL 값·커밋 콜백·목록 데이터·컬럼은 페이지가 소유하고,
// 빈 목록 가이드 토글과 무동작 검색 필드 콜백은 입력 UX 로 섹션 내부에서 관리한다.
export type CommerceCouponsListSectionProps = {
  mainView: CouponMainView;
  searchField: CouponSearchField;
  keyword: string;
  commitParams: (
    next: Partial<Record<"view" | "keyword" | "selected", string | null>>,
  ) => void;
  couponMainTabItems: NonNullable<TabsProps["items"]>;
  currentToolbarCount: number;
  couponToolbarActions: ReactNode;
  planTier: CouponPlanTier;
  couponsState: AsyncState<CommerceCoupon[]>;
  templatesState: AsyncState<CommerceCouponSubscriptionTemplate[]>;
  hasCachedCoupons: boolean;
  hasCachedTemplates: boolean;
  isFilteredEmpty: boolean;
  isTemplateFilteredEmpty: boolean;
  filteredCoupons: CommerceCoupon[];
  filteredTemplates: CommerceCouponSubscriptionTemplate[];
  columns: TableColumnsType<CommerceCoupon>;
  subscriptionTemplateColumns: TableColumnsType<CommerceCouponSubscriptionTemplate>;
  handleTableChange: NonNullable<TableProps<CommerceCoupon>["onChange"]>;
  openDetail: (couponId: string) => void;
  handleReload: () => void;
};

export function CommerceCouponsListSection({
  mainView,
  searchField,
  keyword,
  commitParams,
  couponMainTabItems,
  currentToolbarCount,
  couponToolbarActions,
  planTier,
  couponsState,
  templatesState,
  hasCachedCoupons,
  hasCachedTemplates,
  isFilteredEmpty,
  isTemplateFilteredEmpty,
  filteredCoupons,
  filteredTemplates,
  columns,
  subscriptionTemplateColumns,
  handleTableChange,
  openDetail,
  handleReload,
}: CommerceCouponsListSectionProps): JSX.Element {
  const [emptyGuideOpen, setEmptyGuideOpen] = useState(false);

  const handleSearchFieldChange = useCallback(() => undefined, []);

  return (
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
  );
}
