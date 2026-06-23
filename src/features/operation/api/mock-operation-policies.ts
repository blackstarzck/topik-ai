import type {
  OperationPolicy,
  OperationPolicyHistoryAction,
  OperationPolicyHistoryEntry,
  OperationPolicyRelatedUserPage
} from '../model/policy-types';
import { inferOperationPolicyRelatedUserPages } from '../model/policy-types';

type SeedOperationPolicy = Omit<OperationPolicy, 'relatedUserPages'> & {
  relatedUserPages?: OperationPolicyRelatedUserPage[];
};

function normalizeText(value: string): string {
  return value.trim();
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

const mockOperationPolicies: OperationPolicy[] = ([
  {
    id: 'POL-001',
    category: '법률/약관',
    policyType: '이용약관',
    title: 'TOPIK AI 이용약관',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-20',
    exposureSurfaces: ['회원가입', '마이페이지', '고객센터'],
    requiresConsent: true,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Operation > 정책 관리', 'Users > 회원 목록', 'Users > 회원 상세'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-policies-page-ia.md',
      'docs/specs/admin-data-usage-map.md'
    ],
    summary:
      '서비스 이용 조건, 계정 운영 기준, 결제 및 콘텐츠 이용 제한 사항을 정리한 기본 약관입니다.',
    legalReferences: ['전자상거래 등에서의 소비자보호에 관한 법률', '민법'],
    bodyHtml:
      '<h2>TOPIK AI 이용약관</h2><p>본 약관은 일반적인 온라인 서비스 표준약관을 참고하여 작성한 임시 약관이며, 정식 서비스 적용 전 법률 검토를 거쳐 확정됩니다.</p><h3>제1장 총칙</h3><h4>제1조 (목적)</h4><p>본 약관은 회사(이하 "회사")가 제공하는 TOPIK AI 및 이와 관련된 제반 서비스(이하 "서비스")의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항, 이용조건 및 절차 등 기본적인 사항을 규정함을 목적으로 합니다.</p><h4>제2조 (용어의 정의)</h4><p>본 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p><ol><li>"서비스"란 회사가 PC, 모바일 애플리케이션 등 각종 유무선 기기를 통하여 회원에게 제공하는 인공지능 기반 한국어능력시험(TOPIK) 학습 및 부가 서비스 일체를 말합니다.</li><li>"회원"이란 본 약관에 동의하고 회사와 이용계약을 체결하여 서비스를 이용하는 자를 말합니다.</li><li>"계정"이란 회원의 식별과 서비스 이용을 위하여 회원이 등록한 이메일 주소 또는 회사가 부여한 고유한 문자·숫자의 조합을 말합니다.</li><li>"비밀번호"란 회원의 동일성 확인과 정보 보호를 위하여 회원이 설정한 문자·숫자 등의 조합을 말합니다.</li><li>"유료서비스"란 회사가 유료로 제공하는 강의, 콘텐츠, 구독 상품 등 일체의 서비스를 말합니다.</li><li>"포인트"란 서비스 이용 과정에서 회사가 정한 기준에 따라 회원에게 적립·지급되는 서비스 내 가상의 적립 수단을 말합니다.</li><li>"게시물"이란 회원이 서비스를 이용하면서 게시한 글, 사진, 댓글, 학습 기록 등 모든 형태의 정보나 자료를 말합니다.</li></ol><p>본 약관에서 정의하지 않은 용어는 관계 법령 및 일반 상관례에 따릅니다.</p><h4>제3조 (약관의 게시와 개정)</h4><ol><li>회사는 본 약관의 내용을 회원이 쉽게 알 수 있도록 서비스 초기 화면 또는 연결 화면에 게시합니다.</li><li>회사는 「약관의 규제에 관한 법률」, 「전자상거래 등에서의 소비자보호에 관한 법률」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.</li><li>회사가 약관을 개정할 경우 적용일자 및 개정사유를 명시하여 적용일자 7일 전부터 공지하며, 회원에게 불리한 개정의 경우 최소 30일 전부터 공지하고 필요한 경우 전자우편 등으로 개별 통지합니다.</li><li>회원이 개정 약관의 적용일자까지 거부 의사를 표시하지 않으면 개정 약관에 동의한 것으로 봅니다. 회원이 개정 약관에 동의하지 않는 경우 이용계약을 해지할 수 있습니다.</li></ol><h4>제4조 (약관의 해석 및 준칙)</h4><p>본 약관에서 정하지 아니한 사항과 본 약관의 해석에 관하여는 관계 법령 및 회사가 정한 개별 서비스의 이용약관·운영정책에 따르며, 그 외에는 일반 상관례에 따릅니다.</p><h3>제2장 이용계약의 체결 및 회원 관리</h3><h4>제5조 (이용계약의 체결)</h4><ol><li>이용계약은 이용을 신청하는 자(이하 "가입신청자")가 본 약관의 내용에 동의한 후 회사가 정한 가입 양식에 따라 회원정보를 기입하여 가입을 신청하고, 회사가 이를 승낙함으로써 성립합니다.</li><li>회사는 가입신청자의 신청에 대하여 승낙함을 원칙으로 하되, 실명이 아니거나 타인의 명의를 이용한 경우, 허위 정보를 기재한 경우, 만 14세 미만의 아동이 법정대리인의 동의를 받지 않은 경우, 이전에 이용약관 위반으로 자격을 상실한 경우, 부정한 용도로 이용하고자 하는 경우 등에는 승낙을 거부하거나 사후에 이용계약을 해지할 수 있습니다.</li></ol><h4>제6조 (회원 정보의 변경)</h4><p>회원은 개인정보 관리 화면을 통하여 언제든지 본인의 정보를 열람하고 수정할 수 있습니다. 가입 신청 시 기재한 사항이 변경된 경우 회원은 이를 수정하거나 회사에 통지하여야 하며, 변경하지 않아 발생한 불이익에 대하여 회사는 책임을 지지 않습니다.</p><h4>제7조 (계정 및 비밀번호 관리 의무)</h4><ol><li>회원의 계정과 비밀번호에 관한 관리 책임은 회원에게 있으며, 이를 제3자가 이용하도록 하여서는 안 됩니다.</li><li>회원은 계정 또는 비밀번호가 도용되거나 제3자가 사용하고 있음을 인지한 경우 즉시 회사에 통지하고 회사의 안내에 따라야 합니다.</li></ol><h4>제8조 (개인정보의 보호)</h4><p>회사는 관계 법령이 정하는 바에 따라 회원의 개인정보를 보호하기 위하여 노력합니다. 개인정보의 수집·이용·제공·파기 등에 관한 사항은 회사가 별도로 정한 「개인정보 처리방침」에 따릅니다.</p><h4>제9조 (회원에 대한 통지)</h4><p>회사가 회원에게 통지를 하는 경우 회원이 등록한 전자우편, 앱 푸시 알림, 서비스 내 알림 등으로 할 수 있으며, 불특정 다수 회원에 대한 통지는 서비스 화면 게시로 개별 통지를 갈음할 수 있습니다.</p><h3>제3장 서비스의 이용</h3><h4>제10조 (서비스의 제공)</h4><ol><li>회사는 회원에게 인공지능 기반 TOPIK 학습 콘텐츠 및 모의시험·문제풀이, 학습 진단 및 맞춤형 추천·성취도 분석, 커뮤니티 및 질의응답 등 회원 간 상호작용, 그 밖에 회사가 추가로 개발하거나 제휴를 통해 제공하는 일체의 서비스를 제공합니다.</li><li>서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 합니다.</li></ol><h4>제11조 (서비스의 변경 및 중단)</h4><ol><li>회사는 운영상·기술상의 필요에 따라 제공하는 서비스의 전부 또는 일부를 변경할 수 있으며, 변경 내용은 사전에 공지합니다.</li><li>회사는 정보통신설비의 보수점검·교체·고장, 통신두절, 천재지변 등 부득이한 사유가 발생한 경우 서비스의 제공을 일시적으로 중단할 수 있습니다.</li></ol><h4>제12조 (정보의 제공 및 광고의 게재)</h4><p>회사는 서비스 운영과 관련한 정보를 공지·전자우편·푸시 등으로 제공할 수 있으며, 광고성 정보는 회원이 수신에 동의한 경우에 한하여 전송합니다. 회원은 언제든지 수신 동의를 철회할 수 있습니다.</p><h4>제13조 (게시물의 저작권 및 관리)</h4><ol><li>회원이 서비스 내에 게시한 게시물의 저작권은 해당 게시물의 저작자에게 귀속됩니다.</li><li>회사는 서비스의 운영·전시·홍보 등을 위하여 필요한 범위 내에서 회원의 게시물을 이용할 수 있습니다.</li><li>회사는 게시물이 관련 법령 또는 본 약관·운영정책에 위반되는 경우 사전 통지 없이 해당 게시물을 삭제·이동하거나 게시를 거부할 수 있습니다.</li></ol><h4>제14조 (인공지능 기반 서비스의 이용)</h4><ol><li>회사가 제공하는 인공지능 기반 학습 진단·추천·자동 채점 등의 결과는 학습 참고용 정보이며, 실제 시험 결과나 성적을 보장하지 않습니다.</li><li>회원은 인공지능 서비스의 결과물을 부정행위, 타인의 권리 침해 등 위법·부당한 목적으로 이용하여서는 안 됩니다.</li></ol><h3>제4장 유료서비스 및 결제</h3><h4>제15조 (유료서비스의 결제)</h4><ol><li>회원은 회사가 제공하는 신용카드, 간편결제, 계좌이체 등 결제수단을 통하여 유료서비스를 이용할 수 있습니다.</li><li>회사는 결제 전 이용기간, 이용조건, 결제금액 등 중요한 거래조건을 회원이 명확히 인지할 수 있도록 안내합니다.</li></ol><h4>제16조 (청약철회 및 환불)</h4><ol><li>회원은 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관계 법령에 따라 유료서비스 결제일 또는 이용 가능일부터 7일 이내에 청약을 철회할 수 있습니다.</li><li>다만 이미 콘텐츠의 제공이 개시되었거나 상당 부분을 이용한 경우, 기간제·구독형 서비스로서 이용기간이 경과한 경우 등에는 청약철회가 제한될 수 있으며, 회사는 이러한 사실을 사전에 고지합니다.</li><li>환불 금액의 산정과 절차는 관계 법령 및 회사가 별도로 정한 「결제·환불 정책」에 따릅니다.</li></ol><h4>제17조 (포인트 및 쿠폰)</h4><p>회사는 서비스 이용 촉진을 위하여 포인트·쿠폰 등을 발급할 수 있습니다. 포인트와 쿠폰의 적립·사용·소멸·유효기간 등에 관한 세부 기준은 회사가 별도로 정한 운영정책에 따르며, 무상으로 지급된 포인트·쿠폰은 환불 대상에서 제외될 수 있습니다.</p><h3>제5장 계약 당사자의 의무</h3><h4>제18조 (회사의 의무)</h4><p>회사는 관계 법령과 본 약관을 준수하며, 안정적이고 지속적인 서비스 제공을 위하여 노력합니다. 회사는 회원의 개인정보를 보호하고, 회원이 제기하는 정당한 의견이나 불만을 신속히 처리합니다.</p><h4>제19조 (회원의 의무 및 금지행위)</h4><p>회원은 다음 각 호의 행위를 하여서는 안 됩니다.</p><ul><li>타인의 정보 도용 또는 허위 정보의 등록</li><li>회사 및 제3자의 저작권 등 지식재산권을 침해하는 행위</li><li>서비스의 정상적인 운영을 방해하거나 시스템에 부정하게 접근하는 행위</li><li>욕설, 비방, 음란물 게시 등 타인에게 피해를 주거나 미풍양속에 반하는 행위</li><li>회사의 사전 동의 없이 서비스를 영리 목적으로 이용하는 행위</li><li>기타 관계 법령 및 본 약관·운영정책에 위반되는 행위</li></ul><h4>제20조 (이용제한 및 이용계약의 해지)</h4><ol><li>회원은 언제든지 서비스 내 회원탈퇴 절차를 통하여 이용계약을 해지할 수 있습니다.</li><li>회사는 회원이 본 약관 또는 관계 법령을 위반하는 경우 경고, 일시정지, 영구이용정지, 이용계약 해지 등의 조치를 단계적으로 취할 수 있으며, 그 사유와 기준은 회사의 운영정책에 따릅니다.</li></ol><h3>제6장 기타</h3><h4>제21조 (책임제한 및 면책)</h4><ol><li>회사는 천재지변, 회원의 귀책사유, 기간통신사업자의 장애 등 회사의 책임 없는 사유로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.</li><li>회사는 회원이 서비스를 이용하여 기대하는 학습 성과나 시험 결과를 얻지 못한 것에 대하여 책임을 지지 않습니다.</li><li>회사는 회원 상호 간 또는 회원과 제3자 간에 서비스를 매개로 발생한 분쟁에 개입할 의무가 없으며 이로 인한 손해를 배상할 책임이 없습니다.</li></ol><h4>제22조 (분쟁의 해결 및 준거법·관할)</h4><ol><li>회사와 회원은 서비스와 관련하여 분쟁이 발생한 경우 이를 원만하게 해결하기 위하여 성실히 협의합니다.</li><li>본 약관은 대한민국 법령에 따라 규율되고 해석되며, 서비스 이용과 관련하여 발생한 분쟁에 관한 소송은 관계 법령에 정한 절차에 따른 관할 법원에 제기합니다.</li></ol><h4>부칙</h4><p>본 약관은 2026년 3월 20일부터 시행합니다.</p>',
    adminMemo: '회원가입, 고객센터, 마이페이지 약관 링크의 기준 문서입니다. 현재 본문은 표준약관 기반 임시 일반 약관이며 정식 적용 전 법무 검토가 필요합니다.',
    status: '게시',
    createdAt: '2026-03-18',
    updatedAt: '2026-03-20 09:10',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-002',
    category: '법률/약관',
    policyType: '개인정보 처리방침',
    title: 'TOPIK AI 개인정보 처리방침',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-20',
    exposureSurfaces: ['회원가입', '마이페이지', '고객센터', '앱 설정'],
    requiresConsent: true,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Operation > 정책 관리', 'Users > 회원 상세', 'Message > 메일'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-policies-page-ia.md',
      'docs/specs/admin-data-usage-map.md'
    ],
    summary:
      '수집 항목, 처리 목적, 보관 기간, 파기 절차와 같은 개인정보 처리 기준을 공지합니다.',
    legalReferences: ['개인정보 보호법', '정보통신망 이용촉진 및 정보보호 등에 관한 법률'],
    bodyHtml:
      '<h2>개인정보 처리방침</h2><p>회사는 회원가입, 결제, 학습 서비스 제공 과정에서 필요한 최소한의 개인정보를 수집합니다.</p><ul><li>수집 항목: 이메일, 닉네임, 결제 이력</li><li>보관 기간: 법령 및 내부 정책 기준</li></ul>',
    adminMemo: '앱 설정 법적 고지와 회원가입 하단 노출 기준 문서입니다.',
    status: '게시',
    createdAt: '2026-03-18',
    updatedAt: '2026-03-20 09:25',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-003',
    category: '결제/리워드',
    policyType: '결제ㆍ환불 정책',
    title: '결제ㆍ환불 정책',
    versionLabel: 'v2026.04',
    effectiveDate: '2026-04-01',
    exposureSurfaces: ['결제', '마이페이지', '고객센터', '관리자 콘솔'],
    requiresConsent: true,
    trackingStatus: '문서 추적',
    relatedAdminPages: ['Commerce > 결제 내역', 'Commerce > 환불 관리', 'Commerce > 포인트 관리'],
    sourceDocuments: [
      'docs/specs/page-ia/commerce-refunds-page-ia.md',
      'docs/specs/page-ia/commerce-payments-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '결제 승인, 환불 가능 조건, 부분 환불 제한과 고객 안내 기준을 함께 추적하는 정책 문서입니다.',
    legalReferences: ['전자상거래 등에서의 소비자보호에 관한 법률', '전자상거래 등에서의 소비자보호 지침'],
    bodyHtml:
      '<h2>결제ㆍ환불 정책</h2><p>결제 후 7일 이내이면서 학습 이력이 없는 경우 전액 환불을 원칙으로 검토합니다.</p><ol><li>마이페이지 또는 고객센터에서 환불 요청 접수</li><li>운영 검토 후 승인/거절</li><li>결제 수단별 환불 완료 처리</li></ol><p>부분 환불과 고객 안내 메시지 연동은 후속 정책 확정이 필요합니다.</p>',
    adminMemo: '결제 내역/환불 관리 화면의 부분 환불, 고객 안내 규칙을 함께 추적합니다.',
    status: '게시',
    createdAt: '2026-03-21',
    updatedAt: '2026-03-24 15:40',
    updatedBy: 'admin_kim'
  },
  {
    id: 'POL-004',
    category: '커뮤니티/안전',
    policyType: '청소년 보호정책',
    title: '청소년 보호정책',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-22',
    exposureSurfaces: ['고객센터', '앱 설정', '관리자 콘솔'],
    requiresConsent: false,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Community > 게시글 관리', 'Community > 신고 관리', 'Operation > 정책 관리'],
    sourceDocuments: [
      'docs/specs/page-ia/community-posts-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '유해 정보 차단, 신고 접수, 청소년 보호 책임자 안내 등 커뮤니티 안전 운영 기준을 제공합니다.',
    legalReferences: ['청소년 보호법', '정보통신망 이용촉진 및 정보보호 등에 관한 법률'],
    bodyHtml:
      '<h2>청소년 보호정책</h2><p>회사는 청소년 유해 정보 노출 방지와 신고 처리 기준을 운영 정책으로 관리합니다.</p><ul><li>유해 정보 차단과 신고 접수 절차</li><li>청소년 보호 책임자 및 후속 안내 기준</li><li>커뮤니티 제재 정책과의 연결 규칙</li></ul>',
    adminMemo: '커뮤니티 안전 정책과 법적 고지 영역을 연결하는 기준 문서입니다.',
    status: '게시',
    createdAt: '2026-03-19',
    updatedAt: '2026-03-22 10:15',
    updatedBy: 'admin_han'
  },
  {
    id: 'POL-005',
    category: '커뮤니티/안전',
    policyType: '커뮤니티 게시글 제재 정책',
    title: '커뮤니티 게시글 제재 정책',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-25',
    exposureSurfaces: ['고객센터', '앱 설정', '관리자 콘솔'],
    requiresConsent: false,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Community > 게시글 관리', 'Community > 신고 관리', 'System > 감사 로그'],
    sourceDocuments: [
      'docs/specs/page-ia/community-posts-page-ia.md',
      'src/features/community/pages/community-posts-page.tsx'
    ],
    summary:
      '게시글 숨김/삭제 시 쓰는 정책 코드, 사유 입력, 내부 메모 기록 규칙을 정리한 제재 기준입니다.',
    legalReferences: ['정보통신망 이용촉진 및 정보보호 등에 관한 법률', '청소년 보호법'],
    bodyHtml:
      '<h2>커뮤니티 게시글 제재 정책</h2><p>게시글 조치 시 정책 코드와 자유 사유를 함께 기록하고, 감사 로그와 내부 메모를 남깁니다.</p><ul><li>SPAM · 스팸/도배</li><li>ABUSE · 욕설/혐오</li><li>AD · 광고/홍보</li><li>PRIVACY · 개인정보 노출</li><li>DUPLICATE · 중복 게시</li><li>OTHER · 기타</li></ul>',
    adminMemo: '게시글 관리의 ConfirmAction 정책 코드와 상세 IA를 기준으로 작성했습니다.',
    status: '게시',
    createdAt: '2026-03-22',
    updatedAt: '2026-03-25 11:05',
    updatedBy: 'admin_lee'
  },
  {
    id: 'POL-006',
    category: '결제/리워드',
    policyType: '추천인 보상 정책',
    title: '추천인 보상 정책',
    versionLabel: 'v2026.03-draft',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['관리자 콘솔', '마이페이지'],
    requiresConsent: false,
    trackingStatus: '문서 추적',
    relatedAdminPages: ['Users > 추천인 관리', 'Commerce > 포인트 관리', 'System > 감사 로그'],
    sourceDocuments: [
      'docs/specs/page-ia/users-referrals-page-ia.md',
      'src/features/users/pages/users-referrals-page.tsx'
    ],
    summary:
      '추천 코드 확정 시점, 보상 수단, 회수 규칙, 수동 보정 권한을 함께 정리하는 운영 정책 초안입니다.',
    legalReferences: ['서비스 운영 정책 초안', '추천인 관리 상세 IA'],
    bodyHtml:
      '<h2>추천인 보상 정책</h2><p>추천 코드는 추천인 1명당 1개를 기준으로 관리하며, 추천 확정과 보상 지급은 정책 스냅샷으로 기록합니다.</p><ul><li>확정 시점: 가입 완료 / 첫 결제 / 첫 학습 완료 후보</li><li>보상 수단: 포인트 / 쿠폰 / 혼합 후보</li><li>후속 검수: 추천 관계와 포인트 원장을 함께 확인</li></ul>',
    adminMemo: '추천인 페이지의 policySnapshot과 오픈 이슈를 정책 관리로 승격한 초안입니다.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 09:40',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-007',
    category: '결제/리워드',
    policyType: '포인트 운영정책',
    title: '포인트 운영정책',
    versionLabel: 'v2026.03-draft',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['관리자 콘솔', '결제', '마이페이지'],
    requiresConsent: false,
    trackingStatus: '문서 추적',
    relatedAdminPages: ['Commerce > 포인트 관리', 'Users > 추천인 관리', 'Operation > 이벤트'],
    sourceDocuments: [
      'docs/specs/page-ia/commerce-points-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '적립 원천 분류, 차감 우선순위, 소멸/보류/복구 기준, 수동 조정 승인 체계를 추적하는 운영 정책입니다.',
    legalReferences: ['포인트 관리 상세 IA', '서비스 운영 정책 초안'],
    bodyHtml:
      '<h2>포인트 운영정책</h2><p>포인트는 추천, 미션, 이벤트, 결제, 환불, 관리자, 시스템 원천으로 발생할 수 있으며 원장 단위로 검수합니다.</p><ul><li>차감 우선순위와 음수 잔액 허용 여부는 후속 확정 필요</li><li>소멸 예정/보류/복구 정책은 별도 승인 흐름 검토 필요</li><li>수동 조정은 감사 로그와 증빙 메모를 함께 남김</li></ul>',
    adminMemo: '포인트 관리 living IA의 정책 후보를 운영 정책으로 집약했습니다.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 09:55',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-008',
    category: '결제/리워드',
    policyType: '쿠폰 운영정책',
    title: '쿠폰 운영정책',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-24',
    exposureSurfaces: ['관리자 콘솔', '결제', '마이페이지'],
    requiresConsent: false,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Commerce > 쿠폰 관리', 'Operation > 이벤트', 'Message > 메일'],
    sourceDocuments: [
      'docs/specs/page-ia/commerce-coupons-page-ia.md',
      'docs/specs/page-ia/operation-events-page-ia.md'
    ],
    summary:
      '고객 다운로드, 자동 발행, 쿠폰 코드 생성, 지정 발행의 유형별 운영 규칙과 검증 기준을 모은 정책 문서입니다.',
    legalReferences: ['쿠폰 관리 상세 IA', '아임웹 운영 정책 확인 메모'],
    bodyHtml:
      '<h2>쿠폰 운영정책</h2><p>쿠폰은 고객 다운로드, 자동 발행, 쿠폰 코드 생성, 지정 발행 4가지 유형으로 운영합니다.</p><ul><li>첫 회원가입/첫 주문 완료/등급 변경/생일 자동 발행 규칙</li><li>무료 플랜 제한, 코드 수정 불가, 시크릿 링크 운영 기준</li><li>발행 중지/재개와 삭제는 사유 입력 및 감사 로그 추적 필수</li></ul>',
    adminMemo: '쿠폰 관리 상세 IA와 이벤트 보상 연결 규칙을 함께 반영했습니다.',
    status: '게시',
    createdAt: '2026-03-24',
    updatedAt: '2026-03-26 10:05',
    updatedBy: 'admin_lee'
  },
  {
    id: 'POL-009',
    category: '운영/콘텐츠',
    policyType: '이벤트 운영정책',
    title: '이벤트 운영정책',
    versionLabel: 'v2026.03-draft',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['관리자 콘솔', '고객센터'],
    requiresConsent: false,
    trackingStatus: '문서 추적',
    relatedAdminPages: ['Operation > 이벤트', 'Commerce > 쿠폰 관리', 'Message > 대상 그룹'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-events-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '이벤트 노출, 참여 조건, 보상 연결, 메시지/쿠폰 연동, 종료 후 복구 여부를 추적하는 운영 정책입니다.',
    legalReferences: ['이벤트 상세 IA', '서비스 운영 정책 초안'],
    bodyHtml:
      '<h2>이벤트 운영정책</h2><p>이벤트는 목록 검수와 등록 상세 페이지를 분리해 운영하고, 게시 예약과 종료 조치 후 감사 로그를 남깁니다.</p><ul><li>참여 대상 그룹과 중복 참여 제한 검수</li><li>보상 정책/메시지 템플릿/쿠폰 정책 참조</li><li>공개 이벤트의 노출/SEO 메타 관리</li></ul>',
    adminMemo: '이벤트 보상 수단과 종료 후 복구 가능 여부는 아직 후속 확정 대상입니다.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 10:12',
    updatedBy: 'admin_kim'
  },
  {
    id: 'POL-010',
    category: '운영/콘텐츠',
    policyType: 'FAQ 노출 정책',
    title: 'FAQ 노출 정책',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-25',
    exposureSurfaces: ['관리자 콘솔', '고객센터'],
    requiresConsent: false,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Operation > FAQ', 'Operation > 챗봇 설정', 'System > 감사 로그'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-faq-page-ia.md',
      'docs/specs/admin-data-usage-map.md'
    ],
    summary:
      'FAQ 원문 공개/비공개와 홈 추천, 결제 도움말, 온보딩 FAQ 같은 노출 큐레이션 규칙을 정의합니다.',
    legalReferences: ['FAQ 상세 IA'],
    bodyHtml:
      '<h2>FAQ 노출 정책</h2><p>FAQ는 원문 관리와 노출 관리, 지표 보기 3개 축으로 운영합니다.</p><ul><li>노출 위치: help_center, home_top, payment_help, onboarding</li><li>설정 방식: manual / auto</li><li>공개 상태 변경 시 연결된 노출 규칙 상태를 함께 검토</li></ul>',
    adminMemo: 'FAQ 노출 관리와 챗봇 지식 참조 기준을 동시에 추적합니다.',
    status: '게시',
    createdAt: '2026-03-25',
    updatedAt: '2026-03-26 10:18',
    updatedBy: 'admin_han'
  },
  {
    id: 'POL-011',
    category: '운영/콘텐츠',
    policyType: '챗봇 상담 전환 정책',
    title: '챗봇 상담 전환 정책',
    versionLabel: 'v2026.03-candidate',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['관리자 콘솔', '고객센터'],
    requiresConsent: false,
    trackingStatus: '정책 미확정',
    relatedAdminPages: ['Operation > 챗봇 설정', 'Operation > FAQ', 'Message > 메일'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-chatbot-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '챗봇 fallback, 상담 인계, FAQ 지식 참조, 버전 비교 기준을 placeholder 단계에서 추적하는 정책 후보입니다.',
    legalReferences: ['챗봇 설정 상세 IA'],
    bodyHtml:
      '<h2>챗봇 상담 전환 정책</h2><p>챗봇 설정 화면은 아직 placeholder이며, 시나리오 버전 정책과 상담 전환 기준을 먼저 확정해야 합니다.</p><ul><li>fallback 규칙</li><li>상담 인계 조건</li><li>FAQ 참조와 후속 안내 연결</li></ul>',
    adminMemo: '현재는 문서 추적용 후보 정책이며 실페이지 구현 전 상세 규칙 확정이 필요합니다.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 10:22',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-012',
    category: '메시지/알림',
    policyType: '메일 발송 운영정책',
    title: '메일 발송 운영정책',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-25',
    exposureSurfaces: ['관리자 콘솔', '앱 설정'],
    requiresConsent: false,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Message > 메일', 'Message > 대상 그룹', 'Message > 발송 이력'],
    sourceDocuments: [
      'docs/specs/page-ia/message-mail-page-ia.md',
      'docs/specs/page-ia/message-history-page-ia.md'
    ],
    summary:
      '메일 템플릿 메타 등록, TinyMCE 본문 작성, 즉시/예약 발송, 수신 그룹 연동 규칙을 정리합니다.',
    legalReferences: ['메일 상세 IA', '정보통신망 이용촉진 및 정보보호 등에 관한 법률'],
    bodyHtml:
      '<h2>메일 발송 운영정책</h2><p>메일 템플릿은 목록에서 메타를 등록하고, 등록 상세 페이지에서 TinyMCE 본문을 최종 작성합니다.</p><ul><li>환경변수 토큰 삽입과 HTML 본문 검수</li><li>즉시/예약 발송 시 사유 입력과 감사 로그 추적</li><li>자동 발송 템플릿 활성/비활성 전환 규칙</li></ul>',
    adminMemo: '메일 템플릿과 발송 이력 후속 검수 정책을 함께 묶었습니다.',
    status: '게시',
    createdAt: '2026-03-25',
    updatedAt: '2026-03-26 10:28',
    updatedBy: 'admin_lee'
  },
  {
    id: 'POL-013',
    category: '메시지/알림',
    policyType: '푸시 발송 운영정책',
    title: '푸시 발송 운영정책',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-25',
    exposureSurfaces: ['관리자 콘솔', '앱 설정'],
    requiresConsent: false,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Message > 푸시', 'Message > 대상 그룹', 'Message > 발송 이력'],
    sourceDocuments: [
      'docs/specs/page-ia/message-push-page-ia.md',
      'docs/specs/page-ia/message-history-page-ia.md'
    ],
    summary:
      '푸시 템플릿 메타 등록, TinyMCE 본문 작성, 즉시/예약 발송과 상태 전환 기준을 정리합니다.',
    legalReferences: ['푸시 상세 IA', '정보통신망 이용촉진 및 정보보호 등에 관한 법률'],
    bodyHtml:
      '<h2>푸시 발송 운영정책</h2><p>푸시 템플릿은 메타 등록 후 본문 상세에서 HTML 기반 콘텐츠를 작성하고, 발송 그룹과 예약 시각을 함께 검수합니다.</p><ul><li>자동 발송 템플릿 활성/비활성 규칙</li><li>즉시/예약 발송의 사유 입력과 감사 로그 추적</li><li>발송 결과는 발송 이력에서 후속 검수</li></ul>',
    adminMemo: '푸시 템플릿 운영과 발송 이력 검수 규칙의 공통 기준입니다.',
    status: '게시',
    createdAt: '2026-03-25',
    updatedAt: '2026-03-26 10:31',
    updatedBy: 'admin_lee'
  },
  {
    id: 'POL-014',
    category: '메시지/알림',
    policyType: '발송 실패/재시도 정책',
    title: '발송 실패/재시도 정책',
    versionLabel: 'v2026.03-candidate',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['관리자 콘솔'],
    requiresConsent: false,
    trackingStatus: '정책 미확정',
    relatedAdminPages: ['Message > 발송 이력', 'Message > 메일', 'Message > 푸시'],
    sourceDocuments: [
      'docs/specs/page-ia/message-history-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '발송 실패 건 재시도 범위, 중복 발송 방지, CSV 내보내기 감사 여부를 추적하는 정책 후보입니다.',
    legalReferences: ['발송 이력 상세 IA'],
    bodyHtml:
      '<h2>발송 실패/재시도 정책</h2><p>발송 실패 이력은 재시도 범위와 중복 발송 방지 기준이 확정되어야 합니다.</p><ul><li>재시도 대상 판정 기준</li><li>재시도 횟수와 간격</li><li>CSV 내보내기 및 수신자 목록 보존 기간</li></ul>',
    adminMemo: '발송 이력 페이지 오픈 이슈를 정책 관리에서 추적하도록 추가한 후보 문서입니다.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 10:36',
    updatedBy: 'admin_kim'
  },
  {
    id: 'POL-015',
    category: '관리자/보안',
    policyType: '관리자 권한 변경 정책',
    title: '관리자 권한 변경 정책',
    versionLabel: 'v2026.03-draft',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['관리자 콘솔'],
    requiresConsent: false,
    trackingStatus: '문서 추적',
    relatedAdminPages: ['System > 권한 관리', 'System > 관리자 계정', 'System > 감사 로그'],
    sourceDocuments: [
      'docs/specs/page-ia/system-permissions-page-ia.md',
      'docs/specs/admin-page-gap-register.md',
      'src/features/system/pages/system-permissions-page.tsx'
    ],
    summary:
      '권한 부여, 수정, 회수의 사유 입력, 감사 추적, 승인 체계 미확정 항목을 함께 관리하는 내부 정책입니다.',
    legalReferences: ['권한 관리 상세 IA', '내부 보안 운영 지침 초안'],
    bodyHtml:
      '<h2>관리자 권한 변경 정책</h2><p>권한 변경은 대상 관리자, 변경 권한, 사유, 수행자를 함께 기록하고 감사 로그에서 역추적할 수 있어야 합니다.</p><ul><li>권한 회수는 확인 단계와 사유 입력 필수</li><li>고위험 권한의 2인 승인 여부는 후속 확정 필요</li><li>역할 템플릿과 개별 permission 편집 정책을 함께 검토</li></ul>',
    adminMemo: '현재 화면은 actor 하드코딩과 승인 체계 미확정이 남아 있어 문서 추적 상태로 관리합니다.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 10:42',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-016',
    category: '메시지/알림',
    policyType: '마케팅 정보 수신 동의',
    title: '마케팅 정보 수신 동의',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-20',
    exposureSurfaces: ['회원가입', '마이페이지', '앱 설정', '관리자 콘솔'],
    requiresConsent: true,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Message > 메일', 'Message > 푸시', 'Users > 회원 상세'],
    sourceDocuments: [
      'docs/specs/page-ia/message-mail-page-ia.md',
      'docs/specs/page-ia/message-push-page-ia.md',
      'docs/specs/admin-data-usage-map.md'
    ],
    summary:
      '프로모션 메일/푸시 발송을 위한 수신 동의 항목과 철회 방법을 정리한 사용자 동의 문서입니다.',
    legalReferences: ['정보통신망 이용촉진 및 정보보호 등에 관한 법률'],
    bodyHtml:
      '<h2>마케팅 정보 수신 동의</h2><p>회원은 메일, 앱 푸시, 문자 수신 동의를 선택적으로 설정할 수 있으며 언제든지 철회할 수 있습니다.</p><ul><li>회원가입/마이페이지/앱 설정 노출</li><li>메일/푸시 운영 정책과 함께 검수</li></ul>',
    adminMemo: '메일/푸시 템플릿 운영과 수신 거부 처리의 기준 동의 문서입니다.',
    status: '게시',
    createdAt: '2026-03-18',
    updatedAt: '2026-03-20 09:30',
    updatedBy: 'admin_park'
  }
] as SeedOperationPolicy[]).map(createSeedPolicy);

const mockOperationPolicyHistories: OperationPolicyHistoryEntry[] = mockOperationPolicies.map((policy, index) =>
  createPolicyHistoryEntry(
    policy,
    'created',
    '초기 정책 스냅샷 등록',
    `PH-${String(index + 1).padStart(4, '0')}`
  )
);


function clonePolicy(policy: OperationPolicy): OperationPolicy {
  return clonePolicySnapshot(policy);
}

function clonePolicyHistory(entry: OperationPolicyHistoryEntry): OperationPolicyHistoryEntry {
  return {
    ...entry,
    snapshot: clonePolicySnapshot(entry.snapshot)
  };
}

export function createInitialOperationPolicies(): OperationPolicy[] {
  return mockOperationPolicies.map(clonePolicy);
}

export function createInitialOperationPolicyHistories(): OperationPolicyHistoryEntry[] {
  return mockOperationPolicyHistories.map(clonePolicyHistory);
}
