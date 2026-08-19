import type { TableColumnsType } from 'antd';

import {
  messageTemplateStatusFilterValues,
  renderMessageGroupNames
} from '../model/message-channel-page-schema';
import type {
  MessageGroup,
  MessageTemplate,
  MessageTemplateMode,
  MessageTemplateStatus
} from '../model/types';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { BinaryStatusSwitch } from '@/shared/ui/table/binary-status-switch';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import { TableActionMenu } from '@/shared/ui/table/table-action-menu';
import type { TableActionMenuItem } from '@/shared/ui/table/table-action-menu';
import {
  createDefinedColumnFilterProps,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';

// 채널 공용 템플릿 목록 컬럼·행 액션·탭 정의 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 발송/수정/삭제 핸들러와 모드 상태는 페이지가 소유하고 인자로 받는다.

export type MessageTemplateActionItemsOptions = {
  activeMode: MessageTemplateMode;
  isSendBlocked: boolean;
  onEditMeta: (template: MessageTemplate) => void;
  onTestSend: (template: MessageTemplate) => void;
  onLiveSend: (template: MessageTemplate) => void;
  onDelete: (template: MessageTemplate) => void;
};

export function createMessageTemplateActionItems(
  template: MessageTemplate,
  {
    activeMode,
    isSendBlocked,
    onEditMeta,
    onTestSend,
    onLiveSend,
    onDelete
  }: MessageTemplateActionItemsOptions
): TableActionMenuItem[] {
  const commonItems = [
    {
      key: `edit-meta-${template.id}`,
      label: '템플릿 정보 수정',
      onClick: () => onEditMeta(template)
    },
    {
      key: `test-${template.id}`,
      label: '나에게 보내기',
      disabled: isSendBlocked,
      onClick: () => onTestSend(template)
    }
  ];

  if (activeMode === 'auto') {
    return [
      ...commonItems,
      {
        key: `send-${template.id}`,
        label: '즉시 실행',
        disabled: isSendBlocked,
        onClick: () => onLiveSend(template)
      },
      {
        key: `delete-${template.id}`,
        label: '템플릿 삭제',
        danger: true,
        onClick: () => onDelete(template)
      }
    ];
  }

  return [
    ...commonItems,
    {
      key: `send-${template.id}`,
      label: '즉시/예약 발송',
      disabled: isSendBlocked,
      onClick: () => onLiveSend(template)
    },
    {
      key: `delete-${template.id}`,
      label: '템플릿 삭제',
      danger: true,
      onClick: () => onDelete(template)
    }
  ];
}

export type MessageChannelColumnsOptions = {
  activeMode: MessageTemplateMode;
  groups: MessageGroup[];
  categories: string[];
  subjectLabel: string;
  buildActionItems: (template: MessageTemplate) => TableActionMenuItem[];
  onStatusToggle: (template: MessageTemplate) => void;
};

export function createMessageChannelColumns({
  activeMode,
  groups,
  categories,
  subjectLabel,
  buildActionItems,
  onStatusToggle
}: MessageChannelColumnsOptions): TableColumnsType<MessageTemplate> {
  const baseColumns: TableColumnsType<MessageTemplate> = [
    {
      title: '템플릿 ID',
      dataIndex: 'id',
      width: 150,
      sorter: createTextSorter((record) => record.id)
    },
    {
      title: '카테고리',
      dataIndex: 'category',
      width: 120,
      ...createDefinedColumnFilterProps(categories, (record) => record.category),
      sorter: createTextSorter((record) => record.category)
    },
    {
      title: '템플릿명',
      dataIndex: 'name',
      width: 220,
      sorter: createTextSorter((record) => record.name)
    },
    {
      title: subjectLabel,
      dataIndex: 'subject',
      width: 260,
      sorter: createTextSorter((record) => record.subject)
    },
    {
      title: '발송 그룹',
      dataIndex: 'targetGroupIds',
      width: 220,
      sorter: createTextSorter((record) =>
        renderMessageGroupNames(groups, record.targetGroupIds)
      ),
      render: (targetGroupIds: string[]) =>
        renderMessageGroupNames(groups, targetGroupIds)
    }
  ];

  if (activeMode === 'auto') {
    baseColumns.push(
      {
        title: '자동 조건',
        dataIndex: 'triggerLabel',
        width: 180,
        sorter: createTextSorter((record) => record.triggerLabel ?? ''),
        render: (value?: string) => value ?? '-'
      },
      {
        title: '최근 발송',
        dataIndex: 'lastSentAt',
        width: 160,
        sorter: createTextSorter((record) => record.lastSentAt ?? ''),
        render: (value?: string) => value ?? '-'
      }
    );
  } else {
    baseColumns.push({
      title: '최근 수정',
      dataIndex: 'updatedAt',
      width: 160,
      sorter: createTextSorter((record) => record.updatedAt)
    });
  }

  baseColumns.push(
    {
      title: createStatusColumnTitle('상태', ['활성', '비활성', '초안']),
      dataIndex: 'status',
      width: activeMode === 'auto' ? 120 : 100,
      ...createDefinedColumnFilterProps(
        messageTemplateStatusFilterValues,
        (record) => record.status
      ),
      sorter: createTextSorter((record) => record.status),
      render: (status: MessageTemplateStatus, record) =>
        activeMode === 'auto' && (status === '활성' || status === '비활성') ? (
          <BinaryStatusSwitch
            checked={status === '활성'}
            checkedLabel="활성"
            uncheckedLabel="비활성"
            onToggle={() => onStatusToggle(record)}
          />
        ) : (
          <StatusBadge status={status} />
        )
    },
    {
      title: '액션',
      key: 'actions',
      width: 150,
      onCell: () => ({
        onClick: (event) => {
          event.stopPropagation();
        }
      }),
      render: (_, record) => <TableActionMenu items={buildActionItems(record)} />
    }
  );

  return baseColumns;
}

export function createMessageChannelTabItems(
  templates: MessageTemplate[]
): Array<{ key: string; label: string }> {
  return [
    {
      key: 'auto',
      label: `자동 발송 (${templates.filter((template) => template.mode === 'auto').length})`
    },
    {
      key: 'manual',
      label: `수동 발송 (${templates.filter((template) => template.mode === 'manual').length})`
    }
  ];
}
