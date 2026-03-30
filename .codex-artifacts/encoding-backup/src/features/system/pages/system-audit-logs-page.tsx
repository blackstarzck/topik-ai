import { Typography } from "antd";
import type { TableColumnsType } from "antd";
import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getMockUserById } from "../../users/api/mock-users";
import { getTargetTypeLabel } from "../../../shared/model/target-type-label";
import { AdminListCard } from "../../../shared/ui/list-page-card/admin-list-card";
import { ListSummaryCards } from "../../../shared/ui/list-summary-cards/list-summary-cards";
import { PageTitle } from "../../../shared/ui/page-title/page-title";
import { AdminDataTable } from "../../../shared/ui/table/admin-data-table";
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField,
} from "../../../shared/ui/search-bar/search-bar";
import { useSearchBarDateDraft } from "../../../shared/ui/search-bar/use-search-bar-date-draft";
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate,
} from "../../../shared/ui/search-bar/search-bar-utils";
import { createTextSorter } from "../../../shared/ui/table/table-column-utils";
import { TableRowDetailModal } from "../../../shared/ui/table/table-row-detail-modal";
import {
  formatUserDisplayName,
  UserNavigationLink,
} from "../../../shared/ui/user/user-reference";
import { useCouponStore } from "../../commerce/model/coupon-store";
import { usePermissionStore } from "../model/permission-store";
import { useSystemMetadataStore } from "../model/system-metadata-store";

const { Paragraph, Text } = Typography;

type AuditLogRow = {
  logId: string;
  targetType: string;
  targetId: string;
  action: string;
  actor: string;
  reason: string;
  createdAt: string;
};

const detailLabelMap: Record<string, string> = {
  logId: "로그 ID",
  targetType: "대상?좏삎",
  targetId: "대상ID",
  action: "議곗튂",
  actor: "수행자,
  reason: "사유/洹쇨굅",
  createdAt: "시각",
};

const staticRows: AuditLogRow[] = [
  {
    logId: "AL-10001",
    targetType: "Users",
    targetId: "U00001",
    action: "회원 정지",
    actor: "admin_park",
    reason: "?뺤콉 ?꾨컲 諛섎났",
    createdAt: "2026-03-11 09:42:10",
  },
  {
    logId: "AL-10002",
    targetType: "Commerce",
    targetId: "RF-002",
    action: "환불 ?뱀씤",
    actor: "admin_kim",
    reason: "?쒕퉬??誘몄씠???뺤씤",
    createdAt: "2026-03-11 10:15:02",
  },
  {
    logId: "AL-10003",
    targetType: "Community",
    targetId: "POST-002",
    action: "게시글 숨김",
    actor: "admin_lee",
    reason: "?뺤콉 ?꾨컲 콘텐츠,
    createdAt: "2026-03-11 10:33:51",
  },
  {
    logId: "AL-10004",
    targetType: "Message",
    targetId: "MAIL-001",
    action: "硫붿씪 발송",
    actor: "admin_han",
    reason: "?섎룞 ?댁뒪?덊꽣 발송",
    createdAt: "2026-03-11 17:15:00",
  },
  {
    logId: "AL-10005",
    targetType: "Instructor",
    targetId: "INS-0007",
    action: "媛뺤궗 정지",
    actor: "admin_park",
    reason: "운영 ?뺤콉 ?꾨컲 ?뺤씤",
    createdAt: "2026-03-12 10:05:14",
  },
  {
    logId: "AL-10006",
    targetType: "Referral",
    targetId: "REF-0001",
    action: "異붿쿇 肄붾뱶 鍮꾪솢?깊솕",
    actor: "admin_kim",
    reason: "?댁긽移?寃?????꾩떆 鍮꾪솢?깊솕",
    createdAt: "2026-03-12 13:22:09",
  },
  {
    logId: "AL-10007",
    targetType: "Referral",
    targetId: "REF-0007",
    action: "蹂댁긽 ?섎룞 議곗젙",
    actor: "admin_park",
    reason: "운영 寃?????섎룞 蹂댁젙",
    createdAt: "2026-03-12 17:48:33",
  },
];

