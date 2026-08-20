import {
  Button,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Slider,
  Space,
  Spin,
  Typography
} from 'antd';
import type { FormInstance } from 'antd';
import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import {
  MESSAGE_GROUP_DEFAULT_AGE_RANGE,
  activityOptionValues,
  channelOptionValues,
  countryOptionValues,
  genderOptionValues,
  memberTypeOptionValues,
  messageGroupBuilderModeOptions,
  messageGroupDefinitionTypeOptions,
  messageGroupStatusOptions,
  signupMethodOptionValues,
  subscriptionOptionValues
} from '../model/message-group-segment-schema';
import {
  buildDefaultFormValues,
  isSupabaseSource,
  queryPreviewModeLabels
} from '../model/message-groups-page-schema';
import type {
  GroupEditorState,
  GroupFormValues,
  QueryPreviewMode
} from '../model/message-groups-page-schema';
import type {
  MessageGroupBuilderMode,
  MessageGroupDefinitionType,
  MessageGroupQueryGroup
} from '../model/types';
import { MultiCheckboxGroup, QueryBuilderGroupEditor } from './message-groups-query-builder';
import { SPACE } from '@/shared/styles/design-tokens';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// 대상 그룹 편집 Drawer — Phase 4 분해로 페이지 JSX 에서 통째 이동(동작 동일).
// 폼 인스턴스·워치 값·쿼리 빌더 상태·저장/미리보기 핸들러는 페이지가 소유해 props 로
// 전달하고, 선택 그룹에서 파생되는 표시 값(조건 요약·수정 여부·재계산 로딩)만 내부 계산한다.
export type MessageGroupEditorDrawerProps = {
  editorState: GroupEditorState;
  form: FormInstance<GroupFormValues>;
  definitionType: MessageGroupDefinitionType | undefined;
  builderMode: MessageGroupBuilderMode | undefined;
  ageRange: [number, number] | undefined;
  queryBuilderConfig: MessageGroupQueryGroup;
  queryPreviewMode: QueryPreviewMode;
  queryPreviewText: Record<QueryPreviewMode, string>;
  previewCount: number | null;
  recalculatingGroupId: string | null;
  closeDrawer: () => void;
  handlePreviewCount: () => Promise<void>;
  handleSaveGroup: () => Promise<void>;
  setQueryPreviewMode: Dispatch<SetStateAction<QueryPreviewMode>>;
  setQueryBuilderConfig: Dispatch<SetStateAction<MessageGroupQueryGroup>>;
  setQueryBuilderTouched: Dispatch<SetStateAction<boolean>>;
};

