import { Form, Input, Select } from 'antd';
import type { DescriptionsProps } from 'antd';

import {
  DEFAULT_VALUE_SELECT_OPTIONS,
  EXPOSURE_STATUS_SELECT_OPTIONS,
  MANAGER_TYPE_SELECT_OPTIONS,
  OWNER_MODULE_SELECT_OPTIONS,
  STATUS_SELECT_OPTIONS,
  SYNC_STATUS_SELECT_OPTIONS,
  TEXT,
  normalizeDuplicateValue
} from '../model/system-metadata-page-schema';
import type { ItemEditorState } from '../model/system-metadata-page-schema';
import type { SystemMetadataGroup } from '../model/system-metadata-types';
import { createHelpLabel } from './system-metadata-render-utils';

const { TextArea } = Input;

// 운영 설정/운영 값 폼 Descriptions 아이템 — Phase 4 분해로 페이지 useMemo 본문에서
// 이동(동작 동일). Form.Item 은 상위 <Form> 컨텍스트로 동작하고, 코드/라벨 중복 검증에
// 필요한 편집 그룹·에디터 상태만 인자로 받는다.
export function createGroupFormDescriptionItems(): DescriptionsProps['items'] {
  return [
    {
      key: 'groupName',
      label: '설정명',
      children: (
        <Form.Item
          name="groupName"
          rules={[{ required: true, message: '설정명을 입력해 주세요.' }]}
        >
          <Input />
        </Form.Item>
      )
    },
    {
      key: 'managerType',
      label: createHelpLabel(
        '관리 방식',
        '공통 상태값, 선택 옵션, 노출 규칙처럼 이 설정이 어떤 형태로 쓰이는지 정의합니다.'
      ),
      children: (
        <Form.Item
          name="managerType"
          rules={[{ required: true, message: '관리 방식을 선택해 주세요.' }]}
        >
          <Select options={MANAGER_TYPE_SELECT_OPTIONS} />
        </Form.Item>
      )
    },
    {
      key: 'ownerModule',
      label: '소속 기능',
      children: (
        <Form.Item
          name="ownerModule"
          rules={[{ required: true, message: '소속 기능을 선택해 주세요.' }]}
        >
          <Select options={OWNER_MODULE_SELECT_OPTIONS} />
        </Form.Item>
      )
    },
    {
      key: 'ownerRole',
      label: '관리 책임 역할',
      children: (
        <Form.Item
          name="ownerRole"
          rules={[{ required: true, message: '관리 책임 역할을 입력해 주세요.' }]}
        >
          <Input />
        </Form.Item>
      )
    },
    {
      key: 'syncStatus',
      label: createHelpLabel(
        '동기화 상태',
        '운영 중인지, 검토가 필요한지, 아직 초안인지 같은 관리 상태를 뜻합니다.'
      ),
      children: (
        <Form.Item
          name="syncStatus"
          rules={[{ required: true, message: '동기화 상태를 선택해 주세요.' }]}
        >
          <Select options={SYNC_STATUS_SELECT_OPTIONS} />
        </Form.Item>
      )
    },
    {
      key: 'exposureStatus',
      label: createHelpLabel(
        '사용자 영향',
        '이 설정이 실제 사용자 화면에 반영되는지, 아니면 내부 운영 데이터인지 구분합니다.'
      ),
      children: (
        <Form.Item
          name="exposureStatus"
          rules={[{ required: true, message: '사용자 영향 범위를 선택해 주세요.' }]}
        >
          <Select options={EXPOSURE_STATUS_SELECT_OPTIONS} />
        </Form.Item>
      )
    },
    {
      key: 'itemCodePrefix',
      label: createHelpLabel(
        '운영 값 코드 prefix',
        '운영 값 코드가 같은 규칙으로 생성되도록 묶는 접두사입니다.'
      ),
      span: 2,
      children: (
        <Form.Item
          name="itemCodePrefix"
          rules={[{ required: true, message: '운영 값 코드 prefix를 입력해 주세요.' }]}
        >
          <Input />
        </Form.Item>
      )
    },
    {
      key: 'description',
      label: '운영 목적',
      span: 2,
      children: (
        <Form.Item
          name="description"
          rules={[{ required: true, message: '운영 목적을 입력해 주세요.' }]}
        >
          <TextArea rows={3} />
        </Form.Item>
      )
    },
    {
      key: 'linkedAdminPagesText',
      label: createHelpLabel(
        '연결 route',
        '이 설정을 참조하는 관리자 route를 참고용으로 등록합니다.'
      ),
      span: 2,
      children: (
        <Form.Item
          name="linkedAdminPagesText"
          rules={[{ required: true, message: '연결 route를 1개 이상 입력해 주세요.' }]}
        >
          <TextArea rows={3} />
        </Form.Item>
      )
    },
    {
      key: 'linkedUserSurfacesText',
      label: '사용자 화면',
      span: 2,
      children: (
        <Form.Item name="linkedUserSurfacesText">
          <TextArea rows={3} />
        </Form.Item>
      )
    },
    {
      key: 'schemaCandidateNotesText',
      label: createHelpLabel(
        '연동/검토 메모',
        'API 연동, 코드 테이블 규격, 검토 사인오프처럼 운영자가 참고해야 하는 메모입니다.'
      ),
      span: 2,
      children: (
        <Form.Item name="schemaCandidateNotesText">
          <TextArea rows={3} />
        </Form.Item>
      )
    }
  ];
}

