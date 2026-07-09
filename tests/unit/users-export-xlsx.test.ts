import { describe, expect, it } from 'vitest';
import { Workbook } from 'exceljs';

import {
  buildUsersExportFileName,
  buildUsersWorkbook,
  formatKstTimestampLabel,
  getUserExportColumnLabels
} from '../../src/features/users/model/export-users-xlsx';
import type { UsersWorkbookMeta } from '../../src/features/users/model/export-users-xlsx';
import type { UserExportRow } from '../../src/features/users/api/supabase-users-service';
import { filterMockUsersForExport } from '../../src/features/users/api/users-service';
import { mockUsers } from '../../src/features/users/api/mock-users';
import type {
  ExportUsersOptions,
  UserExportColumnKey
} from '../../src/features/users/model/user-export-types';

function makeRow(overrides: Partial<UserExportRow> = {}): UserExportRow {
  return {
    id: 'ef8211f9-7770-4e0b-9c81-1d67795bcdb7',
    realName: '김민준',
    email: 'member1@topik.ai',
    nickname: 'member_1',
    gender: '남성',
    joinedAt: '2026-01-01 09:00',
    lastLoginAt: '2026-07-01 10:30',
    status: '정상',
    registrationStatus: 'active',
    tier: '일반',
    subscriptionStatus: '미구독',
    nationalityCode: 'KR',
    socialProviders: ['google'],
    termsConsentStatus: '동의 완료',
    termsConsentAt: '2026-01-01',
    emailVerificationStatus: '인증 완료',
    affiliationCode: '',
    affiliationLabel: '',
    phoneMasked: '010-****-5678',
    exportPhone: '010-****-5678',
    ...overrides
  };
}

const meta: UsersWorkbookMeta = {
  exportedAtLabel: '2026-07-09 18:30',
  reason: '테스트 반출 사유',
  includeFullPhone: false,
  scopeLabel: '현재 목록 조건',
  filterSummaryLabel: '기관 소속: 전체 회원',
  selectedColumnLabels: [
    '사용자 ID',
    '이름',
    '이메일',
    '닉네임',
    '성별',
    '전화번호',
    '국적',
    '소셜 로그인',
    '기관 코드',
    '기관명',
    '가입일',
    '최근 접속',
    '등급',
    '구독 상태',
    '회원 상태',
    '약관 동의',
    '약관 동의일',
    '이메일 인증'
  ]
};

const baseExportOptions: ExportUsersOptions = {
  reason: '테스트',
  includeFullPhone: false,
  affiliation: null,
  scope: 'filters',
  selectedUserIds: [],
  filters: {
    searchField: 'all',
    keyword: '',
    startDate: '',
    endDate: '',
    affiliation: '',
    genders: [],
    tiers: [],
    subscriptionStatuses: [],
    membershipStatuses: [],
    termsConsentStatuses: [],
    emailVerificationStatuses: []
  },
  columns: ['id']
};

describe('formatKstTimestampLabel', () => {
  it('UTC Date 를 KST(UTC+9) YYYY-MM-DD HH:mm 라벨로 변환한다', () => {
    expect(formatKstTimestampLabel(new Date('2026-07-09T09:30:00Z'))).toBe('2026-07-09 18:30');
    // 날짜 경계(UTC 15시 이후 = KST 다음 날).
    expect(formatKstTimestampLabel(new Date('2026-07-09T16:05:00Z'))).toBe('2026-07-10 01:05');
  });
});

describe('buildUsersExportFileName', () => {
  it('타임스탬프 기반 파일명을 만들고 원문 포함 여부를 파일명에 드러낸다', () => {
    expect(buildUsersExportFileName(meta)).toBe('회원정보_20260709-1830.xlsx');
    expect(buildUsersExportFileName({ ...meta, includeFullPhone: true })).toBe(
      '회원정보_20260709-1830_원문포함.xlsx'
    );
  });
});