export function MessageGroupEditorDrawer({
  editorState,
  form,
  definitionType,
  builderMode,
  ageRange,
  queryBuilderConfig,
  queryPreviewMode,
  queryPreviewText,
  previewCount,
  recalculatingGroupId,
  closeDrawer,
  handlePreviewCount,
  handleSaveGroup,
  setQueryPreviewMode,
  setQueryBuilderConfig,
  setQueryBuilderTouched
}: MessageGroupEditorDrawerProps): JSX.Element {
  const conditionSummaryPreview = useMemo(() => {
    if (definitionType === '정적 그룹') {
      return editorState?.type === 'edit'
        ? editorState.group.ruleSummary
        : '저장 시 정적 대상 수 요약이 자동 생성됩니다.';
    }

    if (builderMode === 'query-builder') {
      return queryPreviewText.sql || '상세 조건이 아직 없습니다.';
    }

    return editorState?.type === 'edit'
      ? editorState.group.ruleSummary
      : '저장 시 조건 요약이 자동 생성됩니다.';
  }, [builderMode, definitionType, editorState, queryPreviewText.sql]);

  const isEditingExistingGroup = editorState?.type === 'edit';
  const isDrawerPreviewLoading =
    editorState?.type === 'edit' && recalculatingGroupId === editorState.group.id;

  return (
    <Drawer
      open={Boolean(editorState)}
      title={editorState?.type === 'edit' ? '그룹 수정' : '그룹 추가'}
      width={920}
      onClose={closeDrawer}
      destroyOnHidden
      extra={
        editorState?.type === 'edit' ? (
          <Text type="secondary">그룹 ID: {editorState.group.id}</Text>
        ) : null
      }
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button size="large" onClick={closeDrawer}>
            취소
          </Button>
          <Space>
            <Button size="large" onClick={() => void handlePreviewCount()}>
              조회하기
            </Button>
            <Button size="large" type="primary" onClick={() => void handleSaveGroup()}>
              저장
            </Button>
          </Space>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={buildDefaultFormValues()}>
        <Form.Item hidden name="queryBuilderText">
          <Input />
        </Form.Item>

        <div className="message-groups-editor-table">
          <div className="message-groups-editor-row">
            <div className="message-groups-editor-label">그룹 이름</div>
            <div className="message-groups-editor-content">
              <Form.Item
                name="name"
                rules={[{ required: true, message: '그룹 이름을 입력하세요.' }]}
                style={{ marginBottom: 0 }}
              >
                <Input placeholder="예: 활성 학습자" />
              </Form.Item>
            </div>
          </div>

          <div className="message-groups-editor-row">
            <div className="message-groups-editor-label">설명 (선택사항)</div>
            <div className="message-groups-editor-content">
              <Form.Item name="description" style={{ marginBottom: 0 }}>
                <Input.TextArea rows={3} placeholder="발송 대상 그룹의 목적과 사용 맥락을 적어주세요." />
              </Form.Item>
            </div>
          </div>

          <div className="message-groups-editor-row">
            <div className="message-groups-editor-label">정의 방식</div>
            <div className="message-groups-editor-content">
              <div className="message-groups-inline-fields">
                <Form.Item
                  name="definitionType"
                  rules={[{ required: true, message: '정의 방식을 선택하세요.' }]}
                  style={{ flex: 1, marginBottom: 0 }}
                >
                  <Select options={messageGroupDefinitionTypeOptions} />
                </Form.Item>
                <Form.Item
                  name="status"
                  rules={[{ required: true, message: '운영 상태를 선택하세요.' }]}
                  style={{ width: 180, marginBottom: 0 }}
                >
                  <Select options={messageGroupStatusOptions} />
                </Form.Item>
              </div>
            </div>
          </div>

          <div className="message-groups-editor-row">
            <div className="message-groups-editor-label">적용 채널</div>
            <div className="message-groups-editor-content">
              <Form.Item
                name="channels"
                rules={[{ required: true, message: '적용 채널을 하나 이상 선택하세요.' }]}
                style={{ marginBottom: 0 }}
              >
                <MultiCheckboxGroup
                  options={channelOptionValues}
                  value={form.getFieldValue('channels')}
                  onChange={(nextValue) => form.setFieldValue('channels', nextValue)}
                />
              </Form.Item>
            </div>
          </div>

          {definitionType === '정적 그룹' ? (
            <div className="message-groups-editor-row">
              <div className="message-groups-editor-label">정적 대상 목록</div>
              <div className="message-groups-editor-content">
                <Form.Item
                  name="staticMembersText"
                  rules={[{ required: true, message: '정적 대상 목록을 입력하세요.' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Input.TextArea
                    rows={10}
                    placeholder="한 줄에 하나씩 이메일 또는 사용자 식별자를 입력하세요."
                  />
                </Form.Item>
              </div>
            </div>
          ) : (
            <>
              <div className="message-groups-editor-row">
                <div className="message-groups-editor-label">설정 유형</div>
                <div className="message-groups-editor-content">
                  <Form.Item name="builderMode" style={{ marginBottom: SPACE.xs }}>
                    <Radio.Group
                      disabled={isEditingExistingGroup}
                      options={messageGroupBuilderModeOptions}
                    />
                  </Form.Item>
                  {isEditingExistingGroup ? (
                    <Text type="secondary">설정 유형은 그룹 생성 후 변경할 수 없습니다.</Text>
                  ) : (
                    <Text type="secondary">
                      설정 유형을 변경하면 아래 세그먼트 편집 UI가 즉시 바뀝니다.
                    </Text>
                  )}
                </div>
              </div>

              <div className="message-groups-editor-row">
                <div className="message-groups-editor-label">국적</div>
                <div className="message-groups-editor-content">
                  <Form.Item name="country" style={{ marginBottom: 0 }}>
                    <Select options={countryOptionValues} />
                  </Form.Item>
                </div>
              </div>

              {builderMode === 'simple' ? (
                <>
                  <div className="message-groups-editor-row">
                    <div className="message-groups-editor-label">회원 유형</div>
                    <div className="message-groups-editor-content">
                      <Form.Item name="memberTypes" style={{ marginBottom: 0 }}>
                        <MultiCheckboxGroup
                          options={memberTypeOptionValues}
                          value={form.getFieldValue('memberTypes')}
                          onChange={(nextValue) => form.setFieldValue('memberTypes', nextValue)}
                        />
                      </Form.Item>
                    </div>
                  </div>

                  <div className="message-groups-editor-row">
                    <div className="message-groups-editor-label">성별</div>
                    <div className="message-groups-editor-content">
                      <Form.Item name="genders" style={{ marginBottom: 0 }}>
                        <MultiCheckboxGroup
                          options={genderOptionValues}
                          value={form.getFieldValue('genders')}
                          onChange={(nextValue) => form.setFieldValue('genders', nextValue)}
                        />
                      </Form.Item>
                    </div>
                  </div>

                  <div className="message-groups-editor-row">
                    <div className="message-groups-editor-label">연령</div>
                    <div className="message-groups-editor-content">
                      <Space direction="vertical" style={{ width: '100%' }} size={16}>
                        <div className="message-groups-age-inputs">
                          <InputNumber
                            min={MESSAGE_GROUP_DEFAULT_AGE_RANGE[0]}
                            max={MESSAGE_GROUP_DEFAULT_AGE_RANGE[1]}
                            value={ageRange?.[0] ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[0]}
                            onChange={(value) =>
                              form.setFieldValue('ageRange', [
                                Number(value ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[0]),
                                Math.max(
                                  ageRange?.[1] ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[1],
                                  Number(value ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[0])
                                )
                              ])
                            }
                          />
                          <Text>~</Text>
                          <InputNumber
                            min={MESSAGE_GROUP_DEFAULT_AGE_RANGE[0]}
                            max={MESSAGE_GROUP_DEFAULT_AGE_RANGE[1]}
                            value={ageRange?.[1] ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[1]}
                            onChange={(value) =>
                              form.setFieldValue('ageRange', [
                                Math.min(
                                  ageRange?.[0] ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[0],
                                  Number(value ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[1])
                                ),
                                Number(value ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[1])
                              ])
                            }
                          />
                        </div>
                        <Form.Item name="ageRange" style={{ marginBottom: 0 }}>
                          <Slider
                            range
                            min={MESSAGE_GROUP_DEFAULT_AGE_RANGE[0]}
                            max={MESSAGE_GROUP_DEFAULT_AGE_RANGE[1]}
                          />
                        </Form.Item>
                      </Space>
                    </div>
                  </div>

                  <div className="message-groups-editor-row">
                    <div className="message-groups-editor-label">가입 방식</div>
                    <div className="message-groups-editor-content">
                      <Form.Item name="signupMethods" style={{ marginBottom: 0 }}>
                        <MultiCheckboxGroup
                          options={signupMethodOptionValues}
                          value={form.getFieldValue('signupMethods')}
                          onChange={(nextValue) => form.setFieldValue('signupMethods', nextValue)}
                        />
                      </Form.Item>
                    </div>
                  </div>

                  <div className="message-groups-editor-row">
                    <div className="message-groups-editor-label">가입 일자</div>
                    <div className="message-groups-editor-content">
                      <Form.Item name="signupDateRange" style={{ marginBottom: 0 }}>
                        <RangePicker style={{ width: '100%' }} />
                      </Form.Item>
                    </div>
                  </div>

                  <div className="message-groups-editor-row">
                    <div className="message-groups-editor-label">구독 여부</div>
                    <div className="message-groups-editor-content">
                      <Form.Item name="subscriptionStates" style={{ marginBottom: 0 }}>
                        <MultiCheckboxGroup
                          options={subscriptionOptionValues}
                          value={form.getFieldValue('subscriptionStates')}
                          onChange={(nextValue) => form.setFieldValue('subscriptionStates', nextValue)}
                        />
                      </Form.Item>
                    </div>
                  </div>

                  <div className="message-groups-editor-row">
                    <div className="message-groups-editor-label">활동 여부</div>
                    <div className="message-groups-editor-content">
                      <Form.Item name="activityStates" style={{ marginBottom: 0 }}>
                        <MultiCheckboxGroup
                          options={activityOptionValues}
                          value={form.getFieldValue('activityStates')}
                          onChange={(nextValue) => form.setFieldValue('activityStates', nextValue)}
                        />
                      </Form.Item>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="message-groups-editor-row">
                    <div className="message-groups-editor-label">상세 조건</div>
                    <div className="message-groups-editor-content">
                      <div className="message-groups-query-panel">
                        <QueryBuilderGroupEditor
                          group={queryBuilderConfig}
                          isRoot
                          onInteract={() => setQueryBuilderTouched(true)}
                          onChange={(nextGroup) => {
                            setQueryBuilderTouched(true);
                            setQueryBuilderConfig(nextGroup);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="message-groups-editor-row">
                    <div className="message-groups-editor-label">변환된 쿼리</div>
                    <div className="message-groups-editor-content">
                      <Space direction="vertical" style={{ width: '100%' }} size={12}>
                        <Space wrap>
                          {(
                            Object.keys(queryPreviewModeLabels) as QueryPreviewMode[]
                          ).map((mode) => (
                            <Button
                              key={mode}
                              type={queryPreviewMode === mode ? 'primary' : 'default'}
                              onClick={() => setQueryPreviewMode(mode)}
                            >
                              {queryPreviewModeLabels[mode]}
                            </Button>
                          ))}
                        </Space>
                        <Input.TextArea
                          readOnly
                          value={queryPreviewText[queryPreviewMode]}
                          autoSize={{ minRows: 5, maxRows: 10 }}
                        />
                      </Space>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {isSupabaseSource ? (
            <div className="message-groups-editor-row">
              <div className="message-groups-editor-label">사유/근거</div>
              <div className="message-groups-editor-content">
                <Form.Item
                  name="reason"
                  rules={[{ required: true, message: '저장 사유를 입력하세요.' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Input.TextArea rows={3} placeholder="예: 공지 발송 대상 그룹 신설" />
                </Form.Item>
              </div>
            </div>
          ) : null}
        </div>
      </Form>

      <Divider />

      <Descriptions
        size="small"
        column={1}
        bordered
        items={[
          {
            key: 'summary',
            label: '조건 요약',
            children: conditionSummaryPreview
          },
          {
            key: 'preview',
            label: '예상 발송 인원',
            children: (
              <div className="message-groups-count-value-wrap">
                <span
                  className={
                    isDrawerPreviewLoading
                      ? 'message-groups-count-value message-groups-count-value--muted'
                      : 'message-groups-count-value'
                  }
                >
                  {previewCount === null ? '조회하기 전' : `${previewCount.toLocaleString()}명`}
                </span>
                {isDrawerPreviewLoading ? (
                  <Spin size="small" className="message-groups-count-spinner" />
                ) : null}
              </div>
            )
          },
          {
            key: 'lastCalculatedAt',
            label: '마지막 계산',
            children: editorState?.type === 'edit' ? editorState.group.lastCalculatedAt : '-'
          }
        ]}
      />
    </Drawer>
  );
}
