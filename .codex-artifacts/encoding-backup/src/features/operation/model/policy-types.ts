export const operationPolicyStatusValues = ['게시', '숨김'] as const;

export type OperationPolicyStatus =
  (typeof operationPolicyStatusValues)[number];

export const operationPolicyCategoryValues = [
  '踰뺣쪧/?쎄?',
  '커뮤니티/?덉쟾',
  '결제/由ъ썙??,
  '운영/콘텐츠,
  '硫붿떆吏/알림',
  '愿由ъ옄/蹂댁븞'
] as const;

export type OperationPolicyCategory =
  (typeof operationPolicyCategoryValues)[number];

export const operationPolicyTrackingStatusValues = [
  '肄붾뱶 諛섏쁺',
  '臾몄꽌 異붿쟻',
  '?뺤콉 誘명솗??
] as const;

export type OperationPolicyTrackingStatus =
  (typeof operationPolicyTrackingStatusValues)[number];

export const operationPolicyTypeValues = [
  '내용?쎄?',
  '媛쒖씤?뺣낫 泥섎━諛⑹묠',
  '결제?랁솚遺??뺤콉',
  '泥?냼??蹂댄샇?뺤콉',
  '커뮤니티 게시글 ?쒖옱 ?뺤콉',
  '異붿쿇??蹂댁긽 ?뺤콉',
  '?ъ씤??운영?뺤콉',
  '荑좏룿 운영?뺤콉',
  '?대깽??운영?뺤콉',
  'FAQ ?몄텧 ?뺤콉',
  '梨쀫큸 ?곷떞 ?꾪솚 ?뺤콉',
  '硫붿씪 발송 운영?뺤콉',
  '?몄떆 발송 운영?뺤콉',
  '발송 실패/?ъ떆???뺤콉',
  '愿由ъ옄 沅뚰븳 蹂寃??뺤콉',
  '留덉????뺣낫 ?섏떊 ?숈쓽'
] as const;

export type OperationPolicyType = (typeof operationPolicyTypeValues)[number];

export const operationPolicyExposureSurfaceValues = [
  '회원媛??,
  '결제',
  '留덉씠?섏씠吏',
  '怨좉컼?쇳꽣',
  '???ㅼ젙',
  '愿由ъ옄 肄섏넄'
] as const;

export type OperationPolicyExposureSurface =
  (typeof operationPolicyExposureSurfaceValues)[number];

export const operationPolicyRelatedAdminPageValues = [
  'Operation > ?뺤콉 愿由?,
  'Operation > FAQ',
  'Operation > ?대깽??,
  'Operation > 梨쀫큸 ?ㅼ젙',
  'Users > 회원 紐⑸줉',
  'Users > 회원 상세',
  'Users > 異붿쿇??愿由?,
  'Community > 게시글 愿由?,
  'Community > 신고 愿由?,
  'Message > 硫붿씪',
  'Message > ?몄떆',
  'Message > 대상洹몃９',
  'Message > 발송 이력',
  'Commerce > 결제 내역',
  'Commerce > 환불 愿由?,
  'Commerce > 荑좏룿 愿由?,
  'Commerce > ?ъ씤??愿由?,
  'System > 관리자 계정',
  'System > 권한 관리,
  'System > 媛먯궗 로그'
] as const;

export type OperationPolicyRelatedAdminPage =
  (typeof operationPolicyRelatedAdminPageValues)[number];

export const operationPolicyRelatedUserPageValues = [
  '회원媛??> ?쎄? ?숈쓽',
  '회원媛??> 留덉????섏떊 ?숈쓽',
  '결제 > ?쎄?/환불 ?덈궡',
  '결제 > 荑좏룿/?ъ씤???곸슜',
  '留덉씠?섏씠吏 > ?뺤콉 留곹겕',
  '留덉씠?섏씠吏 > 媛쒖씤?뺣낫/?섏떊 ?숈쓽 ?ㅼ젙',
  '怨좉컼?쇳꽣 > ?뺤콉 臾몄꽌',
  '???ㅼ젙 > 踰뺤쟻 怨좎?',
  '커뮤니티 > 게시글 ?묒꽦/내용 ?덈궡',
  'FAQ > 怨좉컼?쇳꽣 FAQ',
  '?대깽??> 상세',
  '梨쀫큸 > ?곷떞 ?꾪솚 ?덈궡',
  '이메일> 운영/?뺤콉 ?덈궡',
  '?????몄떆 > 운영/?뺤콉 ?덈궡'
] as const;

export type OperationPolicyRelatedUserPage =
  (typeof operationPolicyRelatedUserPageValues)[number];