describe('buildUsersWorkbook', () => {
  it('회원 목록 시트(헤더+행)와 내보내기 정보 시트를 담은 유효한 xlsx 를 생성한다', async () => {
    const rows = [
      makeRow(),
      makeRow({
        id: 'bad81a34-a221-44eb-91a5-4133f69dd206',
        realName: 'Nguyen Van A',
        nationalityCode: 'VN',
        phoneMasked: '849-****-5678',
        exportPhone: '849-****-5678',
        affiliationCode: 'EXPO2026-BOOTH-A',
        affiliationLabel: '2026 한국어교육 박람회 · A부스'
      })
    ];

    const buffer = await buildUsersWorkbook(rows, meta);
    const reloaded = new Workbook();
    await reloaded.xlsx.load(buffer);

    const list = reloaded.getWorksheet('회원 목록');
    expect(list).toBeTruthy();
    expect(list!.getRow(1).getCell(1).value).toBe('사용자 ID');
    expect(list!.getRow(1).getCell(5).value).toBe('성별');
    expect(list!.getRow(1).getCell(6).value).toBe('전화번호');
    // 데이터 행: 헤더 1행 + 2행.
    expect(list!.actualRowCount).toBe(3);
    expect(list!.getRow(2).getCell(5).value).toBe('남성');
    expect(list!.getRow(2).getCell(6).value).toBe('010-****-5678');
    expect(list!.getRow(3).getCell(10).value).toBe('2026 한국어교육 박람회 · A부스');
    // 국적은 화면과 동일하게 한글 국가명으로 기록된다.
    expect(String(list!.getRow(2).getCell(7).value)).toContain('대한민국');

    const info = reloaded.getWorksheet('내보내기 정보');
    expect(info).toBeTruthy();
    const infoValues = new Map<string, unknown>();
    info!.eachRow((row) => {
      infoValues.set(String(row.getCell(1).value), row.getCell(2).value);
    });
    expect(infoValues.get('내보내기 사유')).toBe('테스트 반출 사유');
    expect(infoValues.get('전화번호 처리')).toBe('마스킹(예: 010-****-5678)');
    expect(infoValues.get('행 수')).toBe(2);
  });

  it('원문 포함 메타는 전화번호 처리 항목에 원문 포함으로 기록된다', async () => {
    const buffer = await buildUsersWorkbook(
      [makeRow({ exportPhone: '010-1234-5678' })],
      { ...meta, includeFullPhone: true }
    );
    const reloaded = new Workbook();
    await reloaded.xlsx.load(buffer);
    const list = reloaded.getWorksheet('회원 목록');
    expect(list!.getRow(2).getCell(6).value).toBe('010-1234-5678');
    const info = reloaded.getWorksheet('내보내기 정보');
    const values: unknown[] = [];
    info!.eachRow((row) => values.push(row.getCell(2).value));
    expect(values).toContain('원문 포함');
  });

  it('선택 컬럼만 회원 목록 헤더와 행에 반영한다', async () => {
    const columns: UserExportColumnKey[] = ['id', 'email', 'phone'];
    const buffer = await buildUsersWorkbook(
      [makeRow()],
      { ...meta, selectedColumnLabels: getUserExportColumnLabels(columns) },
      columns
    );
    const reloaded = new Workbook();
    await reloaded.xlsx.load(buffer);
    const list = reloaded.getWorksheet('회원 목록');

    expect(list!.getRow(1).values).toEqual([
      undefined,
      '사용자 ID',
      '이메일',
      '전화번호'
    ]);
    expect(list!.getRow(2).getCell(1).value).toBe('ef8211f9-7770-4e0b-9c81-1d67795bcdb7');
    expect(list!.getRow(2).getCell(2).value).toBe('member1@topik.ai');
    expect(list!.getRow(2).getCell(3).value).toBe('010-****-5678');
  });

  it('전화번호 컬럼을 제외하면 마스킹/원문 전화번호 값이 파일에 들어가지 않는다', async () => {
    const columns: UserExportColumnKey[] = ['id', 'email'];
    const buffer = await buildUsersWorkbook(
      [
        makeRow({
          phoneMasked: '010-****-9999',
          exportPhone: '010-1234-9999'
        })
      ],
      { ...meta, selectedColumnLabels: getUserExportColumnLabels(columns) },
      columns
    );
    const reloaded = new Workbook();
    await reloaded.xlsx.load(buffer);
    const list = reloaded.getWorksheet('회원 목록');
    const flattenedValues: string[] = [];
    list!.eachRow((row) => {
      row.eachCell((cell) => flattenedValues.push(String(cell.value ?? '')));
    });

    expect(flattenedValues).not.toContain('전화번호');
    expect(flattenedValues).not.toContain('010-****-9999');
    expect(flattenedValues).not.toContain('010-1234-9999');
  });

  it('mock export 범위는 현재 필터와 선택 행을 동일하게 적용한다', () => {
    const affiliatedOnly = filterMockUsersForExport(mockUsers, {
      ...baseExportOptions,
      filters: {
        ...baseExportOptions.filters,
        affiliation: '@affiliated'
      }
    });
    expect(affiliatedOnly.length).toBeGreaterThan(0);
    expect(affiliatedOnly.every((user) => user.affiliationCode.trim() !== '')).toBe(true);

    const keyword = mockUsers[0].email.slice(0, 8);
    const filteredByEmail = filterMockUsersForExport(mockUsers, {
      ...baseExportOptions,
      filters: {
        ...baseExportOptions.filters,
        searchField: 'email',
        keyword
      }
    });
    expect(filteredByEmail.length).toBeGreaterThan(0);
    expect(filteredByEmail.every((user) => user.email.includes(keyword))).toBe(true);

    const selectedIds = [mockUsers[2].id, mockUsers[5].id];
    const selectedOnly = filterMockUsersForExport(mockUsers, {
      ...baseExportOptions,
      scope: 'selected',
      selectedUserIds: selectedIds
    });
    expect(selectedOnly.map((user) => user.id)).toEqual(selectedIds);
  });
});
