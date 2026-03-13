import {
  instructorActivityStatuses,
  instructorCountries,
  instructorOrganizations
} from '../model/types';
import type {
  InstructorActivityStatus,
  InstructorAssignmentStatus,
  InstructorCourseSummary,
  InstructorDetail,
  InstructorMessageHistory,
  InstructorStatus
} from '../model/types';

const familyNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'] as const;
const givenNames = [
  '도연',
  '하린',
  '선우',
  '유라',
  '준호',
  '가은',
  '태윤',
  '나래',
  '현서',
  '지안'
] as const;

const specialtiesPool = [
  ['쓰기 첨삭', '말하기 코칭'],
  ['입문반 운영', '시험 대비'],
  ['비즈니스 한국어', 'TOPIK II'],
  ['문법 클리닉', '개별 피드백'],
  ['회화 집중반', '과제 설계']
] as const;

const courseTitles = [
  'TOPIK I 입문 집중반',
  'TOPIK II 실전 문제풀이',
  '읽기 전략 스터디',
  '쓰기 첨삭 코칭',
  '말하기 인터뷰 특강',
  'EPS TOPIK 대비반',
  '주말 한국어 클리닉'
] as const;

const messageTitles = [
  '강사 운영 공지',
  '과정 일정 변경 안내',
  '학습자 피드백 요청',
  '휴면 강사 점검 안내'
] as const;

const messageGroupNames = [
  '강사 운영 공지',
  'TOPIK II 담당 강사',
  '휴면 강사 안내',
  '동남아 파트너 강사'
] as const;

function formatDateTime(daysAgo: number, hourOffset: number): string {
  const date = new Date(Date.UTC(2026, 2, 12, 9, 0, 0));
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(9 + hourOffset, (daysAgo * 7) % 60, 0, 0);

  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function resolveInstructorStatus(index: number): InstructorStatus {
  if (index % 19 === 0) {
    return '탈퇴';
  }
  if (index % 7 === 0) {
    return '정지';
  }
  return '정상';
}

function resolveActivityStatus(index: number): InstructorActivityStatus {
  if (index % 8 === 0) {
    return instructorActivityStatuses[2];
  }
  if (index % 3 === 0) {
    return instructorActivityStatuses[1];
  }
  return instructorActivityStatuses[0];
}

function resolveAssignmentStatus(
  status: InstructorStatus,
  activityStatus: InstructorActivityStatus
): InstructorAssignmentStatus {
  if (status !== '정상' || activityStatus === '휴면') {
    return '조정 필요';
  }
  if (activityStatus === '주의') {
    return '주의';
  }
  return '안정';
}

function buildCourses(
  index: number,
  status: InstructorStatus
): InstructorCourseSummary[] {
  if (status === '탈퇴') {
    return [];
  }

  const courseCount = (index % 4) + 1;
  return Array.from({ length: courseCount }, (_, offset) => ({
    id: `CRS-${String(index + 1).padStart(3, '0')}-${offset + 1}`,
    title: courseTitles[(index + offset) % courseTitles.length],
    level: offset % 2 === 0 ? '초급~중급' : '중급~고급',
    studentCount: 12 + ((index + offset) % 6) * 6,
    status:
      offset === 0 ? '진행 중' : offset % 2 === 0 ? '준비 중' : '종료 예정'
  }));
}

function buildMessages(index: number): InstructorMessageHistory[] {
  return Array.from({ length: 3 }, (_, offset) => ({
    id: `MSG-${String(index + 1).padStart(3, '0')}-${offset + 1}`,
    channel: offset % 2 === 0 ? '메일' : '푸시',
    title: messageTitles[(index + offset) % messageTitles.length],
    sentAt: formatDateTime((index % 12) + offset + 1, offset + 2),
    status: offset === 0 ? '발송 완료' : offset === 1 ? '예약' : '초안'
  }));
}

function buildInstructorName(index: number): string {
  return `${familyNames[index % familyNames.length]}${givenNames[(index * 2) % givenNames.length]}`;
}

export const mockInstructors: InstructorDetail[] = Array.from(
  { length: 96 },
  (_, index) => {
    const status = resolveInstructorStatus(index);
    const activityStatus = resolveActivityStatus(index);
    const assignmentStatus = resolveAssignmentStatus(status, activityStatus);
    const organization = instructorOrganizations[index % instructorOrganizations.length];
    const country = instructorCountries[index % instructorCountries.length];
    const instructorNumber = String(index + 1).padStart(4, '0');
    const realName = buildInstructorName(index);
    const assignedCourses = buildCourses(index, status);
    const courseCount = assignedCourses.length;
    const studentCount = assignedCourses.reduce(
      (total, course) => total + course.studentCount,
      0
    );
    const dormantOffset = activityStatus === '휴면' ? 36 + (index % 12) : 0;
    const cautionOffset = activityStatus === '주의' ? 16 + (index % 8) : 0;
    const activeOffset = activityStatus === '활성' ? (index % 7) + 1 : 0;
    const lastActivityAt = formatDateTime(
      dormantOffset || cautionOffset || activeOffset,
      (index % 5) + 1
    );
    const lastActionAt = formatDateTime((index % 18) + 2, (index % 4) + 3);
    const messageGroupIndex = index % messageGroupNames.length;

    return {
      id: `INS-${instructorNumber}`,
      realName,
      email: `instructor${index + 1}@topik.ai`,
      nickname: `teacher_${index + 1}`,
      organization,
      country,
      status,
      activityStatus,
      assignmentStatus,
      courseCount,
      studentCount,
      lastActivityAt,
      lastActionAt,
      messageGroupId: `GRP-${String(messageGroupIndex + 1).padStart(3, '0')}`,
      messageGroupName: messageGroupNames[messageGroupIndex],
      specialties: specialtiesPool[index % specialtiesPool.length].slice(),
      introduction: `${organization} 소속으로 TOPIK 학습자 온보딩과 과정 운영을 담당하는 강사입니다.`,
      assignedCourses,
      recentMessages: buildMessages(index),
      adminNotes: [
        {
          id: `NOTE-${String(index + 1).padStart(3, '0')}-1`,
          adminName: 'admin_park',
          content:
            assignmentStatus === '조정 필요'
              ? '담당 학습자 재배정 여부를 다음 운영 회의에서 확인 예정입니다. 현재 휴면 또는 정지 가능성을 함께 검토하고 있어, 대체 강사 풀 확인과 학습자 안내 문안 준비가 필요합니다.'
              : '월간 운영 점검 완료. 출결, 과제 회수율, 피드백 SLA를 확인했으며 현재 추가 조치가 필요한 항목은 없습니다.',
          createdAt: formatDateTime((index % 20) + 3, 4)
        },
        {
          id: `NOTE-${String(index + 1).padStart(3, '0')}-2`,
          adminName: 'admin_kim',
          content:
            activityStatus === '휴면'
              ? '최근 활동이 없어 재참여 안내 메시지 발송이 필요합니다. 다음 점검일까지 응답이 없으면 담당 과정 정리와 메시지 그룹 분리 여부를 다시 검토합니다.'
              : '학습자 만족도 피드백 정상 수집 중이며, 최근 문의 이력과 수업 후 설문 결과도 안정적으로 유지되고 있습니다.',
          createdAt: formatDateTime((index % 24) + 6, 2)
        }
      ]
    };
  }
);

export function getMockInstructorById(
  instructorId: string
): InstructorDetail | undefined {
  return mockInstructors.find((item) => item.id === instructorId);
}
