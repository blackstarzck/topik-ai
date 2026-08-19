import { Space, Typography } from "antd";
import type { NotificationInstance } from "antd/es/notification/interface";
import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";

import {
  deleteCouponSafe,
  duplicateCouponSafe,
  deleteCouponTemplateSafe,
  pauseCouponSafe,
  pauseCouponTemplateSafe,
  resumeCouponSafe,
  resumeCouponTemplateSafe,
} from "../api/coupons-service";
import {
  copyTextSafely,
  getDangerCopy,
} from "../model/commerce-coupons-page-schema";
import type { CouponDangerState } from "../model/commerce-coupons-page-schema";
import type { CommerceCouponSubscriptionTemplate } from "../model/coupon-template-types";
import type { CommerceCoupon } from "../model/coupon-types";
import type { AsyncState } from "@/shared/model/async-state";
import { AuditLogLink } from "@/shared/ui/audit-log-link/audit-log-link";

const { Text } = Typography;

// 쿠폰 조치 실행기(변형 ⑩) — Phase 4 분해로 페이지 핸들러 본문에서 이동(동작 동일).
// 페이지가 소유한 상태 setter·알림 인스턴스·네비게이션을 컨텍스트로 주입받고,
// 실행 시점·소유권은 페이지의 3줄 위임 핸들러가 그대로 가진다.
export type CouponActionContext = {
  notificationApi: NotificationInstance;
  navigate: NavigateFunction;
  listSearch: string;
  setCouponsState: Dispatch<SetStateAction<AsyncState<CommerceCoupon[]>>>;
  setTemplatesState: Dispatch<
    SetStateAction<AsyncState<CommerceCouponSubscriptionTemplate[]>>
  >;
  setDangerState: Dispatch<SetStateAction<CouponDangerState>>;
  closeDetail: () => void;
};

export async function runCopyDownloadLink(
  ctx: CouponActionContext,
  coupon: CommerceCoupon,
): Promise<void> {
  if (!coupon.downloadUrl) {
    return;
  }

  try {
    await copyTextSafely(coupon.downloadUrl);
    ctx.notificationApi.success({
      message: "쿠폰 다운로드 링크를 복사했어요",
      description: (
        <Space direction="vertical">
          <Text>{coupon.downloadUrl}</Text>
          <Text type="secondary">대상 ID: {coupon.id}</Text>
        </Space>
      ),
    });
  } catch (error) {
    ctx.notificationApi.error({
      message: "쿠폰 다운로드 링크를 복사하지 못했어요",
      description:
        error instanceof Error
          ? error.message
          : "클립보드 접근에 실패했습니다.",
    });
  }
}

export async function runCopyCouponCode(
  ctx: CouponActionContext,
  coupon: CommerceCoupon,
): Promise<void> {
  if (!coupon.couponCode) {
    return;
  }

  try {
    await copyTextSafely(coupon.couponCode);
    ctx.notificationApi.success({
      message: "쿠폰 코드를 복사했어요",
      description: (
        <Space direction="vertical">
          <Text>{coupon.couponCode}</Text>
          <Text type="secondary">대상 ID: {coupon.id}</Text>
        </Space>
      ),
    });
  } catch (error) {
    ctx.notificationApi.error({
      message: "쿠폰 코드를 복사하지 못했어요",
      description:
        error instanceof Error
          ? error.message
          : "클립보드 접근에 실패했습니다.",
    });
  }
}

export async function runDuplicateCoupon(
  ctx: CouponActionContext,
  coupon: CommerceCoupon,
): Promise<void> {
  const result = await duplicateCouponSafe({ couponId: coupon.id });

  if (!result.ok) {
    ctx.notificationApi.error({
      message: "쿠폰 복제에 실패했어요",
      description: result.error.message,
    });
    return;
  }

  ctx.notificationApi.success({
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

  ctx.navigate({
    pathname: `/commerce/coupons/create/${result.data.id}`,
    search: ctx.listSearch,
  });
}

export async function runDangerConfirm(
  ctx: CouponActionContext,
  dangerState: CouponDangerState,
  selectedDetailId: string,
  reason: string,
): Promise<void> {
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
    ctx.notificationApi.error({
      message: `${dangerCopy.title} 실패`,
      description: result.error.message,
    });
    return;
  }

  if (dangerState.entity === "coupon") {
      // `result` 는 위 삼항에서 entity 로 갈라졌으므로 이 분기의 결과는 확정이다.
      // TS 는 두 조건(생성 시점 entity, 여기 entity)의 상관관계를 좁히지 못한다.
    const savedCoupon = result.data as CommerceCoupon;
    ctx.setCouponsState((prev) => {
      if (dangerState.type === "delete") {
        const nextData = prev.data.filter(
          (coupon) => coupon.id !== savedCoupon.id,
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
          coupon.id === savedCoupon.id ? savedCoupon : coupon,
        ),
        errorMessage: null,
        errorCode: null,
      };
    });
  } else {
      // `result` 는 위 삼항에서 entity 로 갈라졌으므로 이 분기의 결과는 확정이다.
      // TS 는 두 조건(생성 시점 entity, 여기 entity)의 상관관계를 좁히지 못한다.
    const savedTemplate = result.data as CommerceCouponSubscriptionTemplate;
    ctx.setTemplatesState((prev) => {
      if (dangerState.type === "delete") {
        const nextData = prev.data.filter(
          (template) => template.id !== savedTemplate.id,
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
          template.id === savedTemplate.id ? savedTemplate : template,
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
    ctx.closeDetail();
  }

  ctx.notificationApi.success({
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

  ctx.setDangerState(null);
}
