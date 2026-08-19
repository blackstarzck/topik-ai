import { Alert, Button, Card, Descriptions, Space, Tag, Typography } from "antd";

import { canControlIssueState } from "../model/commerce-coupons-page-schema";
import type { CouponDangerState } from "../model/commerce-coupons-page-schema";
import type { CommerceCouponSubscriptionTemplate } from "../model/coupon-template-types";
import {
  formatCouponTemplateSchedule,
  getCouponTemplateAlertSummary,
  getCouponTemplateBenefitSummary,
  getCouponTemplateConditionSummary,
  getCouponTemplateIssueTargetSummary,
  getCouponTemplateScopeSummary,
} from "../model/coupon-template-types";
import type { CommerceCoupon } from "../model/coupon-types";
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
import { AuditLogLink } from "@/shared/ui/audit-log-link/audit-log-link";
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection,
} from "@/shared/ui/detail-drawer/detail-drawer";
import { StatusBadge } from "@/shared/ui/status-badge/status-badge";

const { Paragraph, Text } = Typography;

// 쿠폰/정기 템플릿 상세 Drawer — Phase 4 분해로 페이지 JSX 에서 통째 이동(동작 동일).
// 선택 상태·복사/수정/위험 조치 핸들러는 페이지가 소유해 props 로 전달한다.
export type CommerceCouponsDetailDrawerProps = {
  selectedCoupon: CommerceCoupon | null;
  selectedTemplate: CommerceCouponSubscriptionTemplate | null;
  closeDetail: () => void;
  handleCopyDownloadLink: (coupon: CommerceCoupon) => Promise<void>;
  handleCopyCouponCode: (coupon: CommerceCoupon) => Promise<void>;
  openEditPage: (coupon: CommerceCoupon) => void;
  openTemplateEditPage: (template: CommerceCouponSubscriptionTemplate) => void;
  setDangerState: (next: CouponDangerState) => void;
};

export function CommerceCouponsDetailDrawer({
  selectedCoupon,
  selectedTemplate,
  closeDetail,
  handleCopyDownloadLink,
  handleCopyCouponCode,
  openEditPage,
  openTemplateEditPage,
  setDangerState,
}: CommerceCouponsDetailDrawerProps): JSX.Element {
  return (
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
  );
}
