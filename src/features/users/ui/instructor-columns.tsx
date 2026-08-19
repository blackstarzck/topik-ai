import type { TableColumnsType } from 'antd';

import { instructorStatusFilterValues } from '../model/instructor-management-page-schema';
import {
  instructorActivityStatuses,
  instructorCountries,
  instructorOrganizations
} from '../model/types';
import type {
  InstructorActivityStatus,
  InstructorDetail,
  InstructorStatus
} from '../model/types';
import { renderActivityTag } from './instructor-detail-drawer';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import { TableActionMenu } from '@/shared/ui/table/table-action-menu';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';

// 강사 목록 컬럼 정의 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 조치 핸들러는 페이지가 소유하고 인자로 받는다.
export type InstructorColumnsOptions = {
  onOpenMessageGroup: (messageGroupName: string) => void;
  onSuspend: (instructor: InstructorDetail) => void;
  onUnsuspend: (instructor: InstructorDetail) => void;
};

export function createInstructorColumns({
  onOpenMessageGroup,
  onSuspend,
  onUnsuspend
}: InstructorColumnsOptions): TableColumnsType<InstructorDetail> {
  return [
    {
      title: '강사 ID',
      dataIndex: 'id',
      width: 120,
      sorter: createTextSorter((record) => record.id)
    },
    {
      title: '이름',
      dataIndex: 'realName',
      width: 110,
      sorter: createTextSorter((record) => record.realName)
    },
    {
      title: '이메일',
      dataIndex: 'email',
      width: 220,
      sorter: createTextSorter((record) => record.email)
    },
    {
      title: '소속',
      dataIndex: 'organization',
      width: 180,
      ...createDefinedColumnFilterProps(
        instructorOrganizations,
        (record) => record.organization
      ),
      sorter: createTextSorter((record) => record.organization)
    },
    {
      title: '담당 국가',
      dataIndex: 'country',
      width: 120,
      ...createDefinedColumnFilterProps(instructorCountries, (record) => record.country),
      sorter: createTextSorter((record) => record.country)
    },
    {
      title: createStatusColumnTitle('계정 상태', ['정상', '정지', '탈퇴']),
      dataIndex: 'status',
      width: 120,
      ...createDefinedColumnFilterProps(
        instructorStatusFilterValues,
        (record) => record.status
      ),
      sorter: createTextSorter((record) => record.status),
      render: (status: InstructorStatus) => <StatusBadge status={status} />
    },
    {
      title: createStatusColumnTitle('활동 상태', ['활성', '주의', '휴면']),
      dataIndex: 'activityStatus',
      width: 120,
      ...createDefinedColumnFilterProps(
        instructorActivityStatuses,
        (record) => record.activityStatus
      ),
      sorter: createTextSorter((record) => record.activityStatus),
      render: (status: InstructorActivityStatus) => renderActivityTag(status)
    },
    {
      title: '담당 과정 수',
      dataIndex: 'courseCount',
      width: 130,
      sorter: createNumberSorter((record) => record.courseCount),
      render: (value: number) => `${value}개`
    },
    {
      title: '담당 학습자 수',
      dataIndex: 'studentCount',
      width: 140,
      sorter: createNumberSorter((record) => record.studentCount),
      render: (value: number) => `${value.toLocaleString()}명`
    },
    {
      title: '최근 활동',
      dataIndex: 'lastActivityAt',
      width: 160,
      sorter: createTextSorter((record) => record.lastActivityAt)
    },
    {
      title: '최근 조치일',
      dataIndex: 'lastActionAt',
      width: 160,
      sorter: createTextSorter((record) => record.lastActionAt)
    },
    {
      title: '액션',
      key: 'actions',
      width: 140,
      onCell: () => ({
        onClick: (event) => {
          event.stopPropagation();
        }
      }),
      render: (_, record) => (
        <TableActionMenu
          items={[
            {
              key: `message-group-${record.id}`,
              label: '대상 그룹 보기',
              onClick: () => onOpenMessageGroup(record.messageGroupName)
            },
            {
              key: `suspend-${record.id}`,
              label: '강사 정지',
              danger: true,
              disabled: record.status !== '정상',
              onClick: () => onSuspend(record)
            },
            {
              key: `unsuspend-${record.id}`,
              label: '강사 정지 해제',
              disabled: record.status !== '정지',
              onClick: () => onUnsuspend(record)
            }
          ]}
        />
      )
    }
  ];
}