export function createItemFormDescriptionItems(
  itemEditorGroup: SystemMetadataGroup | null,
  itemEditorState: ItemEditorState
): DescriptionsProps['items'] {
  return [
    {
      key: 'code',
      label: createHelpLabel(
        '운영 값 코드',
        '로그와 API에서 데이터를 찾을 때 쓰는 식별자입니다. 같은 prefix 규칙을 유지해 주세요.'
      ),
      children: (
        <Form.Item
          name="code"
          rules={[
            { required: true, message: '운영 값 코드를 입력해 주세요.' },
            {
              validator: async (_, value: string | undefined) => {
                const normalizedValue = normalizeDuplicateValue(value ?? '').toUpperCase();
                if (!normalizedValue || !itemEditorGroup) {
                  return;
                }

                const duplicatedItem = itemEditorGroup.items.find(
                  (item) =>
                    item.itemId !== itemEditorState?.item?.itemId &&
                    item.code.trim().toUpperCase() === normalizedValue
                );

                if (duplicatedItem) {
                  throw new Error('같은 운영 값 코드가 이미 존재합니다.');
                }
              }
            }
          ]}
        >
          <Input />
        </Form.Item>
      )
    },
    {
      key: 'label',
      label: '운영 값 라벨',
      children: (
        <Form.Item
          name="label"
          rules={[
            { required: true, message: '운영 값 라벨을 입력해 주세요.' },
            {
              validator: async (_, value: string | undefined) => {
                const normalizedValue = normalizeDuplicateValue(value ?? '');
                if (!normalizedValue || !itemEditorGroup) {
                  return;
                }

                const duplicatedItem = itemEditorGroup.items.find(
                  (item) =>
                    item.itemId !== itemEditorState?.item?.itemId &&
                    normalizeDuplicateValue(item.label) === normalizedValue
                );

                if (duplicatedItem) {
                  throw new Error('같은 운영 값 라벨이 이미 존재합니다.');
                }
              }
            }
          ]}
        >
          <Input />
        </Form.Item>
      )
    },
    {
      key: 'status',
      label: '상태',
      children: (
        <Form.Item
          name="status"
          rules={[{ required: true, message: '상태를 선택해 주세요.' }]}
        >
          <Select options={STATUS_SELECT_OPTIONS} />
        </Form.Item>
      )
    },
    {
      key: 'sortOrder',
      label: '정렬 순서',
      children: (
        <Form.Item
          name="sortOrder"
          rules={[{ required: true, message: '정렬 순서를 입력해 주세요.' }]}
        >
          <Input type="number" min={1} />
        </Form.Item>
      )
    },
    {
      key: 'isDefault',
      label: createHelpLabel(
        TEXT.defaultValue,
        '운영자가 별도 선택을 하지 않았을 때 기본으로 적용될 값을 뜻합니다.'
      ),
      children: (
        <Form.Item
          name="isDefault"
          rules={[{ required: true, message: '기본값 여부를 선택해 주세요.' }]}
        >
          <Select options={[...DEFAULT_VALUE_SELECT_OPTIONS]} />
        </Form.Item>
      )
    },
    {
      key: 'exposureStatus',
      label: createHelpLabel(
        '사용자 영향',
        '운영 값이 사용자 화면까지 연결되는 값인지, 내부 운영 전용인지 표시합니다.'
      ),
      children: (
        <Form.Item
          name="exposureStatus"
          rules={[{ required: true, message: '사용자 영향 범위를 선택해 주세요.' }]}
        >
          <Select options={EXPOSURE_STATUS_SELECT_OPTIONS} />
        </Form.Item>
      )
    },
    {
      key: 'description',
      label: '값 설명',
      span: 2,
      children: (
        <Form.Item
          name="description"
          rules={[{ required: true, message: '값 설명을 입력해 주세요.' }]}
        >
          <TextArea rows={4} />
        </Form.Item>
      )
    }
  ];
}
