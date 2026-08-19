import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tooltip,
  Upload,
  Typography,
} from "antd";
import { InfoCircleOutlined, UploadOutlined } from "@ant-design/icons";
import type { DragEndEvent } from "@dnd-kit/core";
import { DndContext, PointerSensor, useSensor } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactElement, ReactNode } from "react";
import type { UploadFile, UploadProps } from "antd";

import {
  operationEventExposureChannelValues,
  operationEventIndexingPolicyValues,
  operationEventRewardTypeValues,
  operationEventTypeValues,
  operationEventVisibilityStatusValues,
  type OperationEvent,
  type OperationEventBannerImage,
} from "../model/types";
import {
  DEFAULT_TINYMCE_PLUGINS,
  DEFAULT_TINYMCE_TOOLBAR,
  TinyMceHtmlEditor,
} from "../../../shared/ui/html-editor/tiny-mce-html-editor";
import { AdminEditorFormSection } from "../../../shared/ui/admin-editor-form/admin-editor-form";
import { markRequiredDescriptionItems } from "../../../shared/ui/descriptions/description-label";
import type { MessageGroup } from "../../message/model/types";

const { Text } = Typography;

// 이벤트 등록 스텝 섹션 7종 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// Form.Item 은 상위 <Form> 컨텍스트로 동작하고(5호 패턴), 배너 정렬 센서 같은
// 입력 UX 는 섹션 내부에서 만든다(11호 패턴). 폼 인스턴스·워치 값·핸들러는
// 페이지가 소유하고 props 로 받는다.

type DraggableUploadListItemProps = {
  originNode: ReactElement;
  file: UploadFile;
};

function createTooltipLabel(
  label: string,
  tooltipMessage: ReactNode,
): ReactNode {
  return (
    <span className="event-form-tooltip-label">
      <span>{label}</span>
      <Tooltip title={tooltipMessage}>
        <span
          className="event-form-tooltip-label__icon"
          role="img"
          aria-label={`${label} 안내`}
          tabIndex={0}
        >
          <InfoCircleOutlined />
        </span>
      </Tooltip>
    </span>
  );
}

function DraggableUploadListItem({
  originNode,
  file,
}: DraggableUploadListItemProps): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: file.uid,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        cursor: "move",
      }}
      className={isDragging ? "is-dragging" : undefined}
      {...attributes}
      {...listeners}
    >
      {file.status === "error" && isDragging
        ? originNode.props.children
        : originNode}
    </div>
  );
}

