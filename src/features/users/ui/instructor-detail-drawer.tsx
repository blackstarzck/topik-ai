import { Alert, Button, Descriptions, Space, Tag, Typography } from 'antd';
import type { DescriptionsProps, TableColumnsType } from 'antd';

import { summarizeNoteContent } from '../model/instructor-management-page-schema';
import type {
  InstructorAdminNote,
  InstructorActivityStatus,
  InstructorCourseSummary,
  InstructorDetail,
  InstructorMessageHistory
} from '../model/types';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '@/shared/ui/detail-drawer/detail-drawer';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import {
  createDrawerTableScroll,
  DRAWER_TABLE_PAGINATION,
  fixDrawerTableFirstColumn
} from '@/shared/ui/table/drawer-table';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import { formatUserDisplayName } from '@/shared/ui/user/user-reference';
import { SPACE } from '@/shared/styles/design-tokens';
import {
  createNumberSorter,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;

// 강사 상세 Drawer 와 그 안의 표시 계층 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 열림 판정·조치 확정·이동은 페이지가 소유하고 콜백으로 받는다.

export function renderActivityTag(status: InstructorActivityStatus): JSX.Element {
  const color =
    status === '활성' ? 'green' : status === '주의' ? 'orange' : 'default';

  return <Tag color={color}>{status}</Tag>;
}

function renderCourseStatusTag(
  status: InstructorCourseSummary['status']
): JSX.Element {
  const color =
    status === '진행 중' ? 'green' : status === '준비 중' ? 'gold' : 'default';

  return <Tag color={color}>{status}</Tag>;
}

function renderMessageStatusTag(
  status: InstructorMessageHistory['status']
): JSX.Element {
  const color =
    status === '발송 완료' ? 'green' : status === '예약' ? 'cyan' : 'gold';

  return <Tag color={color}>{status}</Tag>;
}

function buildSummaryItems(
  instructor: InstructorDetail
): DescriptionsProps['items'] {
  return [
    { key: 'id', label: '강사 ID', children: instructor.id },
    {
      key: 'realName',
      label: '이름',
      children: formatUserDisplayName(instructor.realName, instructor.id)
    },
    { key: 'email', label: '이메일', children: instructor.email },
    { key: 'organization', label: '소속', children: instructor.organization },
    { key: 'country', label: '담당 국가', children: instructor.country },
    {
      key: 'status',
      label: '계정 상태',
      children: <StatusBadge status={instructor.status} />
    },
    {
      key: 'activityStatus',
      label: '활동 상태',
      children: renderActivityTag(instructor.activityStatus)
    },
    {
      key: 'assignmentStatus',
      label: '배정 상태',
      children: instructor.assignmentStatus
    },
    {
      key: 'courseCount',
      label: '담당 과정 수',
      children: `${instructor.courseCount}개`
    },
    {
      key: 'studentCount',
      label: '담당 학습자 수',
      children: `${instructor.studentCount.toLocaleString()}명`
    },
    {
      key: 'lastActivityAt',
      label: '최근 활동',
      children: instructor.lastActivityAt
    },
    {
      key: 'lastActionAt',
      label: '최근 조치일',
      children: instructor.lastActionAt
    }
  ];
}

const courseColumns: TableColumnsType<InstructorCourseSummary> =
  fixDrawerTableFirstColumn<InstructorCourseSummary>([
    {
      title: '과정 ID',
      dataIndex: 'id',
      width: 120,
      sorter: createTextSorter((record) => record.id)
    },
    {
      title: '과정명',
      dataIndex: 'title',
      ellipsis: true,
      sorter: createTextSorter((record) => record.title)
    },
    {
      title: '난이도',
      dataIndex: 'level',
      width: 120,
      sorter: createTextSorter((record) => record.level)
    },
    {
      title: '학습자 수',
      dataIndex: 'studentCount',
      width: 110,
      sorter: createNumberSorter((record) => record.studentCount),
      render: (value: number) => `${value.toLocaleString()}명`
    },
    {
      title: createStatusColumnTitle('과정 상태', ['진행 중', '준비 중', '종료 예정']),
      dataIndex: 'status',
      width: 120,
      sorter: createTextSorter((record) => record.status),
      render: (status: InstructorCourseSummary['status']) =>
        renderCourseStatusTag(status)
    }
  ]);

const messageColumns: TableColumnsType<InstructorMessageHistory> =
  fixDrawerTableFirstColumn<InstructorMessageHistory>([
    {
      title: '발송 ID',
      dataIndex: 'id',
      width: 120,
      sorter: createTextSorter((record) => record.id)
    },
    {
      title: '채널',
      dataIndex: 'channel',
      width: 90,
      sorter: createTextSorter((record) => record.channel)
    },
    {
      title: '제목',
      dataIndex: 'title',
      ellipsis: true,
      sorter: createTextSorter((record) => record.title)
    },
    {
      title: '발송 시각',
      dataIndex: 'sentAt',
      width: 150,
      sorter: createTextSorter((record) => record.sentAt)
    },
    {
      title: createStatusColumnTitle('상태', ['발송 완료', '예약', '초안']),
      dataIndex: 'status',
      width: 120,
      sorter: createTextSorter((record) => record.status),
      render: (status: InstructorMessageHistory['status']) =>
        renderMessageStatusTag(status)
    }
  ]);

const adminNoteColumns: TableColumnsType<InstructorAdminNote> =
  fixDrawerTableFirstColumn<InstructorAdminNote>([
    {
      title: '메모 ID',
      dataIndex: 'id',
      width: 120,
      sorter: createTextSorter((record) => record.id)
    },
    {
      title: '작성 관리자',
      dataIndex: 'adminName',
      width: 120,
      sorter: createTextSorter((record) => record.adminName)
    },
    {
      title: '작성일',
      dataIndex: 'createdAt',
      width: 150,
      sorter: createTextSorter((record) => record.createdAt)
    },
    {
      title: '메모 요약',
      dataIndex: 'content',
      ellipsis: true,
      render: (content: string) => (
        <Text type="secondary">{summarizeNoteContent(content)}</Text>
      ),
      sorter: createTextSorter((record) => record.content)
    }
  ]);

function buildDrawerStatusAlert(instructor: InstructorDetail): {
  type: 'warning' | 'info';
  message: string;
  description: string;
} | null {
  if (instructor.status === '정지') {
    return {
      type: 'warning',
      message: '현재 정지 상태인 강사입니다.',
      description: '학습자 재배정 여부와 메시지 발송 필요 여부를 함께 확인하세요.'
    };
  }
  if (instructor.activityStatus === '휴면') {
    return {
      type: 'info',
      message: '최근 활동이 오래 없어 점검이 필요합니다.',
      description: '휴면 강사 안내와 담당 과정 상태를 함께 확인하세요.'
    };
  }
  if (instructor.assignmentStatus === '조정 필요') {
    return {
      type: 'warning',
      message: '담당 과정 또는 학습자 배정 조정이 필요합니다.',
      description: '운영 메모와 최근 조치일을 확인한 뒤 후속 조치를 진행하세요.'
    };
  }
  return null;
}

export type InstructorDetailDrawerProps = {
  instructor: InstructorDetail | null;
  onClose: () => void;
  onOpenMessageGroup: (messageGroupName: string) => void;
  onSuspend: (instructor: InstructorDetail) => void;
  onUnsuspend: (instructor: InstructorDetail) => void;
};

export function InstructorDetailDrawer({
  instructor: selectedInstructor,
  onClose,
  onOpenMessageGroup,
  onSuspend,
  onUnsuspend
}: InstructorDetailDrawerProps): JSX.Element {
  const drawerStatusAlert = selectedInstructor
    ? buildDrawerStatusAlert(selectedInstructor)
    : null;

  return (
    <DetailDrawer
      open={Boolean(selectedInstructor)}
      title={selectedInstructor ? `강사 상세 · ${selectedInstructor.realName}` : '강사 상세'}
      width={640}
      onClose={onClose}
      headerMeta={
        selectedInstructor ? (
          <Space>
            <StatusBadge status={selectedInstructor.status} />
            {renderActivityTag(selectedInstructor.activityStatus)}
          </Space>
        ) : null
      }
      footerStart={
        selectedInstructor ? (
          <AuditLogLink
            targetType="Instructor"
            targetId={selectedInstructor.id}
          />
        ) : null
      }
      footerEnd={
        selectedInstructor ? (
          <Space wrap>
            <Button
              onClick={() => onOpenMessageGroup(selectedInstructor.messageGroupName)}
            >
              대상 그룹 보기
            </Button>
            {selectedInstructor.status === '정지' ? (
              <Button
                type="primary"
                onClick={() => onUnsuspend(selectedInstructor)}
              >
                정지 해제
              </Button>
            ) : (
              <Button
                danger
                type="primary"
                onClick={() => onSuspend(selectedInstructor)}
              >
                강사 정지
              </Button>
            )}
          </Space>
        ) : null
      }
    >
      {selectedInstructor ? (
        <DetailDrawerBody>
          {drawerStatusAlert ? (
            <Alert
              type={drawerStatusAlert.type}
              showIcon
              message={drawerStatusAlert.message}
              description={drawerStatusAlert.description}
            />
          ) : null}

          <DetailDrawerSection title="기본 정보">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={buildSummaryItems(selectedInstructor)}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="소개 및 전문 분야">
            <Paragraph style={{ marginBottom: SPACE.xs }}>
              {selectedInstructor.introduction}
            </Paragraph>
            <Space wrap>
              {selectedInstructor.specialties.map((specialty) => (
                <Tag key={specialty}>{specialty}</Tag>
              ))}
            </Space>
          </DetailDrawerSection>

          <DetailDrawerSection title="담당 과정">
            <AdminDataTable<InstructorCourseSummary>
              rowKey="id"
              columns={courseColumns}
              dataSource={selectedInstructor.assignedCourses}
              pagination={DRAWER_TABLE_PAGINATION}
              scroll={createDrawerTableScroll(760)}
              locale={{ emptyText: '배정된 과정이 없습니다.' }}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="최근 메시지 발송 이력">
            <AdminDataTable<InstructorMessageHistory>
              rowKey="id"
              columns={messageColumns}
              dataSource={selectedInstructor.recentMessages}
              pagination={DRAWER_TABLE_PAGINATION}
              scroll={createDrawerTableScroll(760)}
              locale={{ emptyText: '최근 발송 이력이 없습니다.' }}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="관리자 메모">
            <AdminDataTable<InstructorAdminNote>
              rowKey="id"
              columns={adminNoteColumns}
              dataSource={selectedInstructor.adminNotes}
              expandable={{
                fixed: 'left',
                expandRowByClick: true,
                expandedRowRender: (note) => (
                  <Paragraph
                    style={{ margin: 0, whiteSpace: 'pre-wrap' }}
                  >
                    {note.content}
                  </Paragraph>
                ),
                rowExpandable: (note) => Boolean(note.content.trim())
              }}
              pagination={DRAWER_TABLE_PAGINATION}
              scroll={createDrawerTableScroll(760)}
              locale={{ emptyText: '등록된 관리자 메모가 없습니다.' }}
            />
          </DetailDrawerSection>
        </DetailDrawerBody>
      ) : null}
    </DetailDrawer>
  );
}
