import type {
  OperationEvent,
  OperationFaq,
  OperationFaqCuration,
  OperationFaqMetric,
  OperationNotice
} from '../model/types';

const mockOperationNotices: OperationNotice[] = [
  {
    id: 'NOTICE-001',
    title: '정기 점검 안내',
    author: 'admin_park',
    createdAt: '2026-03-03',
    status: '게시',
    bodyHtml:
      '<h2>정기 점검 안내</h2><p>2026년 3월 24일 02:00부터 03:30까지 정기 점검을 진행합니다.</p><ul><li>학습 진도 저장은 자동 복구됩니다.</li><li>결제 및 커뮤니티 기능은 점검 시간 동안 일시 중단됩니다.</li></ul>',
    updatedAt: '2026-03-20 09:00',
    updatedBy: 'admin_park'
  },
  {
    id: 'NOTICE-002',
    title: '환불 정책 변경',
    author: 'admin_kim',
    createdAt: '2026-02-21',
    status: '숨김',
    bodyHtml:
      '<h2>환불 정책 변경 안내</h2><p>2026년 4월 1일부터 일부 패키지 상품의 환불 기준이 변경됩니다.</p><p>결제 후 7일 이내, 학습 이력이 없는 경우에 한해 전액 환불이 가능합니다.</p>',
    updatedAt: '2026-03-18 14:20',
    updatedBy: 'admin_kim'
  }
];

const mockOperationFaqs: OperationFaq[] = [
  {
    id: 'FAQ-001',
    question: '결제 오류가 발생하면 어떤 정보를 먼저 확인해야 하나요?',
    answer:
      '결제 ID, 결제 수단, 시도 시각을 확인한 뒤 결제 내역과 시스템 로그를 함께 조회합니다.',
    searchKeywords: ['결제 오류', '결제 실패', '카드 결제'],
    category: '결제',
    status: '공개',
    createdAt: '2026-03-08',
    updatedAt: '2026-03-08 11:20',
    updatedBy: 'admin_park'
  },
  {
    id: 'FAQ-002',
    question: '회원 정지 처리 후 어떤 로그를 확인해야 하나요?',
    answer:
      '회원 상세에서 조치 사유를 기록한 뒤 감사 로그에서 대상 유형, 대상 ID, 수행자를 확인합니다.',
    searchKeywords: ['회원 정지', '계정 정지', '감사 로그'],
    category: '계정',
    status: '공개',
    createdAt: '2026-03-05',
    updatedAt: '2026-03-05 14:10',
    updatedBy: 'admin_kim'
  },
  {
    id: 'FAQ-003',
    question: '메시지 발송 실패 건은 어디서 재시도하나요?',
    answer:
      '메시지 발송 이력 상세 Drawer에서 실패 수신자와 실패 원인을 확인한 뒤 재시도 발송을 실행합니다.',
    searchKeywords: ['메시지 실패', '푸시 실패', '메일 재시도'],
    category: '메시지',
    status: '비공개',
    createdAt: '2026-03-03',
    updatedAt: '2026-03-03 09:40',
    updatedBy: 'admin_kim'
  }
];

const mockOperationFaqCurations: OperationFaqCuration[] = [
  {
    id: 'FAQCUR-001',
    faqId: 'FAQ-001',
    surface: 'help_center',
    curationMode: 'manual',
    displayRank: 1,
    exposureStatus: 'active',
    pinnedStartAt: '2026-03-20',
    pinnedEndAt: null,
    updatedAt: '2026-03-20 10:00',
    updatedBy: 'admin_park'
  },
  {
    id: 'FAQCUR-002',
    faqId: 'FAQ-002',
    surface: 'home_top',
    curationMode: 'manual',
    displayRank: 2,
    exposureStatus: 'active',
    pinnedStartAt: '2026-03-21',
    pinnedEndAt: null,
    updatedAt: '2026-03-21 09:30',
    updatedBy: 'admin_kim'
  },
  {
    id: 'FAQCUR-003',
    faqId: 'FAQ-001',
    surface: 'payment_help',
    curationMode: 'auto',
    displayRank: 1,
    exposureStatus: 'active',
    pinnedStartAt: '2026-03-18',
    pinnedEndAt: null,
    updatedAt: '2026-03-22 15:20',
    updatedBy: 'admin_park'
  }
];