function getTargetRoute(targetType: string, targetId: string): string | null {
  if (targetType === "Users") {
    return `/users/${targetId}?tab=profile`;
  }
  if (targetType === "Instructor") {
    return `/users/groups?selected=${targetId}`;
  }
  if (targetType === "Referral") {
    return `/users/referrals?selected=${targetId}`;
  }
  if (targetType === "Community") {
    return "/community/posts";
  }
  if (targetType === "Billing" || targetType === "Commerce") {
    if (targetId.startsWith("RF-")) {
      return `/commerce/refunds?keyword=${targetId}`;
    }
    return `/commerce/payments?keyword=${targetId}`;
  }
  if (targetType === "CommerceCoupon") {
    return `/commerce/coupons?selected=${targetId}`;
  }
  if (targetType === "CommerceCouponTemplate") {
    return `/commerce/coupons?view=subscriptionTemplate&selected=${targetId}`;
  }
  if (targetType === "Notification" || targetType === "Message") {
    if (targetId.startsWith("MAIL-")) {
      return "/messages/mail?tab=auto";
    }
    if (targetId.startsWith("PUSH-")) {
      return "/messages/push?tab=auto";
    }
    if (targetId.startsWith("GRP-")) {
      return "/messages/groups";
    }
    return "/messages/history?channel=mail";
  }
  if (targetType === "Operation") {
    if (targetId.startsWith("EVT-")) {
      return `/operation/events?selected=${targetId}`;
    }
    if (targetId.startsWith("FAQ-")) {
      return `/operation/faq?selected=${targetId}`;
    }
    if (targetId.startsWith("NOTICE-")) {
      return `/operation/notices?preview=${targetId}`;
    }
    return "/operation/notices";
  }
  if (targetType === "OperationPolicy") {
    return `/operation/policies?selected=${targetId}`;
  }
  if (targetType === "SystemMetadataGroup") {
    return `/system/metadata?selected=${targetId}`;
  }
  if (targetType === "Assessment") {
    if (targetId.startsWith("EPS-")) {
      return "/assessment/question-bank/eps-topik";
    }
    if (targetId.startsWith("LVT-")) {
      return "/assessment/level-tests";
    }
    return "/assessment/question-bank";
  }
  if (targetType === "Content") {
    if (targetId.startsWith("VOC-SON-")) {
      return "/content/vocabulary/sonagi";
    }
    if (targetId.startsWith("VOC-MC-")) {
      return "/content/vocabulary/multiple-choice";
    }
    if (targetId.startsWith("VOC-")) {
      return "/content/vocabulary";
    }
    if (targetId.startsWith("BADGE-")) {
      return "/content/badges";
    }
    if (targetId.startsWith("MISSION-")) {
      return "/content/missions";
    }
    return "/content/library";
  }
  if (targetType === "Admin" || targetType === "System") {
    return `/system/admins?keyword=${targetId}`;
  }
  return null;
}

function getAuditTargetDisplay(record: AuditLogRow): string {
  if (record.targetType !== "Users") {
    return record.targetId;
  }

  const userName = getMockUserById(record.targetId)?.realName;
  return userName
    ? formatUserDisplayName(userName, record.targetId)
    : record.targetId;
}

