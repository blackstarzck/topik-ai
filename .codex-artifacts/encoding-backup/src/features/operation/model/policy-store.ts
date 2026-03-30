import { create } from 'zustand';

import type {
  OperationPolicy,
  OperationPolicyCategory,
  OperationPolicyExposureSurface,
  OperationPolicyHistoryAction,
  OperationPolicyHistoryEntry,
  OperationPolicyRelatedAdminPage,
  OperationPolicyRelatedUserPage,
  OperationPolicyStatus,
  OperationPolicyTrackingStatus,
  OperationPolicyType
} from './policy-types';
import { inferOperationPolicyRelatedUserPages } from './policy-types';

const CURRENT_ACTOR = 'admin_current';

type SavePolicyPayload = {
  id?: string;
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
};

type TogglePolicyStatusPayload = {
  policyId: string;
  nextStatus: OperationPolicyStatus;
};

type DeletePolicyPayload = {
  policyId: string;
  reason: string;
};

type PublishPolicyHistoryVersionPayload = {
  policyId: string;
  historyId: string;
  reason: string;
};

type OperationPolicyStore = {
  policies: OperationPolicy[];
  policyHistories: OperationPolicyHistoryEntry[];
  savePolicy: (payload: SavePolicyPayload) => OperationPolicy;
  togglePolicyStatus: (
    payload: TogglePolicyStatusPayload
  ) => OperationPolicy | null;
  publishPolicyHistoryVersion: (
    payload: PublishPolicyHistoryVersionPayload
  ) => OperationPolicy | null;
  deletePolicy: (payload: DeletePolicyPayload) => OperationPolicy | null;
};

type SeedOperationPolicy = Omit<OperationPolicy, 'relatedUserPages'> & {
  relatedUserPages?: OperationPolicyRelatedUserPage[];
};

function formatNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function toDateString(dateTime: string): string {
  return dateTime.slice(0, 10);
}

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeStringList(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => normalizeText(value)).filter(Boolean))
  );
}

function normalizeLegalReferences(values: string[]): string[] {
  return normalizeStringList(values);
}

function normalizeRelatedAdminPages(
  values: OperationPolicyRelatedAdminPage[]
): OperationPolicyRelatedAdminPage[] {
  return normalizeStringList(values) as OperationPolicyRelatedAdminPage[];
}

function normalizeRelatedUserPages(
  values: OperationPolicyRelatedUserPage[]
): OperationPolicyRelatedUserPage[] {
  return normalizeStringList(values) as OperationPolicyRelatedUserPage[];
}

function normalizeHistoryNote(value: string): string {
  return normalizeText(value);
}

function clonePolicySnapshot(policy: OperationPolicy): OperationPolicy {
  return {
    ...policy,
    exposureSurfaces: [...policy.exposureSurfaces],
    relatedAdminPages: [...policy.relatedAdminPages],
    relatedUserPages: [...policy.relatedUserPages],
    sourceDocuments: [...policy.sourceDocuments],
    legalReferences: [...policy.legalReferences]
  };
}

function getNextPolicyId(policies: OperationPolicy[]): string {
  const sequence =
    policies
      .map((policy) => Number(policy.id.split('-')[1] ?? '0'))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `POL-${String(sequence).padStart(3, '0')}`;
}

function getNextPolicyHistoryId(
  policyHistories: OperationPolicyHistoryEntry[]
): string {
  const sequence =
    policyHistories
      .map((entry) => Number(entry.id.split('-')[1] ?? '0'))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `PH-${String(sequence).padStart(4, '0')}`;
}

function createPolicyHistoryEntry(
  policy: OperationPolicy,
  action: OperationPolicyHistoryAction,
  note: string,
  historyId: string,
  changedAt = policy.updatedAt,
  changedBy = policy.updatedBy
): OperationPolicyHistoryEntry {
  return {
    id: historyId,
    policyId: policy.id,
    action,
    versionLabel: policy.versionLabel,
    status: policy.status,
    trackingStatus: policy.trackingStatus,
    changedAt,
    changedBy,
    note: normalizeHistoryNote(note),
    snapshot: clonePolicySnapshot(policy)
  };
}

function appendPolicyHistory(
  policyHistories: OperationPolicyHistoryEntry[],
  policy: OperationPolicy,
  action: OperationPolicyHistoryAction,
  note: string,
  changedAt = policy.updatedAt,
  changedBy = policy.updatedBy
): OperationPolicyHistoryEntry[] {
  return [
    ...policyHistories,
    createPolicyHistoryEntry(
      policy,
      action,
      note,
      getNextPolicyHistoryId(policyHistories),
      changedAt,
      changedBy
    )
  ];
}

function createSeedPolicy(policy: SeedOperationPolicy): OperationPolicy {
  return {
    ...policy,
    relatedUserPages:
      policy.relatedUserPages ??
      inferOperationPolicyRelatedUserPages(
        policy.policyType,
        policy.exposureSurfaces
      )
  };
}