export function EventBasicSection(): JSX.Element {
  return (
  <AdminEditorFormSection
    title="기본 정보"
    description="이벤트의 이름, 요약, 기본 유형을 먼저 정의합니다."
  >
    <Descriptions
      bordered
      size="small"
      column={2}
      className="admin-form-descriptions admin-editor-form-descriptions"
      items={markRequiredDescriptionItems(
        [
          {
            key: "title",
            label: "이벤트명",
            span: 2,
            children: (
              <Form.Item
                name="title"
                rules={[
                  {
                    required: true,
                    message: "이벤트명을 입력하세요.",
                  },
                ]}
              >
                <Input placeholder="운영자가 확인할 이벤트명을 입력하세요." />
              </Form.Item>
            ),
          },
          {
            key: "summary",
            label: "이벤트 요약",
            span: 2,
            children: (
              <Form.Item
                name="summary"
                rules={[
                  {
                    required: true,
                    message: "이벤트 요약을 입력하세요.",
                  },
                ]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="이벤트 설명과 공유 요약에 사용할 문구를 입력하세요."
                />
              </Form.Item>
            ),
          },
          {
            key: "eventType",
            label: "이벤트 유형",
            children: (
              <Form.Item
                name="eventType"
                rules={[
                  {
                    required: true,
                    message: "이벤트 유형을 선택하세요.",
                  },
                ]}
              >
                <Select
                  options={operationEventTypeValues.map(
                    (value) => ({
                      label: value,
                      value,
                    }),
                  )}
                />
              </Form.Item>
            ),
          },
        ],
        ["title", "summary", "eventType"],
      )}
    />
  </AdminEditorFormSection>
  );
}

export function EventBodySection({
  eventId,
}: {
  eventId: string | undefined;
}): JSX.Element {
  return (
  <AdminEditorFormSection
    title="이벤트 본문"
    description="이벤트 상세와 랜딩에 노출할 본문 콘텐츠를 편집합니다."
  >
    <Form.Item
      name="bodyHtml"
      rules={[
        { required: true, message: "이벤트 본문을 입력하세요." },
      ]}
      className="event-detail-editor-field"
      style={{ marginBottom: 0 }}
    >
      <TinyMceHtmlEditor
        editorId={`operation-event-editor-${eventId ?? "new"}`}
        height={420}
        plugins={DEFAULT_TINYMCE_PLUGINS}
        toolbar={DEFAULT_TINYMCE_TOOLBAR}
      />
    </Form.Item>
  </AdminEditorFormSection>
  );
}

export type EventExposureSectionProps = {
  bannerFileList: UploadFile[];
  onBannerChange: NonNullable<UploadProps["onChange"]>;
  onBannerDragEnd: (event: DragEndEvent) => void;
  selectedBannerImageUrl: string | undefined;
  selectedBannerImageFileName: string | undefined;
  selectedBannerImages: OperationEventBannerImage[];
};

export function EventExposureSection({
  bannerFileList,
  onBannerChange,
  onBannerDragEnd,
  selectedBannerImageUrl,
  selectedBannerImageFileName,
  selectedBannerImages,
}: EventExposureSectionProps): JSX.Element {
  const uploadSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 10 },
  });

  return (
  <AdminEditorFormSection
    title="노출 설정"
    description="운영에서 관리할 공개 시점, 노출 위치, 랜딩 자산을 묶어서 설정합니다."
  >
    <Descriptions
      bordered
      size="small"
      column={2}
      className="admin-form-descriptions admin-editor-form-descriptions"
      items={markRequiredDescriptionItems(
        [
          {
            key: "visibilityStatus",
            label: "기본 노출 상태",
            children: (
              <Form.Item
                name="visibilityStatus"
                rules={[
                  {
                    required: true,
                    message: "노출 상태를 선택하세요.",
                  },
                ]}
              >
                <Select
                  options={operationEventVisibilityStatusValues.map(
                    (value) => ({
                      label: value,
                      value,
                    }),
                  )}
                />
              </Form.Item>
            ),
          },
          {
            key: "period",
            label: "진행 기간",
            children: (
              <Form.Item
                name="period"
                rules={[
                  {
                    required: true,
                    message: "진행 기간을 선택하세요.",
                  },
                ]}
              >
                <DatePicker.RangePicker
                  style={{ width: "100%" }}
                />
              </Form.Item>
            ),
          },
          {
            key: "exposureChannels",
            label: "노출 위치",
            span: 2,
            children: (
              <Form.Item
                name="exposureChannels"
                rules={[
                  {
                    required: true,
                    message: "노출 위치를 선택하세요.",
                  },
                ]}
              >
                <Select
                  mode="multiple"
                  options={operationEventExposureChannelValues.map(
                    (value) => ({
                      label: value,
                      value,
                    }),
                  )}
                />
              </Form.Item>
            ),
          },
          {
            key: "bannerImages",
            label: "배너 이미지",
            span: 2,
            children: (
              <div className="event-banner-upload">
                <DndContext
                  sensors={[uploadSensor]}
                  onDragEnd={onBannerDragEnd}
                >
                  <SortableContext
                    items={bannerFileList.map((file) => file.uid)}
                    strategy={verticalListSortingStrategy}
                  >
                    <Upload
                      accept="image/*"
                      beforeUpload={() => false}
                      fileList={bannerFileList}
                      listType="text"
                      multiple
                      onChange={onBannerChange}
                      itemRender={(originNode, file) => (
                        <DraggableUploadListItem
                          originNode={originNode}
                          file={file}
                        />
                      )}
                    >
                      <Button
                        icon={<UploadOutlined />}
                        className="event-banner-upload__trigger"
                      >
                        {
                          "배너 이미지 업로드"
                        }
                      </Button>
                    </Upload>
                  </SortableContext>
                </DndContext>
                <Text type="secondary">
                  드래그로 순서를 바꾸면 첫 번째 이미지가 대표
                  배너로 저장됩니다. mock 단계에서는 data URL을
                  저장하고, DB/API 단계에서는 정렬 가능한 asset
                  list로 전환합니다.
                </Text>
              </div>
            ),
          },
          {
            key: "bannerPreview",
            label: "현재 배너",
            children: selectedBannerImageUrl ? (
              <Text className="event-banner-upload__value">
                {selectedBannerImages.length > 1
                  ? `총 ${selectedBannerImages.length}개 · 대표 ${selectedBannerImageFileName || "첨부 이미지"}`
                  : selectedBannerImageFileName || "첨부 이미지"}
              </Text>
            ) : (
              <Text type="secondary">
                등록된 배너가 없습니다.
              </Text>
            ),
          },
          {
            key: "landingUrl",
            label: "랜딩 경로",
            span: 2,
            children: (
              <Form.Item name="landingUrl">
                <Input placeholder="예: /events/spring-attendance" />
              </Form.Item>
            ),
          },
        ],
        ["visibilityStatus", "period", "exposureChannels"],
      )}
    />
  </AdminEditorFormSection>
  );
}