export default function SystemAuditLogsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRow, setSelectedRow] = useState<AuditLogRow | null>(null);
  const permissionAudits = usePermissionStore((state) => state.audits);
  const couponAudits = useCouponStore((state) => state.audits);
  const metadataAudits = useSystemMetadataStore((state) => state.audits);
  const targetTypeFilter = searchParams.get("targetType") ?? "";
  const targetIdFilter = searchParams.get("targetId") ?? "";
  const searchField = searchParams.get("searchField") ?? "all";
  const startDate = parseSearchDate(searchParams.get("startDate"));
  const endDate = parseSearchDate(searchParams.get("endDate"));
  const keyword = searchParams.get("keyword") ?? "";
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange,
  } = useSearchBarDateDraft(startDate, endDate);
  const mergedRows = useMemo(() => {
    const permissionRows: AuditLogRow[] = permissionAudits.map((audit) => ({
      logId: audit.id,
      targetType: audit.targetType,
      targetId: audit.targetId,
      action: audit.action,
      actor: audit.changedBy,
      reason: audit.reason,
      createdAt: audit.createdAt,
    }));

    const couponRows: AuditLogRow[] = couponAudits.map((audit) => ({
      logId: audit.id,
      targetType: audit.targetType,
      targetId: audit.targetId,
      action: audit.action,
      actor: audit.changedBy,
      reason: audit.reason,
      createdAt: audit.createdAt,
    }));

    const metadataRows: AuditLogRow[] = metadataAudits.map((audit) => ({
      logId: audit.id,
      targetType: audit.targetType,
      targetId: audit.targetId,
      action: audit.action,
      actor: audit.changedBy,
      reason: audit.reason,
      createdAt: audit.createdAt,
    }));

    return [...metadataRows, ...couponRows, ...permissionRows, ...staticRows].sort(
      (left, right) => right.createdAt.localeCompare(left.createdAt),
    );
  }, [couponAudits, metadataAudits, permissionAudits]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return mergedRows.filter((item) => {
      if (targetTypeFilter && item.targetType !== targetTypeFilter) {
        return false;
      }
      if (targetIdFilter && item.targetId !== targetIdFilter) {
        return false;
      }
      if (!matchesSearchDateRange(item.createdAt, startDate, endDate)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        logId: item.logId,
        targetId: getAuditTargetDisplay(item),
        reason: item.reason,
        actor: item.actor,
        action: item.action,
      });
    });
  }, [
    endDate,
    keyword,
    mergedRows,
    searchField,
    startDate,
    targetIdFilter,
    targetTypeFilter,
  ]);

  const selectedDetailRecord = useMemo(
    () =>
      selectedRow
        ? {
            ...selectedRow,
            targetId: getAuditTargetDisplay(selectedRow),
          }
        : null,
    [selectedRow],
  );

  const commitParams = useCallback(
    (
      next: Partial<
        Record<"keyword" | "searchField" | "startDate" | "endDate", string>
      >,
    ) => {
      const merged = new URLSearchParams(searchParams);
      merged.delete("targetType");
      merged.delete("targetId");
      merged.delete("actor");
      merged.delete("action");

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

  const handleApplyDateRange = useCallback(() => {
    commitParams({
      startDate: draftStartDate,
      endDate: draftEndDate,
      keyword,
      searchField,
    });
  }, [commitParams, draftEndDate, draftStartDate, keyword, searchField]);

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todayCount = filteredRows.filter((row) =>
    row.createdAt.startsWith(todayPrefix),
  ).length;
  const adminAuditCount = filteredRows.filter(
    (row) => row.targetType === "Admin",
  ).length;
  const commerceAuditCount = filteredRows.filter((row) =>
    row.targetType.startsWith("Commerce"),
  ).length;
  const auditSummaryCards = useMemo(
    () => [
      {
        key: "filtered-audits",
        label: "?꾩옱 寃곌낵",
        value: `${filteredRows.length.toLocaleString()}嫄?,
      },
      {
        key: "admin-audits",
        label: "沅뚰븳 蹂寃?로그",
        value: `${adminAuditCount.toLocaleString()}嫄?,
      },
      {
        key: "today-audits",
        label: "?ㅻ뒛 ?앹꽦 로그",
        value: `${todayCount.toLocaleString()}嫄?,
      },
    ],
    [adminAuditCount, filteredRows.length, todayCount],
  );

  const columns = useMemo<TableColumnsType<AuditLogRow>>(
    () => [
      {
        title: "로그 ID",
        dataIndex: "logId",
        width: 130,
        sorter: createTextSorter((record) => record.logId),
      },
      {
        title: "대상?좏삎",
        dataIndex: "targetType",
        width: 130,
        sorter: createTextSorter((record) =>
          getTargetTypeLabel(record.targetType),
        ),
        render: (value: string) => getTargetTypeLabel(value),
      },
      {
        title: "대상ID",
        dataIndex: "targetId",
        width: 160,
        sorter: createTextSorter((record) => getAuditTargetDisplay(record)),
        render: (value: string, record) => {
          const route = getTargetRoute(record.targetType, value);
          if (!route) {
            return getAuditTargetDisplay(record);
          }

          if (record.targetType === "Users") {
            const userName = getMockUserById(value)?.realName;
            if (userName) {
              return (
                <UserNavigationLink
                  stopPropagation
                  userId={value}
                  userName={userName}
                />
              );
            }
          }

          return (
            <Link
              className="table-navigation-link"
              to={route}
              onClick={(event) => event.stopPropagation()}
            >
              {getAuditTargetDisplay(record)}
            </Link>
          );
        },
      },
      {
        title: "議곗튂",
        dataIndex: "action",
        width: 150,
        sorter: createTextSorter((record) => record.action),
      },
      {
        title: "수행자,
        dataIndex: "actor",
        width: 130,
        sorter: createTextSorter((record) => record.actor),
      },
      {
        title: "사유/洹쇨굅",
        dataIndex: "reason",
        sorter: createTextSorter((record) => record.reason),
      },
      {
        title: "시각",
        dataIndex: "createdAt",
        width: 180,
        sorter: createTextSorter((record) => record.createdAt),
      },
    ],
    [],
  );

  return (
    <div>
      <PageTitle title="媛먯궗 로그" />
      <ListSummaryCards items={auditSummaryCards} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: "전체", value: "all" },
              { label: "로그 ID", value: "logId" },
              { label: "대상ID", value: "targetId" },
              { label: "議곗튂", value: "action" },
              { label: "수행자, value: "actor" },
              { label: "사유", value: "reason" },
            ]}
            keyword={keyword}
            onSearchFieldChange={(value) =>
              commitParams({ searchField: value })
            }
            onKeywordChange={(event) =>
              commitParams({
                keyword: event.target.value,
                searchField,
              })
            }
            keywordPlaceholder="寃??.."
            detailTitle="상세 寃??
            detailContent={
              <SearchBarDetailField label="시각">
                <SearchBarDateRange
                  startDate={draftStartDate}
                  endDate={draftEndDate}
                  onChange={handleDraftDateChange}
                />
              </SearchBarDetailField>
            }
            onApply={handleApplyDateRange}
            onDetailOpenChange={handleDetailOpenChange}
            onReset={handleDraftReset}
            summary={
              <Text type="secondary">
                珥?{filteredRows.length.toLocaleString()}嫄?              </Text>
            }
          />
        }
      >
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          대상ID 留곹겕瑜??꾨Ⅴ硫??먮낯 운영 ?붾㈃?쇰줈 ?대룞?⑸땲??
          {targetIdFilter ? (
            <>
              {" "}
              ?꾩옱??<Text strong>{targetIdFilter}</Text>??대상?대젰留?蹂닿퀬
              ?덉뒿?덈떎.
            </>
          ) : null}
          {commerceAuditCount > 0
            ? " 而ㅻ㉧??환불/결제? 荑좏룿 운영 ?대젰??媛숈? ?쒖뿉???④퍡 異붿쟻?⑸땲??"
            : null}
        </Paragraph>

        <AdminDataTable<AuditLogRow>
          rowKey="logId"
          pagination={false}
          scroll={{ x: 1200 }}
          columns={columns}
          dataSource={filteredRows}
          onRow={(record) => ({
            onClick: () => setSelectedRow(record),
            style: { cursor: "pointer" },
          })}
        />
      </AdminListCard>

      <TableRowDetailModal
        open={Boolean(selectedRow)}
        title="媛먯궗 로그 상세"
        record={selectedDetailRecord}
        labelMap={detailLabelMap}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}