const mockOperationFaqMetrics: OperationFaqMetric[] = [
  {
    faqId: 'FAQ-001',
    viewCount: 842,
    searchHitCount: 214,
    helpfulCount: 122,
    notHelpfulCount: 11,
    lastViewedAt: '2026-03-23 09:10'
  },
  {
    faqId: 'FAQ-002',
    viewCount: 615,
    searchHitCount: 167,
    helpfulCount: 93,
    notHelpfulCount: 14,
    lastViewedAt: '2026-03-23 08:40'
  },
  {
    faqId: 'FAQ-003',
    viewCount: 148,
    searchHitCount: 42,
    helpfulCount: 19,
    notHelpfulCount: 7,
    lastViewedAt: '2026-03-22 18:05'
  }
];

const mockOperationEvents: OperationEvent[] = [
  {
    id: 'EVT-001',
    title: '봄 학습 출석 이벤트',
    summary: '연속 출석 회원에게 포인트를 지급하는 3월 캠페인입니다.',
    bodyHtml:
      '<h2>봄 학습 출석 이벤트</h2><p>3월 한 달 동안 연속 출석을 유지한 회원에게 포인트를 지급합니다.</p><ul><li>7일 연속 출석 시 100P 지급</li><li>14일 연속 출석 시 추가 보너스 지급</li><li>이벤트 탭과 앱 홈 배너에서 상세 조건 확인 가능</li></ul>',
    slug: '봄-학습-출석-이벤트',
    eventType: '출석',
    progressStatus: '진행 중',
    visibilityStatus: '노출',
    startAt: '2026-03-20',
    endAt: '2026-03-31',
    exposureChannels: ['앱 홈', '이벤트 탭'],
    targetGroupId: 'GRP-001',
    targetGroupName: '활성 학습자',
    participantCount: 1280,
    participantLimit: 5000,
    rewardType: '포인트',
    rewardPolicyId: 'POINT-100',
    rewardPolicyName: '출석 7일 누적 100P',
    rewardPolicySummary: '포인트 · 출석 7일 누적 100P',
    messageTemplateId: 'PUSH-MAN-001',
    bannerImages: [
      {
        uid: 'EVT-001-banner-1',
        name: 'attendance-march.png',
        url: 'https://images.example.com/events/attendance-march.png'
      }
    ],
    bannerImageUrl: 'https://images.example.com/events/attendance-march.png',
    bannerImageSourceType: 'file',
    bannerImageFileName: 'attendance-march.png',
    landingUrl: '/events/spring-attendance',
    messageTemplateName: '점검 공지 푸시',
    metaTitle: '봄 학습 출석 이벤트',
    metaDescription: '연속 출석 시 포인트를 지급하는 3월 학습 이벤트를 확인하세요.',
    ogImageUrl: 'https://images.example.com/events/attendance-march-og.png',
    canonicalUrl: '/events/spring-attendance',
    indexingPolicy: 'index',
    adminMemo: '앱 홈 상단 배너와 이벤트 탭 동시 노출',
    createdAt: '2026-03-15',
    updatedAt: '2026-03-22 10:40',
    updatedBy: 'admin_park'
  },
  {
    id: 'EVT-002',
    title: '친구 초대 리워드 캠페인',
    summary: '친구 초대 성공 시 쿠폰을 지급하는 시즌 프로모션입니다.',
    bodyHtml:
      '<h2>친구 초대 리워드 캠페인</h2><p>친구가 초대 링크를 통해 가입하고 첫 학습을 완료하면 쿠폰을 지급합니다.</p><ol><li>친구에게 전용 링크를 공유합니다.</li><li>친구가 가입 후 첫 학습을 완료합니다.</li><li>조건 충족 시 15% 할인 쿠폰이 자동 발급됩니다.</li></ol>',
    slug: '친구-초대-리워드-캠페인',
    eventType: '프로모션',
    progressStatus: '예정',
    visibilityStatus: '예약',
    startAt: '2026-04-01',
    endAt: '2026-04-20',
    exposureChannels: ['웹 홈', '이벤트 탭'],
    targetGroupId: 'GRP-003',
    targetGroupName: 'VIP 고객',
    participantCount: 0,
    participantLimit: 3000,
    rewardType: '쿠폰',
    rewardPolicyId: 'COUPON-APR-15',
    rewardPolicyName: '친구 초대 15% 쿠폰',
    rewardPolicySummary: '쿠폰 · 친구 초대 15% 쿠폰',
    messageTemplateId: 'MAIL-MAN-002',
    bannerImages: [
      {
        uid: 'EVT-002-banner-1',
        name: 'referral-april.png',
        url: 'https://images.example.com/events/referral-april.png'
      }
    ],
    bannerImageUrl: 'https://images.example.com/events/referral-april.png',
    bannerImageSourceType: 'file',
    bannerImageFileName: 'referral-april.png',
    landingUrl: '/events/referral-april',
    messageTemplateName: 'VIP 행사 초대 메일',
    metaTitle: '친구 초대 리워드 캠페인',
    metaDescription: '친구 초대 성공 시 사용할 수 있는 할인 쿠폰 이벤트입니다.',
    ogImageUrl: 'https://images.example.com/events/referral-april-og.png',
    canonicalUrl: '/events/referral-april',
    indexingPolicy: 'index',
    adminMemo: '4월 1일 09:00 자동 노출 예정',
    createdAt: '2026-03-18',
    updatedAt: '2026-03-22 17:10',
    updatedBy: 'admin_kim'
  },
  {
    id: 'EVT-003',
    title: 'TOPIK 응시 챌린지',
    summary: '응시 완료 회원에게 배지를 지급한 시즌 챌린지입니다.',
    bodyHtml:
      '<h2>TOPIK 응시 챌린지</h2><p>TOPIK 응시를 완료한 회원에게 완주 배지를 지급했던 시즌 챌린지입니다.</p><p>현재는 종료되어 신규 참여는 불가하며, 기존 참여 이력과 보상 내역만 보관합니다.</p>',
    slug: 'topik-응시-챌린지',
    eventType: '챌린지',
    progressStatus: '종료',
    visibilityStatus: '숨김',
    startAt: '2026-02-01',
    endAt: '2026-02-28',
    exposureChannels: ['이벤트 탭'],
    targetGroupId: 'GRP-004',
    targetGroupName: '운영 공지 구독자',
    participantCount: 642,
    participantLimit: null,
    rewardType: '배지',
    rewardPolicyId: 'BADGE-TOPIK-001',
    rewardPolicyName: 'TOPIK 챌린지 완주 배지',
    rewardPolicySummary: '배지 · TOPIK 챌린지 완주 배지',
    messageTemplateId: 'PUSH-MAN-002',
    bannerImages: [
      {
        uid: 'EVT-003-banner-1',
        name: 'topik-challenge.png',
        url: 'https://images.example.com/events/topik-challenge.png'
      }
    ],
    bannerImageUrl: 'https://images.example.com/events/topik-challenge.png',
    bannerImageSourceType: 'file',
    bannerImageFileName: 'topik-challenge.png',
    landingUrl: '/events/topik-challenge',
    messageTemplateName: '주말 캠페인 안내',
    metaTitle: 'TOPIK 응시 챌린지',
    metaDescription: 'TOPIK 응시 회원을 위한 시즌 챌린지와 배지 지급 기록입니다.',
    ogImageUrl: 'https://images.example.com/events/topik-challenge-og.png',
    canonicalUrl: '/events/topik-challenge',
    indexingPolicy: 'noindex',
    adminMemo: '종료 후 이력 보관용. 노출 재개 계획 없음.',
    createdAt: '2026-01-25',
    updatedAt: '2026-03-01 08:30',
    updatedBy: 'admin_lee'
  }
];


