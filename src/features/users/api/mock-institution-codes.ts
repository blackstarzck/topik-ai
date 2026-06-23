import type { InstitutionCode } from '../model/institution-codes-types';

/** 기관 코드 mock 시드(Supabase 미구성/e2e 경로). 마이그레이션 dev 시드와 정렬. */
export const mockInstitutionCodes: InstitutionCode[] = [
  {
    code: 'EXPO2026-BOOTH-A',
    label: '2026 한국어교육 박람회 · A부스',
    kind: '박람회',
    status: '활성',
    note: '현장 QR 가입 · A부스',
    memberCount: 0,
    createdAt: '2026-06-19',
    updatedAt: '2026-06-19'
  },
  {
    code: 'EXPO2026-BOOTH-B',
    label: '2026 한국어교육 박람회 · B부스',
    kind: '박람회',
    status: '활성',
    note: '현장 QR 가입 · B부스',
    memberCount: 0,
    createdAt: '2026-06-19',
    updatedAt: '2026-06-19'
  }
];
