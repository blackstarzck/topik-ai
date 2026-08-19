import dayjs, { type Dayjs } from "dayjs";
import type { UploadFile } from "antd";

import type {
  OperationEvent,
  OperationEventBannerImage,
} from "./types";

// 이벤트 등록/수정 화면의 순수 스키마 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 폼 인스턴스·조회 상태·제출 로직은 페이지가 소유하고, 여기는 타입·스텝 정의·검증·배너 정규화만 둔다.

export type EventFormValues = {
  title: string;
  summary: string;
  bodyHtml: string;
  eventType: OperationEvent["eventType"];
  visibilityStatus: OperationEvent["visibilityStatus"];
  period: [Dayjs, Dayjs];
  exposureChannels: OperationEvent["exposureChannels"];
  targetGroupId: string;
  participantLimit: number | null;
  rewardType: OperationEvent["rewardType"];
  rewardPolicyId: string;
  messageTemplateId: string;
  bannerImages: OperationEventBannerImage[];
  // 대표 배너(bannerImages[0])의 파생값. 다중 배너 도입 후에도 `useWatch` 로 읽고 저장
  // payload 에 실려 나가므로 폼 값의 일부다 — 타입에서만 빠져 있었다.
  bannerImageUrl: string;
  bannerImageSourceType: OperationEvent["bannerImageSourceType"];
  bannerImageFileName: string;
  landingUrl: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  indexingPolicy: OperationEvent["indexingPolicy"];
  adminMemo: string;
};

export type SubmitMode = "save" | "schedule";

export function createDefaultPeriod(): [Dayjs, Dayjs] {
  return [dayjs().startOf("day"), dayjs().add(7, "day").startOf("day")];
}

export const eventCreateStepItems = [
  {
    key: "basic",
    title: "기본 정보",
    description: "이벤트명, 요약, 유형",
  },
  {
    key: "body",
    title: "이벤트 본문",
    description: "상세/랜딩 HTML",
  },
  {
    key: "exposure",
    title: "노출 설정",
    description: "노출 상태, 기간, 위치",
  },
  {
    key: "participation",
    title: "참여 조건",
    description: "대상 그룹, 참여 제한",
  },
  {
    key: "reward",
    title: "보상 설정",
    description: "보상 유형, 정책, 메시지",
  },
  {
    key: "seo",
    title: "노출/SEO 설정",
    description: "공유 메타, 인덱싱 정책",
  },
  {
    key: "memo",
    title: "관리자 메모",
    description: "운영 검수 메모",
  },
] as const;

export type EventCreateSectionKey = (typeof eventCreateStepItems)[number]["key"];

export const eventCreateStepFieldMap: Record<
  EventCreateSectionKey,
  Array<keyof EventFormValues>
> = {
  basic: ["title", "summary", "eventType"],
  body: ["bodyHtml"],
  exposure: [
    "visibilityStatus",
    "period",
    "exposureChannels",
    "bannerImages",
    "landingUrl",
  ],
  participation: ["targetGroupId", "participantLimit"],
  reward: ["rewardType", "rewardPolicyId", "messageTemplateId"],
  seo: [
    "slug",
    "metaTitle",
    "metaDescription",
    "ogImageUrl",
    "canonicalUrl",
    "indexingPolicy",
  ],
  memo: ["adminMemo"],
};

export function findStepIndexByFieldName(
  fieldName: string | number | undefined,
): number {
  if (typeof fieldName !== "string") {
    return 0;
  }

  const matchedStepIndex = eventCreateStepItems.findIndex((item) =>
    eventCreateStepFieldMap[item.key].includes(
      fieldName as keyof EventFormValues,
    ),
  );

  return matchedStepIndex >= 0 ? matchedStepIndex : 0;
}

export function isRichTextEmpty(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  const plainText = value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();

  return plainText.length === 0;
}

export function getFirstHiddenValidationError(
  values: Partial<EventFormValues>,
): { field: keyof EventFormValues; message: string } | null {
  if (!values.title?.trim()) {
    return { field: "title", message: "이벤트명을 입력하세요." };
  }

  if (!values.summary?.trim()) {
    return { field: "summary", message: "이벤트 요약을 입력하세요." };
  }

  if (isRichTextEmpty(values.bodyHtml)) {
    return { field: "bodyHtml", message: "이벤트 본문을 입력하세요." };
  }

  if (!values.eventType) {
    return { field: "eventType", message: "이벤트 유형을 선택하세요." };
  }

  if (!values.visibilityStatus) {
    return { field: "visibilityStatus", message: "노출 상태를 선택하세요." };
  }

  if (!values.period?.[0] || !values.period?.[1]) {
    return { field: "period", message: "진행 기간을 선택하세요." };
  }

  if (!values.exposureChannels?.length) {
    return { field: "exposureChannels", message: "노출 위치를 선택하세요." };
  }

  if (!values.targetGroupId?.trim()) {
    return { field: "targetGroupId", message: "대상 그룹을 선택하세요." };
  }

  if (!values.rewardType) {
    return { field: "rewardType", message: "보상 유형을 선택하세요." };
  }

  if (values.rewardType !== "없음" && !values.rewardPolicyId?.trim()) {
    return { field: "rewardPolicyId", message: "보상 정책을 선택하세요." };
  }

  if (!values.indexingPolicy) {
    return { field: "indexingPolicy", message: "인덱싱 정책을 선택하세요." };
  }

  return null;
}

export function createBannerUploadFile(
  bannerImage: OperationEventBannerImage,
): UploadFile {
  return {
    uid: bannerImage.uid,
    name: bannerImage.name,
    status: "done",
    url: bannerImage.url,
  };
}

export function toBannerImages(fileList: UploadFile[]): OperationEventBannerImage[] {
  return fileList
    .map((file) => {
      const fileUrl =
        typeof file.url === "string"
          ? file.url
          : typeof file.thumbUrl === "string"
            ? file.thumbUrl
            : "";

      if (!fileUrl) {
        return null;
      }

      return {
        uid: file.uid,
        name: file.name,
        url: fileUrl,
      } satisfies OperationEventBannerImage;
    })
    .filter(
      (bannerImage): bannerImage is OperationEventBannerImage =>
        bannerImage !== null,
    );
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read file."));
    };

    reader.readAsDataURL(file);
  });
}

export async function normalizeUploadFileList(
  fileList: UploadFile[],
): Promise<UploadFile[]> {
  const normalizedFiles = await Promise.all(
    fileList.map(async (file) => {
      const currentUrl =
        typeof file.url === "string"
          ? file.url
          : typeof file.thumbUrl === "string"
            ? file.thumbUrl
            : "";

      if (currentUrl) {
        return {
          ...file,
          status: file.status === "error" ? "error" : "done",
          url: currentUrl,
          thumbUrl: currentUrl,
        } satisfies UploadFile;
      }

      if (file.originFileObj instanceof File) {
        const nextUrl = await readFileAsDataUrl(file.originFileObj);

        return {
          ...file,
          status: "done",
          url: nextUrl,
          thumbUrl: nextUrl,
        } satisfies UploadFile;
      }

      return file;
    }),
  );

  return normalizedFiles.filter(
    (file) => typeof file.url === "string" && file.url.length > 0,
  );
}
