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

const familyNames = ['源', '??, '諛?, '理?, '??, '媛?, '議?, '??, '??, '??] as const;
const givenNames = [
  '?꾩뿰',
  '?섎┛',
  '?좎슦',
  '?좊씪',
  '以??,
  '媛?',
  '?쒖쑄',
  '?섎옒',
  '?꾩꽌',
  '吏??
] as const;

const specialtiesPool = [
  ['?곌린 泥⑥궘', '留먰븯湲?肄붿묶'],
  ['?낅Ц諛?운영', '?쒗뿕 ?鍮?],
  ['鍮꾩쫰?덉뒪 ?쒓뎅??, 'TOPIK II'],
  ['臾몃쾿 ?대━??, '媛쒕퀎 ?쇰뱶諛?],
  ['?뚰솕 吏묒쨷諛?, '怨쇱젣 ?ㅺ퀎']
] as const;

const courseTitles = [
  'TOPIK I ?낅Ц 吏묒쨷諛?,
  'TOPIK II ?ㅼ쟾 臾몄젣대상,
  '?쎄린 ?꾨왂 ?ㅽ꽣??,
  '?곌린 泥⑥궘 肄붿묶',
  '留먰븯湲??명꽣酉??밴컯',
  'EPS TOPIK ?鍮꾨컲',
  '二쇰쭚 ?쒓뎅???대━??
] as const;

const messageTitles = [
  '媛뺤궗 운영 공지',
  '怨쇱젙 ?쇱젙 蹂寃??덈궡',
  '?숈뒿???쇰뱶諛??붿껌',
  '?대㈃ 媛뺤궗 ?먭? ?덈궡'
] as const;

const messageGroupNames = [
  '媛뺤궗 운영 공지',
  'TOPIK II ?대떦 媛뺤궗',
  '?대㈃ 媛뺤궗 ?덈궡',
  '?숇궓???뚰듃??媛뺤궗'
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
  if (status !== '정상' || activityStatus === '?대㈃') {
    return '議곗젙 ?꾩슂';
  }
  if (activityStatus === '二쇱쓽') {
    return '二쇱쓽';
  }
  return '?덉젙';
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
    level: offset % 2 === 0 ? '珥덇툒~以묎툒' : '以묎툒~怨좉툒',
    studentCount: 12 + ((index + offset) % 6) * 6,
    status:
      offset === 0 ? '吏꾪뻾 以? : offset % 2 === 0 ? '以鍮?以? : '醫낅즺 ?덉젙'
  }));
}

function buildMessages(index: number): InstructorMessageHistory[] {
  return Array.from({ length: 3 }, (_, offset) => ({
    id: `MSG-${String(index + 1).padStart(3, '0')}-${offset + 1}`,
    channel: offset % 2 === 0 ? '硫붿씪' : '?몄떆',
    title: messageTitles[(index + offset) % messageTitles.length],
    sentAt: formatDateTime((index % 12) + offset + 1, offset + 2),
    status: offset === 0 ? '발송 완료' : offset === 1 ? '예약' : '珥덉븞'
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
    const dormantOffset = activityStatus === '?대㈃' ? 36 + (index % 12) : 0;
    const cautionOffset = activityStatus === '二쇱쓽' ? 16 + (index % 8) : 0;
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
      introduction: `${organization} ?뚯냽?쇰줈 TOPIK ?숈뒿???⑤낫?⑷낵 怨쇱젙 운영???대떦?섎뒗 媛뺤궗?낅땲??`,
      assignedCourses,
      recentMessages: buildMessages(index),
      adminNotes: [
        {
          id: `NOTE-${String(index + 1).padStart(3, '0')}-1`,
          adminName: 'admin_park',
          content:
            assignmentStatus === '議곗젙 ?꾩슂'
              ? '?대떦 ?숈뒿???щ같???щ?瑜??ㅼ쓬 운영 ?뚯쓽?먯꽌 ?뺤씤 ?덉젙?낅땲?? ?꾩옱 ?대㈃ ?먮뒗 정지 媛?μ꽦???④퍡 寃?좏븯怨??덉뼱, ?泥?媛뺤궗 ? ?뺤씤怨??숈뒿???덈궡 臾몄븞 以鍮꾧? ?꾩슂?⑸땲??'
              : '?붽컙 운영 ?먭? 완료. 異쒓껐, 怨쇱젣 ?뚯닔?? ?쇰뱶諛?SLA瑜??뺤씤?덉쑝硫??꾩옱 異붽? 議곗튂媛 ?꾩슂????ぉ? ?놁뒿?덈떎.',
          createdAt: formatDateTime((index % 20) + 3, 4)
        },
        {
          id: `NOTE-${String(index + 1).padStart(3, '0')}-2`,
          adminName: 'admin_kim',
          content:
            activityStatus === '?대㈃'
              ? '理쒓렐 활동???놁뼱 ?ъ갭???덈궡 硫붿떆吏 발송???꾩슂?⑸땲?? ?ㅼ쓬 ?먭??쇨퉴吏 ?묐떟???놁쑝硫??대떦 怨쇱젙 ?뺣━? 硫붿떆吏 洹몃９ 遺꾨━ ?щ?瑜??ㅼ떆 寃?좏빀?덈떎.'
              : '?숈뒿??留뚯”???쇰뱶諛?정상 ?섏쭛 以묒씠硫? 理쒓렐 臾몄쓽 ?대젰怨??섏뾽 ???ㅻЦ 寃곌낵???덉젙?곸쑝濡??좎??섍퀬 ?덉뒿?덈떎.',
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