const initialPolicies: OperationPolicy[] = ([
  {
    id: 'POL-001',
    category: '踰뺣쪧/?쎄?',
    policyType: '내용?쎄?',
    title: 'TOPIK AI 내용?쎄?',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-20',
    exposureSurfaces: ['회원媛??, '留덉씠?섏씠吏', '怨좉컼?쇳꽣'],
    requiresConsent: true,
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: ['Operation > ?뺤콉 愿由?, 'Users > 회원 紐⑸줉', 'Users > 회원 상세'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-policies-page-ia.md',
      'docs/specs/admin-data-usage-map.md'
    ],
    summary:
      '?쒕퉬??내용 議곌굔, 怨꾩젙 운영 湲곗?, 결제 諛?콘텐츠내용 ?쒗븳 ?ы빆???뺣━??湲곕낯 ?쎄??낅땲??',
    legalReferences: ['?꾩옄?곴굅???깆뿉?쒖쓽 ?뚮퉬?먮낫?몄뿉 愿??踰뺣쪧', '誘쇰쾿'],
    bodyHtml:
      '<h2>TOPIK AI 내용?쎄?</h2><p>회원? 怨꾩젙 ?앹꽦 ??蹂??쎄????숈쓽?섎ŉ, ?숈뒿 ?쒕퉬?ㅼ? 커뮤니티 湲곕뒫???쎄? 踰붿쐞 ?댁뿉??내용?????덉뒿?덈떎.</p><table><tbody><tr><th>??ぉ</th><th>내용</th></tr><tr><td>怨꾩젙</td><td>1??1怨꾩젙 ?먯튃</td></tr><tr><td>결제</td><td>결제?랁솚遺??뺤콉??蹂꾨룄 李몄“</td></tr></tbody></table>',
    adminMemo: '회원媛?? 怨좉컼?쇳꽣, 留덉씠?섏씠吏 ?쎄? 留곹겕??湲곗? 臾몄꽌?낅땲??',
    status: '게시',
    createdAt: '2026-03-18',
    updatedAt: '2026-03-20 09:10',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-002',
    category: '踰뺣쪧/?쎄?',
    policyType: '媛쒖씤?뺣낫 泥섎━諛⑹묠',
    title: 'TOPIK AI 媛쒖씤?뺣낫 泥섎━諛⑹묠',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-20',
    exposureSurfaces: ['회원媛??, '留덉씠?섏씠吏', '怨좉컼?쇳꽣', '???ㅼ젙'],
    requiresConsent: true,
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: ['Operation > ?뺤콉 愿由?, 'Users > 회원 상세', 'Message > 硫붿씪'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-policies-page-ia.md',
      'docs/specs/admin-data-usage-map.md'
    ],
    summary:
      '?섏쭛 ??ぉ, 泥섎━ 紐⑹쟻, 蹂닿? 湲곌컙, ?뚭린 ?덉감? 媛숈? 媛쒖씤?뺣낫 泥섎━ 湲곗???공지?⑸땲??',
    legalReferences: ['媛쒖씤?뺣낫 蹂댄샇踰?, '?뺣낫?듭떊留?내용珥됱쭊 諛??뺣낫蹂댄샇 ?깆뿉 愿??踰뺣쪧'],
    bodyHtml:
      '<h2>媛쒖씤?뺣낫 泥섎━諛⑹묠</h2><p>?뚯궗??회원媛?? 결제, ?숈뒿 ?쒕퉬???쒓났 怨쇱젙?먯꽌 ?꾩슂??理쒖냼?쒖쓽 媛쒖씤?뺣낫瑜??섏쭛?⑸땲??</p><ul><li>?섏쭛 ??ぉ: 이메일 닉네임 결제 ?대젰</li><li>蹂닿? 湲곌컙: 踰뺣졊 諛??대? ?뺤콉 湲곗?</li></ul>',
    adminMemo: '???ㅼ젙 踰뺤쟻 怨좎?? 회원媛???섎떒 ?몄텧 湲곗? 臾몄꽌?낅땲??',
    status: '게시',
    createdAt: '2026-03-18',
    updatedAt: '2026-03-20 09:25',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-003',
    category: '결제/由ъ썙??,
    policyType: '결제?랁솚遺??뺤콉',
    title: '결제?랁솚遺??뺤콉',
    versionLabel: 'v2026.04',
    effectiveDate: '2026-04-01',
    exposureSurfaces: ['결제', '留덉씠?섏씠吏', '怨좉컼?쇳꽣', '愿由ъ옄 肄섏넄'],
    requiresConsent: true,
    trackingStatus: '臾몄꽌 異붿쟻',
    relatedAdminPages: ['Commerce > 결제 내역', 'Commerce > 환불 愿由?, 'Commerce > ?ъ씤??愿由?],
    sourceDocuments: [
      'docs/specs/page-ia/commerce-refunds-page-ia.md',
      'docs/specs/page-ia/commerce-payments-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '결제 ?뱀씤, 환불 媛??議곌굔, 遺遺?환불 ?쒗븳怨?怨좉컼 ?덈궡 湲곗????④퍡 異붿쟻?섎뒗 ?뺤콉 臾몄꽌?낅땲??',
    legalReferences: ['?꾩옄?곴굅???깆뿉?쒖쓽 ?뚮퉬?먮낫?몄뿉 愿??踰뺣쪧', '?꾩옄?곴굅???깆뿉?쒖쓽 ?뚮퉬?먮낫??吏移?],
    bodyHtml:
      '<h2>결제?랁솚遺??뺤콉</h2><p>결제 ??7???대궡?대㈃???숈뒿 ?대젰???녿뒗 寃쎌슦 ?꾩븸 환불???먯튃?쇰줈 寃?좏빀?덈떎.</p><ol><li>留덉씠?섏씠吏 ?먮뒗 怨좉컼?쇳꽣?먯꽌 환불 ?붿껌 ?묒닔</li><li>운영 寃?????뱀씤/嫄곗젅</li><li>결제 수단蹂?환불 완료 泥섎━</li></ol><p>遺遺?환불怨?怨좉컼 ?덈궡 硫붿떆吏 ?곕룞? ?꾩냽 ?뺤콉 ?뺤젙???꾩슂?⑸땲??</p>',
    adminMemo: '결제 내역/환불 愿由??붾㈃??遺遺?환불, 怨좉컼 ?덈궡 洹쒖튃???④퍡 異붿쟻?⑸땲??',
    status: '게시',
    createdAt: '2026-03-21',
    updatedAt: '2026-03-24 15:40',
    updatedBy: 'admin_kim'
  },
  {
    id: 'POL-004',
    category: '커뮤니티/?덉쟾',
    policyType: '泥?냼??蹂댄샇?뺤콉',
    title: '泥?냼??蹂댄샇?뺤콉',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-22',
    exposureSurfaces: ['怨좉컼?쇳꽣', '???ㅼ젙', '愿由ъ옄 肄섏넄'],
    requiresConsent: false,
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: ['Community > 게시글 愿由?, 'Community > 신고 愿由?, 'Operation > ?뺤콉 愿由?],
    sourceDocuments: [
      'docs/specs/page-ia/community-posts-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '?좏빐 ?뺣낫 李⑤떒, 신고 ?묒닔, 泥?냼??蹂댄샇 梨낆엫???덈궡 ??커뮤니티 ?덉쟾 운영 湲곗????쒓났?⑸땲??',
    legalReferences: ['泥?냼??蹂댄샇踰?, '?뺣낫?듭떊留?내용珥됱쭊 諛??뺣낫蹂댄샇 ?깆뿉 愿??踰뺣쪧'],
    bodyHtml:
      '<h2>泥?냼??蹂댄샇?뺤콉</h2><p>?뚯궗??泥?냼???좏빐 ?뺣낫 ?몄텧 諛⑹?? 신고 泥섎━ 湲곗???운영 ?뺤콉?쇰줈 愿由ы빀?덈떎.</p><ul><li>?좏빐 ?뺣낫 李⑤떒怨?신고 ?묒닔 ?덉감</li><li>泥?냼??蹂댄샇 梨낆엫??諛??꾩냽 ?덈궡 湲곗?</li><li>커뮤니티 ?쒖옱 ?뺤콉怨쇱쓽 ?곌껐 洹쒖튃</li></ul>',
    adminMemo: '커뮤니티 ?덉쟾 ?뺤콉怨?踰뺤쟻 怨좎? ?곸뿭???곌껐?섎뒗 湲곗? 臾몄꽌?낅땲??',
    status: '게시',
    createdAt: '2026-03-19',
    updatedAt: '2026-03-22 10:15',
    updatedBy: 'admin_han'
  },
  {
    id: 'POL-005',
    category: '커뮤니티/?덉쟾',
    policyType: '커뮤니티 게시글 ?쒖옱 ?뺤콉',
    title: '커뮤니티 게시글 ?쒖옱 ?뺤콉',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-25',
    exposureSurfaces: ['怨좉컼?쇳꽣', '???ㅼ젙', '愿由ъ옄 肄섏넄'],
    requiresConsent: false,
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: ['Community > 게시글 愿由?, 'Community > 신고 愿由?, 'System > 媛먯궗 로그'],
    sourceDocuments: [
      'docs/specs/page-ia/community-posts-page-ia.md',
      'src/features/community/pages/community-posts-page.tsx'
    ],
    summary:
      '게시글 숨김/??젣 ???곕뒗 ?뺤콉 肄붾뱶, 사유 ?낅젰, ?대? 硫붾え 湲곕줉 洹쒖튃???뺣━???쒖옱 湲곗??낅땲??',
    legalReferences: ['?뺣낫?듭떊留?내용珥됱쭊 諛??뺣낫蹂댄샇 ?깆뿉 愿??踰뺣쪧', '泥?냼??蹂댄샇踰?],
    bodyHtml:
      '<h2>커뮤니티 게시글 ?쒖옱 ?뺤콉</h2><p>게시글 議곗튂 ???뺤콉 肄붾뱶? ?먯쑀 사유瑜??④퍡 湲곕줉?섍퀬, 媛먯궗 로그? ?대? 硫붾え瑜??④퉩?덈떎.</p><ul><li>SPAM 쨌 ?ㅽ뙵/스팸</li><li>ABUSE 쨌 ?뺤꽕/?먯삤</li><li>AD 쨌 愿묎퀬/?띾낫</li><li>PRIVACY 쨌 媛쒖씤?뺣낫 ?몄텧</li><li>DUPLICATE 쨌 以묐났 게시</li><li>OTHER 쨌 湲고?</li></ul>',
    adminMemo: '게시글 愿由ъ쓽 ConfirmAction ?뺤콉 肄붾뱶? 상세 IA瑜?湲곗??쇰줈 ?묒꽦?덉뒿?덈떎.',
    status: '게시',
    createdAt: '2026-03-22',
    updatedAt: '2026-03-25 11:05',
    updatedBy: 'admin_lee'
  },
  {
    id: 'POL-006',
    category: '결제/由ъ썙??,
    policyType: '異붿쿇??蹂댁긽 ?뺤콉',
    title: '異붿쿇??蹂댁긽 ?뺤콉',
    versionLabel: 'v2026.03-draft',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['愿由ъ옄 肄섏넄', '留덉씠?섏씠吏'],
    requiresConsent: false,
    trackingStatus: '臾몄꽌 異붿쟻',
    relatedAdminPages: ['Users > 異붿쿇??愿由?, 'Commerce > ?ъ씤??愿由?, 'System > 媛먯궗 로그'],
    sourceDocuments: [
      'docs/specs/page-ia/users-referrals-page-ia.md',
      'src/features/users/pages/users-referrals-page.tsx'
    ],
    summary:
      '異붿쿇 肄붾뱶 ?뺤젙 ?쒖젏, 蹂댁긽 ?섎떒, ?뚯닔 洹쒖튃, ?섎룞 蹂댁젙 沅뚰븳???④퍡 ?뺣━?섎뒗 운영 ?뺤콉 珥덉븞?낅땲??',
    legalReferences: ['?쒕퉬??운영 ?뺤콉 珥덉븞', '異붿쿇??愿由?상세 IA'],
    bodyHtml:
      '<h2>異붿쿇??蹂댁긽 ?뺤콉</h2><p>異붿쿇 肄붾뱶??異붿쿇??1紐낅떦 1媛쒕? 湲곗??쇰줈 愿由ы븯硫? 異붿쿇 ?뺤젙怨?蹂댁긽 吏湲됱? ?뺤콉 ?ㅻ깄?룹쑝濡?湲곕줉?⑸땲??</p><ul><li>?뺤젙 ?쒖젏: 媛??완료 / 泥?결제 / 泥??숈뒿 완료 ?꾨낫</li><li>蹂댁긽 ?섎떒: ?ъ씤??/ 荑좏룿 / ?쇳빀 ?꾨낫</li><li>?꾩냽 寃?? 異붿쿇 愿怨꾩? ?ъ씤???먯옣???④퍡 ?뺤씤</li></ul>',
    adminMemo: '異붿쿇???섏씠吏??policySnapshot怨??ㅽ뵂 ?댁뒋瑜??뺤콉 愿由щ줈 ?밴꺽??珥덉븞?낅땲??',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 09:40',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-007',
    category: '결제/由ъ썙??,
    policyType: '?ъ씤??운영?뺤콉',
    title: '?ъ씤??운영?뺤콉',
    versionLabel: 'v2026.03-draft',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['愿由ъ옄 肄섏넄', '결제', '留덉씠?섏씠吏'],
    requiresConsent: false,
    trackingStatus: '臾몄꽌 異붿쟻',
    relatedAdminPages: ['Commerce > ?ъ씤??愿由?, 'Users > 異붿쿇??愿由?, 'Operation > ?대깽??],
    sourceDocuments: [
      'docs/specs/page-ia/commerce-points-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '?곷┰ ?먯쿇 遺꾨쪟, 李④컧 ?곗꽑?쒖쐞, ?뚮㈇/蹂대쪟/蹂듦뎄 湲곗?, ?섎룞 議곗젙 ?뱀씤 泥닿퀎瑜?異붿쟻?섎뒗 운영 ?뺤콉?낅땲??',
    legalReferences: ['?ъ씤??愿由?상세 IA', '?쒕퉬??운영 ?뺤콉 珥덉븞'],
    bodyHtml:
      '<h2>?ъ씤??운영?뺤콉</h2><p>?ъ씤?몃뒗 異붿쿇, 誘몄뀡, ?대깽?? 결제, 환불, 愿由ъ옄, 시스템?먯쿇?쇰줈 諛쒖깮?????덉쑝硫??먯옣 ?⑥쐞濡?寃?섑빀?덈떎.</p><ul><li>李④컧 ?곗꽑?쒖쐞? ?뚯닔 ?붿븸 ?덉슜 ?щ????꾩냽 ?뺤젙 ?꾩슂</li><li>?뚮㈇ ?덉젙/蹂대쪟/蹂듦뎄 ?뺤콉? 蹂꾨룄 ?뱀씤 ?먮쫫 寃???꾩슂</li><li>?섎룞 議곗젙? 媛먯궗 로그? 利앸튃 硫붾え瑜??④퍡 숨김</li></ul>',
    adminMemo: '?ъ씤??愿由?living IA???뺤콉 ?꾨낫瑜?운영 ?뺤콉?쇰줈 吏묒빟?덉뒿?덈떎.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 09:55',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-008',
    category: '결제/由ъ썙??,
    policyType: '荑좏룿 운영?뺤콉',
    title: '荑좏룿 운영?뺤콉',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-24',
    exposureSurfaces: ['愿由ъ옄 肄섏넄', '결제', '留덉씠?섏씠吏'],
    requiresConsent: false,
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: ['Commerce > 荑좏룿 愿由?, 'Operation > ?대깽??, 'Message > 硫붿씪'],
    sourceDocuments: [
      'docs/specs/page-ia/commerce-coupons-page-ia.md',
      'docs/specs/page-ia/operation-events-page-ia.md'
    ],
    summary:
      '怨좉컼 ?ㅼ슫濡쒕뱶, ?먮룞 諛쒗뻾, 荑좏룿 肄붾뱶 ?앹꽦, 吏??諛쒗뻾???좏삎蹂?운영 洹쒖튃怨?寃利?湲곗???紐⑥? ?뺤콉 臾몄꽌?낅땲??',
    legalReferences: ['荑좏룿 愿由?상세 IA', '?꾩엫??운영 ?뺤콉 ?뺤씤 硫붾え'],
    bodyHtml:
      '<h2>荑좏룿 운영?뺤콉</h2><p>荑좏룿? 怨좉컼 ?ㅼ슫濡쒕뱶, ?먮룞 諛쒗뻾, 荑좏룿 肄붾뱶 ?앹꽦, 吏??諛쒗뻾 4媛吏 ?좏삎?쇰줈 운영?⑸땲??</p><ul><li>泥?회원媛??泥?二쇰Ц 완료/등급 蹂寃??앹씪 ?먮룞 諛쒗뻾 洹쒖튃</li><li>臾대즺 ?뚮옖 ?쒗븳, 肄붾뱶 ?섏젙 遺덇?, ?쒗겕由?留곹겕 운영 湲곗?</li><li>諛쒗뻾 以묒?/?ш컻? ??젣??사유 ?낅젰 諛?媛먯궗 로그 異붿쟻 ?꾩닔</li></ul>',
    adminMemo: '荑좏룿 愿由?상세 IA? ?대깽??蹂댁긽 ?곌껐 洹쒖튃???④퍡 諛섏쁺?덉뒿?덈떎.',
    status: '게시',
    createdAt: '2026-03-24',
    updatedAt: '2026-03-26 10:05',
    updatedBy: 'admin_lee'
  },
  {
    id: 'POL-009',
    category: '운영/콘텐츠,
    policyType: '?대깽??운영?뺤콉',
    title: '?대깽??운영?뺤콉',
    versionLabel: 'v2026.03-draft',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['愿由ъ옄 肄섏넄', '怨좉컼?쇳꽣'],
    requiresConsent: false,
    trackingStatus: '臾몄꽌 異붿쟻',
    relatedAdminPages: ['Operation > ?대깽??, 'Commerce > 荑좏룿 愿由?, 'Message > 대상洹몃９'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-events-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '?대깽???몄텧, 李몄뿬 議곌굔, 蹂댁긽 ?곌껐, 硫붿떆吏/荑좏룿 ?곕룞, 醫낅즺 ??蹂듦뎄 ?щ?瑜?異붿쟻?섎뒗 운영 ?뺤콉?낅땲??',
    legalReferences: ['?대깽??상세 IA', '?쒕퉬??운영 ?뺤콉 珥덉븞'],
    bodyHtml:
      '<h2>?대깽??운영?뺤콉</h2><p>?대깽?몃뒗 紐⑸줉 寃?섏? ?깅줉 상세 ?섏씠吏瑜?遺꾨━??운영?섍퀬, 게시 예약怨?醫낅즺 議곗튂 ??媛먯궗 로그瑜??④퉩?덈떎.</p><ul><li>李몄뿬 대상洹몃９怨?以묐났 李몄뿬 ?쒗븳 寃??/li><li>蹂댁긽 ?뺤콉/硫붿떆吏 ?쒗뵆由?荑좏룿 ?뺤콉 李몄“</li><li>怨듦컻 ?대깽?몄쓽 ?몄텧/SEO 硫뷀? 愿由?/li></ul>',
    adminMemo: '?대깽??蹂댁긽 ?섎떒怨?醫낅즺 ??蹂듦뎄 媛???щ????꾩쭅 ?꾩냽 ?뺤젙 ??곸엯?덈떎.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 10:12',
    updatedBy: 'admin_kim'
  },
  {
    id: 'POL-010',
    category: '운영/콘텐츠,
    policyType: 'FAQ ?몄텧 ?뺤콉',
    title: 'FAQ ?몄텧 ?뺤콉',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-25',
    exposureSurfaces: ['愿由ъ옄 肄섏넄', '怨좉컼?쇳꽣'],
    requiresConsent: false,
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: ['Operation > FAQ', 'Operation > 梨쀫큸 ?ㅼ젙', 'System > 媛먯궗 로그'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-faq-page-ia.md',
      'docs/specs/admin-data-usage-map.md'
    ],
    summary:
      'FAQ ?먮Ц 怨듦컻/鍮꾧났媛쒖? ??異붿쿇, 결제 ?꾩?留? ?⑤낫??FAQ 媛숈? ?몄텧 ?먮젅?댁뀡 洹쒖튃???뺤쓽?⑸땲??',
    legalReferences: ['FAQ 상세 IA'],
    bodyHtml:
      '<h2>FAQ ?몄텧 ?뺤콉</h2><p>FAQ???먮Ц 愿由ъ? ?몄텧 愿由? 吏??蹂닿린 3媛?異뺤쑝濡?운영?⑸땲??</p><ul><li>?몄텧 ?꾩튂: help_center, home_top, payment_help, onboarding</li><li>?ㅼ젙 諛⑹떇: manual / auto</li><li>怨듦컻 상태 蹂寃????곌껐???몄텧 洹쒖튃 상태瑜??④퍡 寃??/li></ul>',
    adminMemo: 'FAQ ?몄텧 愿由ъ? 梨쀫큸 吏??李몄“ 湲곗????숈떆??異붿쟻?⑸땲??',
    status: '게시',
    createdAt: '2026-03-25',
    updatedAt: '2026-03-26 10:18',
    updatedBy: 'admin_han'
  },
  {
    id: 'POL-011',
    category: '운영/콘텐츠,
    policyType: '梨쀫큸 ?곷떞 ?꾪솚 ?뺤콉',
    title: '梨쀫큸 ?곷떞 ?꾪솚 ?뺤콉',
    versionLabel: 'v2026.03-candidate',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['愿由ъ옄 肄섏넄', '怨좉컼?쇳꽣'],
    requiresConsent: false,
    trackingStatus: '?뺤콉 誘명솗??,
    relatedAdminPages: ['Operation > 梨쀫큸 ?ㅼ젙', 'Operation > FAQ', 'Message > 硫붿씪'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-chatbot-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '梨쀫큸 fallback, ?곷떞 ?멸퀎, FAQ 吏??李몄“, 踰꾩쟾 鍮꾧탳 湲곗???placeholder ?④퀎?먯꽌 異붿쟻?섎뒗 ?뺤콉 ?꾨낫?낅땲??',
    legalReferences: ['梨쀫큸 ?ㅼ젙 상세 IA'],
    bodyHtml:
      '<h2>梨쀫큸 ?곷떞 ?꾪솚 ?뺤콉</h2><p>梨쀫큸 ?ㅼ젙 ?붾㈃? ?꾩쭅 placeholder?대ŉ, ?쒕굹由ъ삤 踰꾩쟾 ?뺤콉怨??곷떞 ?꾪솚 湲곗???癒쇱? ?뺤젙?댁빞 ?⑸땲??</p><ul><li>fallback 洹쒖튃</li><li>?곷떞 ?멸퀎 議곌굔</li><li>FAQ 李몄“? ?꾩냽 ?덈궡 ?곌껐</li></ul>',
    adminMemo: '?꾩옱??臾몄꽌 異붿쟻???꾨낫 ?뺤콉?대ŉ ?ㅽ럹?댁? 援ы쁽 ??상세 洹쒖튃 ?뺤젙???꾩슂?⑸땲??',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 10:22',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-012',
    category: '硫붿떆吏/알림',
    policyType: '硫붿씪 발송 운영?뺤콉',
    title: '硫붿씪 발송 운영?뺤콉',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-25',
    exposureSurfaces: ['愿由ъ옄 肄섏넄', '???ㅼ젙'],
    requiresConsent: false,
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: ['Message > 硫붿씪', 'Message > 대상洹몃９', 'Message > 발송 이력'],
    sourceDocuments: [
      'docs/specs/page-ia/message-mail-page-ia.md',
      'docs/specs/page-ia/message-history-page-ia.md'
    ],
    summary:
      '硫붿씪 ?쒗뵆由?硫뷀? ?깅줉, TinyMCE 蹂몃Ц ?묒꽦, 즉시/예약 발송, ?섏떊 洹몃９ ?곕룞 洹쒖튃???뺣━?⑸땲??',
    legalReferences: ['硫붿씪 상세 IA', '?뺣낫?듭떊留?내용珥됱쭊 諛??뺣낫蹂댄샇 ?깆뿉 愿??踰뺣쪧'],
    bodyHtml:
      '<h2>硫붿씪 발송 운영?뺤콉</h2><p>硫붿씪 ?쒗뵆由우? 紐⑸줉?먯꽌 硫뷀?瑜??깅줉?섍퀬, ?깅줉 상세 ?섏씠吏?먯꽌 TinyMCE 蹂몃Ц??理쒖쥌 ?묒꽦?⑸땲??</p><ul><li>?섍꼍蹂???좏겙 ?쎌엯怨?HTML 蹂몃Ц 寃??/li><li>즉시/예약 발송 ??사유 ?낅젰怨?媛먯궗 로그 異붿쟻</li><li>?먮룞 발송 ?쒗뵆由?활성/비활성?꾪솚 洹쒖튃</li></ul>',
    adminMemo: '硫붿씪 ?쒗뵆由욧낵 발송 이력 ?꾩냽 寃???뺤콉???④퍡 臾띠뿀?듬땲??',
    status: '게시',
    createdAt: '2026-03-25',
    updatedAt: '2026-03-26 10:28',
    updatedBy: 'admin_lee'
  },
  {
    id: 'POL-013',
    category: '硫붿떆吏/알림',
    policyType: '?몄떆 발송 운영?뺤콉',
    title: '?몄떆 발송 운영?뺤콉',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-25',
    exposureSurfaces: ['愿由ъ옄 肄섏넄', '???ㅼ젙'],
    requiresConsent: false,
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: ['Message > ?몄떆', 'Message > 대상洹몃９', 'Message > 발송 이력'],
    sourceDocuments: [
      'docs/specs/page-ia/message-push-page-ia.md',
      'docs/specs/page-ia/message-history-page-ia.md'
    ],
    summary:
      '?몄떆 ?쒗뵆由?硫뷀? ?깅줉, TinyMCE 蹂몃Ц ?묒꽦, 즉시/예약 발송怨?상태 ?꾪솚 湲곗????뺣━?⑸땲??',
    legalReferences: ['?몄떆 상세 IA', '?뺣낫?듭떊留?내용珥됱쭊 諛??뺣낫蹂댄샇 ?깆뿉 愿??踰뺣쪧'],
    bodyHtml:
      '<h2>?몄떆 발송 운영?뺤콉</h2><p>?몄떆 ?쒗뵆由우? 硫뷀? ?깅줉 ??蹂몃Ц 상세?먯꽌 HTML 湲곕컲 肄섑뀗痢좊? ?묒꽦?섍퀬, 발송 洹몃９怨?예약 시각???④퍡 寃?섑빀?덈떎.</p><ul><li>?먮룞 발송 ?쒗뵆由?활성/비활성洹쒖튃</li><li>즉시/예약 발송??사유 ?낅젰怨?媛먯궗 로그 異붿쟻</li><li>발송 寃곌낵??발송 이력?먯꽌 ?꾩냽 寃??/li></ul>',
    adminMemo: '?몄떆 ?쒗뵆由?운영怨?발송 이력 寃??洹쒖튃??怨듯넻 湲곗??낅땲??',
    status: '게시',
    createdAt: '2026-03-25',
    updatedAt: '2026-03-26 10:31',
    updatedBy: 'admin_lee'
  },
  {
    id: 'POL-014',
    category: '硫붿떆吏/알림',
    policyType: '발송 실패/?ъ떆???뺤콉',
    title: '발송 실패/?ъ떆???뺤콉',
    versionLabel: 'v2026.03-candidate',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['愿由ъ옄 肄섏넄'],
    requiresConsent: false,
    trackingStatus: '?뺤콉 誘명솗??,
    relatedAdminPages: ['Message > 발송 이력', 'Message > 硫붿씪', 'Message > ?몄떆'],
    sourceDocuments: [
      'docs/specs/page-ia/message-history-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '발송 실패 嫄??ъ떆??踰붿쐞, 以묐났 발송 諛⑹?, CSV ?대낫?닿린 媛먯궗 ?щ?瑜?異붿쟻?섎뒗 ?뺤콉 ?꾨낫?낅땲??',
    legalReferences: ['발송 이력 상세 IA'],
    bodyHtml:
      '<h2>발송 실패/?ъ떆???뺤콉</h2><p>발송 실패 ?대젰? ?ъ떆??踰붿쐞? 以묐났 발송 諛⑹? 湲곗????뺤젙?섏뼱???⑸땲??</p><ul><li>?ъ떆??대상?먯젙 湲곗?</li><li>?ъ떆???잛닔? 媛꾧꺽</li><li>CSV ?대낫?닿린 諛??섏떊??紐⑸줉 蹂댁〈 湲곌컙</li></ul>',
    adminMemo: '발송 이력 ?섏씠吏 ?ㅽ뵂 ?댁뒋瑜??뺤콉 愿由ъ뿉??異붿쟻?섎룄濡?異붽????꾨낫 臾몄꽌?낅땲??',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 10:36',
    updatedBy: 'admin_kim'
  },
  {
    id: 'POL-015',
    category: '愿由ъ옄/蹂댁븞',
    policyType: '愿由ъ옄 沅뚰븳 蹂寃??뺤콉',
    title: '愿由ъ옄 沅뚰븳 蹂寃??뺤콉',
    versionLabel: 'v2026.03-draft',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['愿由ъ옄 肄섏넄'],
    requiresConsent: false,
    trackingStatus: '臾몄꽌 異붿쟻',
    relatedAdminPages: ['System > 권한 관리, 'System > 관리자 계정', 'System > 媛먯궗 로그'],
    sourceDocuments: [
      'docs/specs/page-ia/system-permissions-page-ia.md',
      'docs/specs/admin-page-gap-register.md',
      'src/features/system/pages/system-permissions-page.tsx'
    ],
    summary:
      '권한 부여 ?섏젙, ?뚯닔??사유 ?낅젰, 媛먯궗 異붿쟻, ?뱀씤 泥닿퀎 誘명솗????ぉ???④퍡 愿由ы븯???대? ?뺤콉?낅땲??',
    legalReferences: ['권한 관리상세 IA', '?대? 蹂댁븞 운영 吏移?珥덉븞'],
    bodyHtml:
      '<h2>愿由ъ옄 沅뚰븳 蹂寃??뺤콉</h2><p>沅뚰븳 蹂寃쎌? 대상愿由ъ옄, 蹂寃?沅뚰븳, 사유, ?섑뻾?먮? ?④퍡 湲곕줉?섍퀬 媛먯궗 로그?먯꽌 ??텛?곹븷 ???덉뼱???⑸땲??</p><ul><li>권한 회수???뺤씤 ?④퀎? 사유 ?낅젰 ?꾩닔</li><li>怨좎쐞??沅뚰븳??2???뱀씤 ?щ????꾩냽 ?뺤젙 ?꾩슂</li><li>역할 ?쒗뵆由욧낵 媛쒕퀎 permission ?몄쭛 ?뺤콉???④퍡 寃??/li></ul>',
    adminMemo: '?꾩옱 ?붾㈃? actor ?섎뱶肄붾뵫怨??뱀씤 泥닿퀎 誘명솗?뺤씠 ?⑥븘 ?덉뼱 臾몄꽌 異붿쟻 상태濡?愿由ы빀?덈떎.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 10:42',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-016',
    category: '硫붿떆吏/알림',
    policyType: '留덉????뺣낫 ?섏떊 ?숈쓽',
    title: '留덉????뺣낫 ?섏떊 ?숈쓽',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-20',
    exposureSurfaces: ['회원媛??, '留덉씠?섏씠吏', '???ㅼ젙', '愿由ъ옄 肄섏넄'],
    requiresConsent: true,
    trackingStatus: '肄붾뱶 諛섏쁺',
    relatedAdminPages: ['Message > 硫붿씪', 'Message > ?몄떆', 'Users > 회원 상세'],
    sourceDocuments: [
      'docs/specs/page-ia/message-mail-page-ia.md',
      'docs/specs/page-ia/message-push-page-ia.md',
      'docs/specs/admin-data-usage-map.md'
    ],
    summary:
      '?꾨줈紐⑥뀡 硫붿씪/?몄떆 발송???꾪븳 ?섏떊 ?숈쓽 ??ぉ怨?泥좏쉶 諛⑸쾿???뺣━??사용자?숈쓽 臾몄꽌?낅땲??',
    legalReferences: ['?뺣낫?듭떊留?내용珥됱쭊 諛??뺣낫蹂댄샇 ?깆뿉 愿??踰뺣쪧'],
    bodyHtml:
      '<h2>留덉????뺣낫 ?섏떊 ?숈쓽</h2><p>회원? 硫붿씪, ???몄떆, 臾몄옄 ?섏떊 ?숈쓽瑜??좏깮?곸쑝濡??ㅼ젙?????덉쑝硫??몄젣?좎? 泥좏쉶?????덉뒿?덈떎.</p><ul><li>회원媛??留덉씠?섏씠吏/???ㅼ젙 ?몄텧</li><li>硫붿씪/?몄떆 운영 ?뺤콉怨??④퍡 寃??/li></ul>',
    adminMemo: '硫붿씪/?몄떆 ?쒗뵆由?운영怨??섏떊 嫄곕? 泥섎━??湲곗? ?숈쓽 臾몄꽌?낅땲??',
    status: '게시',
    createdAt: '2026-03-18',
    updatedAt: '2026-03-20 09:30',
    updatedBy: 'admin_park'
  }
] as SeedOperationPolicy[]).map(createSeedPolicy);

const initialPolicyHistories = initialPolicies.map((policy, index) =>
  createPolicyHistoryEntry(
    policy,
    'created',
    '珥덇린 ?뺤콉 ?ㅻ깄???깅줉',
    `PH-${String(index + 1).padStart(4, '0')}`
  )
);

export const useOperationPolicyStore = create<OperationPolicyStore>((set, get) => ({
  policies: initialPolicies,
  policyHistories: initialPolicyHistories,
  savePolicy: (payload) => {
    const now = formatNow();
    const target = payload.id
      ? get().policies.find((policy) => policy.id === payload.id) ?? null
      : null;

    const nextPolicy: OperationPolicy = target
      ? {
          ...target,
          category: payload.category,
          policyType: payload.policyType,
          title: normalizeText(payload.title),
          versionLabel: normalizeText(payload.versionLabel),
          effectiveDate: payload.effectiveDate,
          exposureSurfaces: [...payload.exposureSurfaces],
          requiresConsent: payload.requiresConsent,
          trackingStatus: payload.trackingStatus,
          relatedAdminPages: normalizeRelatedAdminPages(payload.relatedAdminPages),
          relatedUserPages: normalizeRelatedUserPages(payload.relatedUserPages),
          sourceDocuments: normalizeStringList(payload.sourceDocuments),
          summary: normalizeText(payload.summary),
          legalReferences: normalizeLegalReferences(payload.legalReferences),
          bodyHtml: payload.bodyHtml,
          adminMemo: normalizeText(payload.adminMemo),
          updatedAt: now,
          updatedBy: CURRENT_ACTOR
        }
      : {
          id: getNextPolicyId(get().policies),
          category: payload.category,
          policyType: payload.policyType,
          title: normalizeText(payload.title),
          versionLabel: normalizeText(payload.versionLabel),
          effectiveDate: payload.effectiveDate,
          exposureSurfaces: [...payload.exposureSurfaces],
          requiresConsent: payload.requiresConsent,
          trackingStatus: payload.trackingStatus,
          relatedAdminPages: normalizeRelatedAdminPages(payload.relatedAdminPages),
          relatedUserPages: normalizeRelatedUserPages(payload.relatedUserPages),
          sourceDocuments: normalizeStringList(payload.sourceDocuments),
          summary: normalizeText(payload.summary),
          legalReferences: normalizeLegalReferences(payload.legalReferences),
          bodyHtml: payload.bodyHtml,
          adminMemo: normalizeText(payload.adminMemo),
          status: '숨김',
          createdAt: toDateString(now),
          updatedAt: now,
          updatedBy: CURRENT_ACTOR
        };

    set((state) => ({
      policies: target
        ? state.policies.map((policy) =>
            policy.id === nextPolicy.id ? nextPolicy : policy
          )
        : [nextPolicy, ...state.policies],
      policyHistories: appendPolicyHistory(
        state.policyHistories,
        nextPolicy,
        target ? 'updated' : 'created',
        target ? '?뺤콉 硫뷀?/蹂몃Ц ?섏젙' : '???뺤콉 ?깅줉',
        now,
        CURRENT_ACTOR
      )
    }));

    return nextPolicy;
  },
  togglePolicyStatus: ({ policyId, nextStatus }) => {
    const target = get().policies.find((policy) => policy.id === policyId);

    if (!target) {
      return null;
    }

    const nextPolicy: OperationPolicy = {
      ...target,
      status: nextStatus,
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      policies: state.policies.map((policy) =>
        policy.id === policyId ? nextPolicy : policy
      ),
      policyHistories: appendPolicyHistory(
        state.policyHistories,
        nextPolicy,
        'status_changed',
        `상태瑜?${nextStatus}濡?蹂寃?,
        nextPolicy.updatedAt,
        CURRENT_ACTOR
      )
    }));

    return nextPolicy;
  },
  publishPolicyHistoryVersion: ({ policyId, historyId, reason }) => {
    const target = get().policies.find((policy) => policy.id === policyId);
    const historyEntry = get().policyHistories.find(
      (entry) => entry.id === historyId && entry.policyId === policyId
    );

    if (!target || !historyEntry) {
      return null;
    }

    const now = formatNow();
    const snapshot = historyEntry.snapshot;
    const nextPolicy: OperationPolicy = {
      ...target,
      category: snapshot.category,
      policyType: snapshot.policyType,
      title: snapshot.title,
      versionLabel: snapshot.versionLabel,
      effectiveDate: snapshot.effectiveDate,
      exposureSurfaces: [...snapshot.exposureSurfaces],
      requiresConsent: snapshot.requiresConsent,
      trackingStatus: snapshot.trackingStatus,
      relatedAdminPages: [...snapshot.relatedAdminPages],
      relatedUserPages: [...snapshot.relatedUserPages],
      sourceDocuments: [...snapshot.sourceDocuments],
      summary: snapshot.summary,
      legalReferences: [...snapshot.legalReferences],
      bodyHtml: snapshot.bodyHtml,
      adminMemo: snapshot.adminMemo,
      status: '게시',
      updatedAt: now,
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      policies: state.policies.map((policy) =>
        policy.id === policyId ? nextPolicy : policy
      ),
      policyHistories: appendPolicyHistory(
        state.policyHistories,
        nextPolicy,
        'version_published',
        `?대젰 踰꾩쟾 게시: ${historyEntry.versionLabel} / ${normalizeHistoryNote(reason)}`,
        now,
        CURRENT_ACTOR
      )
    }));

    return nextPolicy;
  },
  deletePolicy: ({ policyId, reason }) => {
    const target = get().policies.find((policy) => policy.id === policyId);

    if (!target) {
      return null;
    }

    const deletedAt = formatNow();
    const deletedPolicy: OperationPolicy = {
      ...target,
      updatedAt: deletedAt,
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      policies: state.policies.filter((policy) => policy.id !== policyId),
      policyHistories: appendPolicyHistory(
        state.policyHistories,
        deletedPolicy,
        'deleted',
        `?뺤콉 ??젣: ${normalizeHistoryNote(reason)}`,
        deletedAt,
        CURRENT_ACTOR
      )
    }));

    return deletedPolicy;
  }
}));


