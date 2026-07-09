import { formatNationality } from '../../../shared/model/country-name';
import {
  getTermsConsentDisplayStatus,
  getUserMembershipStatus
} from './registration-status';
import {
  defaultUserExportColumnKeys,
  requiredUserExportColumnKeys,
  type UserExportColumnKey,
  type UserExportRow
} from './user-export-types';

/**
 * 회원 정보 내보내기(.xlsx) 파일 생성.
 *
 * - exceljs 는 dynamic import 로만 로드해 메인 번들에서 제외한다(내보내기 실행 시 1회).
 * - '회원 목록' 시트: 화면(회원 목록/상세)과 동일한 표시 규칙(회원 상태·약관 동의 파생,
 *   국적 한글명)을 재사용한다. 선택된 컬럼만 기록한다.
 * - '내보내기 정보' 시트: 반출 이력 메타(일시·사유·전화번호 처리·범위·필터·컬럼·행수)를
 *   파일 안에 같이 남긴다.
 */
export type UsersWorkbookMeta = {
  // 'YYYY-MM-DD HH:mm' (KST) — 파일명과 '내보내기 정보' 시트에 기록.
  exportedAtLabel: string;
  reason: string;
  includeFullPhone: boolean;
  // 내보내기 범위 라벨(예: '현재 목록 조건', '선택한 회원만').
  scopeLabel: string;
  filterSummaryLabel: string;
  selectedColumnLabels: string[];
};

type UserExportColumnDefinition = {
  key: UserExportColumnKey;
  header: string;
  width: number;
  value: (row: UserExportRow) => string;
};

export const userExportColumnRegistry: Record<UserExportColumnKey, UserExportColumnDefinition> = {
  id: {
    key: 'id',
    header: '사용자 ID',
    width: 38,
    value: (row) => row.id
  },
  realName: {
    key: 'realName',
    header: '이름',
    width: 14,
    value: (row) => row.realName
  },
  email: {
    key: 'email',
    header: '이메일',
    width: 28,
    value: (row) => row.email
  },
  nickname: {
    key: 'nickname',
    header: '닉네임',
    width: 16,
    value: (row) => row.nickname
  },
  gender: {
    key: 'gender',
    header: '성별',
    width: 10,
    value: (row) => row.gender
  },
  phone: {
    key: 'phone',
    header: '전화번호',
    width: 18,
    value: (row) => row.exportPhone
  },
  nationality: {
    key: 'nationality',
    header: '국적',
    width: 12,
    value: (row) => formatNationality(row.nationalityCode)
  },
  socialProviders: {
    key: 'socialProviders',
    header: '소셜 로그인',
    width: 16,
    value: (row) => row.socialProviders.join(', ')
  },
  affiliationCode: {
    key: 'affiliationCode',
    header: '기관 코드',
    width: 20,
    value: (row) => row.affiliationCode
  },
  affiliationLabel: {
    key: 'affiliationLabel',
    header: '기관명',
    width: 26,
    value: (row) => row.affiliationLabel
  },
  joinedAt: {
    key: 'joinedAt',
    header: '가입일',
    width: 18,
    value: (row) => row.joinedAt
  },
  lastLoginAt: {
    key: 'lastLoginAt',
    header: '최근 접속',
    width: 18,
    value: (row) => row.lastLoginAt
  },
  tier: {
    key: 'tier',
    header: '등급',
    width: 10,
    value: (row) => row.tier
  },
  subscriptionStatus: {
    key: 'subscriptionStatus',
    header: '구독 상태',
    width: 10,
    value: (row) => row.subscriptionStatus
  },
  membershipStatus: {
    key: 'membershipStatus',
    header: '회원 상태',
    width: 12,
    value: (row) => getUserMembershipStatus(row)
  },
  termsConsentStatus: {
    key: 'termsConsentStatus',
    header: '약관 동의',
    width: 12,
    value: (row) => getTermsConsentDisplayStatus(row)
  },
  termsConsentAt: {
    key: 'termsConsentAt',
    header: '약관 동의일',
    width: 14,
    value: (row) => row.termsConsentAt
  },
  emailVerificationStatus: {
    key: 'emailVerificationStatus',
    header: '이메일 인증',
    width: 12,
    value: (row) => row.emailVerificationStatus
  }
};

