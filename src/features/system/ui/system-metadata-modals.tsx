import { Alert, Button, Form, Modal, Space } from 'antd';
import type { FormInstance } from 'antd';
import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { TEXT } from '../model/system-metadata-page-schema';
import type {
  DeleteActionState,
  GroupEditorState,
  GroupFormValues,
  ItemEditorState,
  ItemFormValues
} from '../model/system-metadata-page-schema';
import type { SystemMetadataGroup } from '../model/system-metadata-types';
import {
  createGroupFormDescriptionItems,
  createItemFormDescriptionItems
} from './system-metadata-form-items';
import { AdminFormDescriptions } from '@/shared/ui/descriptions/admin-form-descriptions';
import { SPACE } from '@/shared/styles/design-tokens';

// 운영 설정/운영 값 편집 모달 — Phase 4 분해로 페이지 JSX 에서 통째 이동(동작 동일).
// 폼 인스턴스·에디터 상태·제출 핸들러는 페이지가 소유해 props 로 전달하고,
// 폼 Descriptions 아이템 조립만 모달 내부에서 계산한다.
export type MetadataGroupEditorModalProps = {
  groupEditorState: GroupEditorState;
  setGroupEditorState: Dispatch<SetStateAction<GroupEditorState>>;
  groupForm: FormInstance<GroupFormValues>;
  submittingGroup: boolean;
  handleSubmitGroup: () => Promise<void>;
};

export function MetadataGroupEditorModal({
  groupEditorState,
  setGroupEditorState,
  groupForm,
  submittingGroup,
  handleSubmitGroup
}: MetadataGroupEditorModalProps): JSX.Element {
  const groupFormDescriptionItems = useMemo(() => createGroupFormDescriptionItems(), []);

  return (
    <Modal
      open={Boolean(groupEditorState)}
      title={groupEditorState?.mode === 'edit' ? TEXT.editGroup : TEXT.createGroup}
      okText={groupEditorState?.mode === 'edit' ? '수정' : '추가'}
      cancelText="취소"
      confirmLoading={submittingGroup}
      zIndex={1400}
      width={760}
      forceRender
      okButtonProps={{ 'data-testid': 'group-submit-button' }}
      onCancel={() => setGroupEditorState(null)}
      onOk={() => void handleSubmitGroup()}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: SPACE.base }}
        message="여러 화면과 기능에서 공통으로 재사용하는 운영 설정을 만들거나 정리할 때 사용합니다."
        description="개별 화면 전용 문구나 임시 UI 값이 아니라, 여러 화면에서 공통으로 쓰는 선택지·상태값·노출 규칙만 등록하는 것을 기본으로 합니다. 연결 route는 참고용 정보이고, 실제 운영 조작은 상세 Drawer의 `설정 구조`와 `지금 운영 중인 값`에서 확인합니다."
      />
      <Form<GroupFormValues> form={groupForm}>
        <AdminFormDescriptions
          bordered
          size="small"
          column={2}
          items={groupFormDescriptionItems}
          requiredKeys={[
            'groupName',
            'managerType',
            'ownerModule',
            'ownerRole',
            'syncStatus',
            'exposureStatus',
            'itemCodePrefix',
            'description',
            'linkedAdminPagesText'
          ]}
        />
      </Form>
    </Modal>
  );
}

export type MetadataItemEditorModalProps = {
  itemEditorState: ItemEditorState;
  setItemEditorState: Dispatch<SetStateAction<ItemEditorState>>;
  itemEditorGroup: SystemMetadataGroup | null;
  itemForm: FormInstance<ItemFormValues>;
  submittingItem: boolean;
  handleSubmitItem: () => Promise<void>;
  selectedGroup: SystemMetadataGroup | null;
  setPendingDeleteActionState: Dispatch<SetStateAction<DeleteActionState>>;
};

export function MetadataItemEditorModal({
  itemEditorState,
  setItemEditorState,
  itemEditorGroup,
  itemForm,
  submittingItem,
  handleSubmitItem,
  selectedGroup,
  setPendingDeleteActionState
}: MetadataItemEditorModalProps): JSX.Element {
  const itemFormDescriptionItems = useMemo(
    () => createItemFormDescriptionItems(itemEditorGroup, itemEditorState),
    [itemEditorGroup, itemEditorState]
  );

  return (
    <Modal
      open={Boolean(itemEditorState)}
      title={itemEditorState?.item ? TEXT.editItem : TEXT.createItem}
      okText={itemEditorState?.item ? '수정' : '추가'}
      cancelText="취소"
      confirmLoading={submittingItem}
      zIndex={1400}
      width={760}
      forceRender
      onCancel={() => setItemEditorState(null)}
      onOk={() => void handleSubmitItem()}
      footer={
        itemEditorState?.item ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: SPACE.sm
            }}
          >
            <Button
              danger
              data-testid="metadata-item-delete-button"
              onClick={() => {
                if (!selectedGroup || !itemEditorState.item) {
                  return;
                }
                setPendingDeleteActionState({
                  group: selectedGroup,
                  item: itemEditorState.item
                });
                setItemEditorState(null);
              }}
            >
              운영 값 삭제
            </Button>
            <Space>
              <Button onClick={() => setItemEditorState(null)}>취소</Button>
              <Button
                type="primary"
                data-testid="item-submit-button"
                loading={submittingItem}
                onClick={() => void handleSubmitItem()}
              >
                수정
              </Button>
            </Space>
          </div>
        ) : (
          <Space>
            <Button onClick={() => setItemEditorState(null)}>취소</Button>
            <Button
              type="primary"
              data-testid="item-submit-button"
              loading={submittingItem}
              onClick={() => void handleSubmitItem()}
            >
              추가
            </Button>
          </Space>
        )
      }
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: SPACE.base }}
        message="운영 값은 실제 선택지, 상태값, 노출 값 항목입니다."
        description="라벨은 운영자가 이해하기 쉽게 작성하고, 코드는 감사 로그와 API 추적을 위한 식별자이므로 prefix 규칙을 유지해 주세요. 현재 mock 데이터 기준으로 같은 설정 그룹 안에서는 코드와 라벨 중복을 허용하지 않습니다."
      />
      <Form<ItemFormValues> form={itemForm}>
        <AdminFormDescriptions
          bordered
          size="small"
          column={2}
          items={itemFormDescriptionItems}
          requiredKeys={[
            'code',
            'label',
            'status',
            'sortOrder',
            'isDefault',
            'exposureStatus',
            'description'
          ]}
        />
      </Form>
    </Modal>
  );
}