function cloneNotice(notice: OperationNotice): OperationNotice {
  return { ...notice };
}

function cloneFaq(faq: OperationFaq): OperationFaq {
  return {
    ...faq,
    searchKeywords: [...faq.searchKeywords]
  };
}

function cloneFaqCuration(curation: OperationFaqCuration): OperationFaqCuration {
  return { ...curation };
}

function cloneFaqMetric(metric: OperationFaqMetric): OperationFaqMetric {
  return { ...metric };
}

function cloneEvent(event: OperationEvent): OperationEvent {
  return {
    ...event,
    exposureChannels: [...event.exposureChannels],
    bannerImages: event.bannerImages.map((image) => ({ ...image }))
  };
}

export function createInitialOperationNotices(): OperationNotice[] {
  return mockOperationNotices.map(cloneNotice);
}

export function createInitialOperationFaqs(): OperationFaq[] {
  return mockOperationFaqs.map(cloneFaq);
}

export function createInitialOperationFaqCurations(): OperationFaqCuration[] {
  return mockOperationFaqCurations.map(cloneFaqCuration);
}

export function createInitialOperationFaqMetrics(): OperationFaqMetric[] {
  return mockOperationFaqMetrics.map(cloneFaqMetric);
}

export function createInitialOperationEvents(): OperationEvent[] {
  return mockOperationEvents.map(cloneEvent);
}