export const operationPolicyHistoryActionValues = [
  'created',
  'updated',
  'status_changed',
  'version_published',
  'deleted'
] as const;

export type OperationPolicyHistoryAction =
  (typeof operationPolicyHistoryActionValues)[number];

export type OperationPolicy = {
  id: string;
  category: OperationPolicyCategory;
  policyType: OperationPolicyType;
  title: string;
  versionLabel: string;
  effectiveDate: string;
  exposureSurfaces: OperationPolicyExposureSurface[];
  requiresConsent: boolean;
  trackingStatus: OperationPolicyTrackingStatus;
  relatedAdminPages: OperationPolicyRelatedAdminPage[];
  relatedUserPages: OperationPolicyRelatedUserPage[];
  sourceDocuments: string[];
  summary: string;
  legalReferences: string[];
  bodyHtml: string;
  adminMemo: string;
  status: OperationPolicyStatus;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type OperationPolicyHistoryEntry = {
  id: string;
  policyId: string;
  action: OperationPolicyHistoryAction;
  versionLabel: string;
  status: OperationPolicyStatus;
  trackingStatus: OperationPolicyTrackingStatus;
  changedAt: string;
  changedBy: string;
  note: string;
  snapshot: OperationPolicy;
};

export function inferOperationPolicyRelatedAdminPages(
  policyType: OperationPolicyType
): OperationPolicyRelatedAdminPage[] {
  switch (policyType) {
    case '내용?쎄?':
      return ['Operation > ?뺤콉 愿由?, 'Users > 회원 紐⑸줉', 'Users > 회원 상세'];
    case '媛쒖씤?뺣낫 泥섎━諛⑹묠':
      return ['Operation > ?뺤콉 愿由?, 'Users > 회원 상세', 'Message > 硫붿씪'];
    case '결제?랁솚遺??뺤콉':
      return ['Commerce > 결제 내역', 'Commerce > 환불 愿由?, 'Commerce > ?ъ씤??愿由?];
    case '泥?냼??蹂댄샇?뺤콉':
      return ['Community > 게시글 愿由?, 'Community > 신고 愿由?, 'Operation > ?뺤콉 愿由?];
    case '커뮤니티 게시글 ?쒖옱 ?뺤콉':
      return ['Community > 게시글 愿由?, 'Community > 신고 愿由?, 'System > 媛먯궗 로그'];
    case '異붿쿇??蹂댁긽 ?뺤콉':
      return ['Users > 異붿쿇??愿由?, 'Commerce > ?ъ씤??愿由?, 'System > 媛먯궗 로그'];
    case '?ъ씤??운영?뺤콉':
      return ['Commerce > ?ъ씤??愿由?, 'Users > 異붿쿇??愿由?, 'Operation > ?대깽??];
    case '荑좏룿 운영?뺤콉':
      return ['Commerce > 荑좏룿 愿由?, 'Operation > ?대깽??, 'Message > 硫붿씪'];
    case '?대깽??운영?뺤콉':
      return ['Operation > ?대깽??, 'Commerce > 荑좏룿 愿由?, 'Message > 대상洹몃９'];
    case 'FAQ ?몄텧 ?뺤콉':
      return ['Operation > FAQ', 'Operation > 梨쀫큸 ?ㅼ젙', 'System > 媛먯궗 로그'];
    case '梨쀫큸 ?곷떞 ?꾪솚 ?뺤콉':
      return ['Operation > 梨쀫큸 ?ㅼ젙', 'Operation > FAQ', 'Message > 硫붿씪'];
    case '硫붿씪 발송 운영?뺤콉':
      return ['Message > 硫붿씪', 'Message > 대상洹몃９', 'Message > 발송 이력'];
    case '?몄떆 발송 운영?뺤콉':
      return ['Message > ?몄떆', 'Message > 대상洹몃９', 'Message > 발송 이력'];
    case '발송 실패/?ъ떆???뺤콉':
      return ['Message > 발송 이력', 'Message > 硫붿씪', 'Message > ?몄떆'];
    case '愿由ъ옄 沅뚰븳 蹂寃??뺤콉':
      return ['System > 권한 관리, 'System > 관리자 계정', 'System > 媛먯궗 로그'];
    case '留덉????뺣낫 ?섏떊 ?숈쓽':
      return ['Message > 硫붿씪', 'Message > ?몄떆', 'Users > 회원 상세'];
    default:
      return ['Operation > ?뺤콉 愿由?];
  }
}

export function inferOperationPolicyRelatedUserPages(
  policyType: OperationPolicyType,
  exposureSurfaces: OperationPolicyExposureSurface[] = []
): OperationPolicyRelatedUserPage[] {
  switch (policyType) {
    case '내용?쎄?':
      return ['회원媛??> ?쎄? ?숈쓽', '留덉씠?섏씠吏 > ?뺤콉 留곹겕', '怨좉컼?쇳꽣 > ?뺤콉 臾몄꽌'];
    case '媛쒖씤?뺣낫 泥섎━諛⑹묠':
      return [
        '회원媛??> ?쎄? ?숈쓽',
        '留덉씠?섏씠吏 > 媛쒖씤?뺣낫/?섏떊 ?숈쓽 ?ㅼ젙',
        '???ㅼ젙 > 踰뺤쟻 怨좎?'
      ];
    case '결제?랁솚遺??뺤콉':
      return ['결제 > ?쎄?/환불 ?덈궡', '留덉씠?섏씠吏 > ?뺤콉 留곹겕', '怨좉컼?쇳꽣 > ?뺤콉 臾몄꽌'];
    case '泥?냼??蹂댄샇?뺤콉':
      return ['커뮤니티 > 게시글 ?묒꽦/내용 ?덈궡', '怨좉컼?쇳꽣 > ?뺤콉 臾몄꽌', '???ㅼ젙 > 踰뺤쟻 怨좎?'];
    case '커뮤니티 게시글 ?쒖옱 ?뺤콉':
      return ['커뮤니티 > 게시글 ?묒꽦/내용 ?덈궡', '怨좉컼?쇳꽣 > ?뺤콉 臾몄꽌'];
    case '異붿쿇??蹂댁긽 ?뺤콉':
      return ['留덉씠?섏씠吏 > ?뺤콉 留곹겕', '결제 > 荑좏룿/?ъ씤???곸슜', '?대깽??> 상세'];
    case '?ъ씤??운영?뺤콉':
      return ['결제 > 荑좏룿/?ъ씤???곸슜', '留덉씠?섏씠吏 > ?뺤콉 留곹겕'];
    case '荑좏룿 운영?뺤콉':
      return ['결제 > 荑좏룿/?ъ씤???곸슜', '?대깽??> 상세', '留덉씠?섏씠吏 > ?뺤콉 留곹겕'];
    case '?대깽??운영?뺤콉':
      return ['?대깽??> 상세', '怨좉컼?쇳꽣 > ?뺤콉 臾몄꽌'];
    case 'FAQ ?몄텧 ?뺤콉':
      return ['FAQ > 怨좉컼?쇳꽣 FAQ', '梨쀫큸 > ?곷떞 ?꾪솚 ?덈궡'];
    case '梨쀫큸 ?곷떞 ?꾪솚 ?뺤콉':
      return ['梨쀫큸 > ?곷떞 ?꾪솚 ?덈궡', 'FAQ > 怨좉컼?쇳꽣 FAQ'];
    case '硫붿씪 발송 운영?뺤콉':
      return ['이메일> 운영/?뺤콉 ?덈궡'];
    case '?몄떆 발송 운영?뺤콉':
      return ['?????몄떆 > 운영/?뺤콉 ?덈궡'];
    case '발송 실패/?ъ떆???뺤콉':
      return ['이메일> 운영/?뺤콉 ?덈궡', '?????몄떆 > 운영/?뺤콉 ?덈궡'];
    case '愿由ъ옄 沅뚰븳 蹂寃??뺤콉':
      return [];
    case '留덉????뺣낫 ?섏떊 ?숈쓽':
      return ['회원媛??> 留덉????섏떊 ?숈쓽', '留덉씠?섏씠吏 > 媛쒖씤?뺣낫/?섏떊 ?숈쓽 ?ㅼ젙'];
    default: {
      const inferredFromSurface = new Set<OperationPolicyRelatedUserPage>();

      exposureSurfaces.forEach((surface) => {
        if (surface === '회원媛??) {
          inferredFromSurface.add('회원媛??> ?쎄? ?숈쓽');
        }

        if (surface === '결제') {
          inferredFromSurface.add('결제 > ?쎄?/환불 ?덈궡');
        }

        if (surface === '留덉씠?섏씠吏') {
          inferredFromSurface.add('留덉씠?섏씠吏 > ?뺤콉 留곹겕');
        }

        if (surface === '怨좉컼?쇳꽣') {
          inferredFromSurface.add('怨좉컼?쇳꽣 > ?뺤콉 臾몄꽌');
        }

        if (surface === '???ㅼ젙') {
          inferredFromSurface.add('???ㅼ젙 > 踰뺤쟻 怨좎?');
        }
      });

      return Array.from(inferredFromSurface);
    }
  }
}