export type EventParticipationSectionProps = {
  targetGroupOptions: Array<{ label: string; value: string }>;
  targetGroupMap: Map<string, MessageGroup>;
  selectedTargetGroupId: string | undefined;
};

export function EventParticipationSection({
  targetGroupOptions,
  targetGroupMap,
  selectedTargetGroupId,
}: EventParticipationSectionProps): JSX.Element {
  return (
  <AdminEditorFormSection
    title="참여 조건"
    description="이벤트 대상과 참여 제한 정책을 같이 관리합니다."
  >
    <Descriptions
      bordered
      size="small"
      column={2}
      className="admin-form-descriptions admin-editor-form-descriptions"
      items={markRequiredDescriptionItems(
        [
          {
            key: "targetGroupId",
            label: "대상 그룹",
            span: 2,
            children: (
              <Form.Item
                name="targetGroupId"
                rules={[
                  {
                    required: true,
                    message: "대상 그룹을 선택하세요.",
                  },
                ]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={targetGroupOptions}
                  placeholder="메시지 > 대상 그룹에서 관리 중인 그룹을 선택하세요."
                />
              </Form.Item>
            ),
          },
          {
            key: "targetGroupSummary",
            label: "선택된 그룹 정보",
            span: 2,
            children: selectedTargetGroupId ? (
              <Text type="secondary">
                {targetGroupMap.get(selectedTargetGroupId)
                  ?.description ?? "선택한 그룹 설명이 없습니다."}
              </Text>
            ) : (
              <Text type="secondary">
                대상 그룹을 선택하면 설명과 연결 ID가 표시됩니다.
              </Text>
            ),
          },
          {
            key: "participantLimit",
            label: "참여 제한",
            span: 2,
            children: (
              <Form.Item name="participantLimit">
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  placeholder="제한 없음"
                />
              </Form.Item>
            ),
          },
        ],
        ["targetGroupId"],
      )}
    />
  </AdminEditorFormSection>
  );
}

export type EventRewardSectionProps = {
  rewardPolicyOptions: Array<{ label: string; value: string }>;
  messageTemplateOptions: Array<{ label: string; value: string }>;
  selectedRewardType: OperationEvent["rewardType"];
};

export function EventRewardSection({
  rewardPolicyOptions,
  messageTemplateOptions,
  selectedRewardType,
}: EventRewardSectionProps): JSX.Element {
  return (
  <AdminEditorFormSection
    title="보상 설정"
    description="보상 유형과 연동 정책, 메시지 템플릿을 한 블록에서 확인합니다."
  >
    <Descriptions
      bordered
      size="small"
      column={2}
      className="admin-form-descriptions admin-editor-form-descriptions"
      items={markRequiredDescriptionItems(
        [
          {
            key: "rewardType",
            label: "보상 유형",
            children: (
              <Form.Item
                name="rewardType"
                rules={[
                  {
                    required: true,
                    message: "보상 유형을 선택하세요.",
                  },
                ]}
              >
                <Select
                  options={operationEventRewardTypeValues.map(
                    (value) => ({
                      label: value,
                      value,
                    }),
                  )}
                />
              </Form.Item>
            ),
          },
          {
            key: "messageTemplateId",
            label: createTooltipLabel(
              "메시지 템플릿",
              "메시지 > 메일/푸시에서 관리하는 템플릿을 참조합니다. 이벤트에서 메일/푸시 중 어떤 채널 템플릿을 허용할지는 정책 확정이 필요합니다.",
            ),
            children: (
              <Form.Item name="messageTemplateId">
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={messageTemplateOptions}
                  placeholder="메시지 페이지에서 관리 중인 템플릿을 선택하세요."
                  allowClear
                />
              </Form.Item>
            ),
          },
          {
            key: "rewardPolicyId",
            label: "보상 정책",
            span: 2,
            children: (
              <Form.Item
                name="rewardPolicyId"
                rules={[
                  {
                    validator: async (_, value) => {
                      if (selectedRewardType === "없음") {
                        return;
                      }

                      if (value) {
                        return;
                      }

                      throw new Error("보상 정책을 선택하세요.");
                    },
                  },
                ]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={rewardPolicyOptions}
                  placeholder={
                    selectedRewardType === "없음"
                      ? "보상 없음 선택 시 정책 연결이 필요하지 않습니다."
                      : "보상 유형에 맞는 정책을 선택하세요."
                  }
                  disabled={selectedRewardType === "없음"}
                  allowClear
                />
              </Form.Item>
            ),
          },
        ],
        ["rewardType"],
      )}
    />
  </AdminEditorFormSection>
  );
}

export function EventSeoSection(): JSX.Element {
  return (
  <AdminEditorFormSection
    title="노출/SEO 설정"
    description="공개 이벤트에만 필요한 공유 메타를 묶어서 편집합니다."
  >
    <Space
      direction="vertical"
      size={12}
      style={{ width: "100%" }}
    >
      <Alert
        type="info"
        showIcon
        message="공개 이벤트만 override"
        description="비워두면 이벤트명, 요약, 배너 기준으로 자동 생성됩니다."
      />
      <Descriptions
        bordered
        size="small"
        column={2}
        className="admin-form-descriptions admin-editor-form-descriptions"
        items={markRequiredDescriptionItems(
          [
            {
              key: "slug",
              label: "슬러그",
              children: (
                <Form.Item name="slug">
                  <Input placeholder="비워두면 이벤트명 기준 자동 생성" />
                </Form.Item>
              ),
            },
            {
              key: "indexingPolicy",
              label: "인덱싱 정책",
              children: (
                <Form.Item
                  name="indexingPolicy"
                  rules={[
                    {
                      required: true,
                      message: "인덱싱 정책을 선택하세요.",
                    },
                  ]}
                >
                  <Select
                    options={operationEventIndexingPolicyValues.map(
                      (value) => ({
                        label: value,
                        value,
                      }),
                    )}
                  />
                </Form.Item>
              ),
            },
            {
              key: "metaTitle",
              label: "공유 제목",
              span: 2,
              children: (
                <Form.Item name="metaTitle">
                  <Input placeholder="비워두면 이벤트명이 자동 적용됩니다." />
                </Form.Item>
              ),
            },
            {
              key: "metaDescription",
              label: "공유 설명",
              span: 2,
              children: (
                <Form.Item name="metaDescription">
                  <Input.TextArea
                    rows={3}
                    placeholder="비워두면 이벤트 요약이 자동 적용됩니다."
                  />
                </Form.Item>
              ),
            },
            {
              key: "ogImageUrl",
              label: "공유 이미지 URL",
              span: 2,
              children: (
                <Form.Item name="ogImageUrl">
                  <Input placeholder="비워두면 배너 이미지가 자동 적용됩니다." />
                </Form.Item>
              ),
            },
            {
              key: "canonicalUrl",
              label: "대표 URL",
              span: 2,
              children: (
                <Form.Item name="canonicalUrl">
                  <Input placeholder="비워두면 랜딩 경로/슬러그 기준 자동 생성됩니다." />
                </Form.Item>
              ),
            },
          ],
          ["indexingPolicy"],
        )}
      />
    </Space>
  </AdminEditorFormSection>
  );
}

export function EventMemoSection(): JSX.Element {
  return (
  <AdminEditorFormSection
    title="관리자 메모"
    description="검수와 후속 조치에 필요한 운영 메모를 별도 보관합니다."
  >
    <Descriptions
      bordered
      size="small"
      column={1}
      className="admin-form-descriptions admin-editor-form-descriptions"
      items={[
        {
          key: "adminMemo",
          label: "관리자 메모",
          children: (
            <Form.Item name="adminMemo">
              <Input.TextArea
                rows={5}
                placeholder="운영 검수, 배너 집행, 후속 조치 메모를 입력하세요."
              />
            </Form.Item>
          ),
        },
      ]}
    />
  </AdminEditorFormSection>
  );
}