export const userExportColumnOptions = defaultUserExportColumnKeys.map((key) => ({
  label: userExportColumnRegistry[key].header,
  value: key,
  required: (requiredUserExportColumnKeys as readonly UserExportColumnKey[]).includes(key)
}));

export function normalizeUserExportColumns(
  columnKeys: readonly UserExportColumnKey[] | undefined
): UserExportColumnKey[] {
  const selected = new Set<UserExportColumnKey>([
    ...requiredUserExportColumnKeys,
    ...(columnKeys ?? defaultUserExportColumnKeys)
  ]);
  return defaultUserExportColumnKeys.filter((key) => selected.has(key));
}

export function getUserExportColumnLabels(columnKeys: readonly UserExportColumnKey[]): string[] {
  return normalizeUserExportColumns(columnKeys).map((key) => userExportColumnRegistry[key].header);
}

// timestamptz 표기와 동일한 KST(UTC+9 고정) 'YYYY-MM-DD HH:mm' 라벨.
export function formatKstTimestampLabel(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mi = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

// 파일명: 회원정보_YYYYMMDD-HHmm(_원문포함).xlsx — 원문 반출본은 이름만으로 구분되게 한다.
export function buildUsersExportFileName(meta: UsersWorkbookMeta): string {
  const stamp = meta.exportedAtLabel.replace(/[^0-9]/g, '').slice(0, 12);
  const suffix = meta.includeFullPhone ? '_원문포함' : '';
  return `회원정보_${stamp.slice(0, 8)}-${stamp.slice(8, 12)}${suffix}.xlsx`;
}

export async function buildUsersWorkbook(
  rows: UserExportRow[],
  meta: UsersWorkbookMeta,
  columnKeys: readonly UserExportColumnKey[] = defaultUserExportColumnKeys
): Promise<ArrayBuffer> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.created = new Date();
  const selectedColumns = normalizeUserExportColumns(columnKeys);

  const sheet = workbook.addWorksheet('회원 목록');
  sheet.columns = selectedColumns.map((key) => {
    const column = userExportColumnRegistry[key];
    return { header: column.header, key: column.key, width: column.width };
  });

  rows.forEach((row) => {
    const values = selectedColumns.reduce<Record<string, string>>((acc, key) => {
      acc[key] = userExportColumnRegistry[key].value(row);
      return acc;
    }, {});
    sheet.addRow(values);
  });
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const infoSheet = workbook.addWorksheet('내보내기 정보');
  infoSheet.columns = [
    { header: '항목', key: 'label', width: 18 },
    { header: '값', key: 'value', width: 80 }
  ];
  infoSheet.addRows([
    { label: '내보낸 일시(KST)', value: meta.exportedAtLabel },
    { label: '내보내기 사유', value: meta.reason },
    {
      label: '전화번호 처리',
      value: meta.includeFullPhone ? '원문 포함' : '마스킹(예: 010-****-5678)'
    },
    { label: '내보내기 범위', value: meta.scopeLabel },
    { label: '적용 필터', value: meta.filterSummaryLabel },
    { label: '선택 컬럼', value: meta.selectedColumnLabels.join(', ') },
    { label: '행 수', value: rows.length },
    {
      label: '안내',
      value:
        '이 파일에는 개인정보가 포함되어 있습니다. 내보내기 이력(사유·행수·전화번호 처리)은 관리자 감사 로그에 기록되며, 파일은 목적 달성 후 지체 없이 폐기해야 합니다.'
    }
  ]);
  infoSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

// 브라우저 다운로드 트리거. revoke 를 클릭 처리 이후로 미루지 않으면
// 브라우저에서 다운로드가 취소될 수 있음.
export function downloadWorkbook(buffer: ArrayBuffer, fileName: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
