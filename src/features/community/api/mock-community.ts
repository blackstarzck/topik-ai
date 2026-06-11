import type { CommunityPost, CommunityReport } from '../model/types';

const communityUserNameMap: Record<string, string> = {
  U00001: '\uAE40\uBBFC\uC900',
  U00012: '\uC774\uD558\uC740',
  U00019: '\uC7A5\uB3C4\uC724',
  U00031: '\uAE40\uBBFC\uC900',
  U00047: '\uC870\uD604\uC6B0',
  U00077: '\uC870\uD604\uC6B0'
};

function getCommunityUserName(userId: string, fallbackName?: string): string {
  return communityUserNameMap[userId] ?? fallbackName ?? userId;
}

function getResolvedUserName(userId: string, fallbackName?: string): string {
  return getCommunityUserName(userId, fallbackName);
}

const mockPostPreviewImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F7F4EA"/><stop offset="100%" stop-color="#E0ECFF"/></linearGradient></defs><rect width="960" height="540" rx="36" fill="url(#g)"/><rect x="72" y="88" width="816" height="364" rx="28" fill="#FFFFFF" fill-opacity="0.86"/><text x="96" y="170" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#1D3557">TOPIK 필기 노트 미리보기</text><text x="96" y="240" font-family="Arial, sans-serif" font-size="28" fill="#4A5568">문제 유형별 핵심 포인트와 직전 체크리스트가 정리된 이미지 예시입니다.</text><text x="96" y="320" font-family="Arial, sans-serif" font-size="24" fill="#64748B">관리자 원문 보기 모달에서 이미지와 서식을 그대로 렌더링할 수 있도록 데이터 URI로 구성했습니다.</text></svg>'
)}`;

const initialCommunityPosts: CommunityPost[] = [
  {
    id: 'POST-001',
    title: 'TOPIK 필기 노트 공유',
    content:
      'TOPIK 듣기와 읽기 대비용으로 정리한 필기 노트를 공유합니다.\n문제 유형별 포인트와 자주 틀리는 함정을 표로 정리했고, 시험 직전 체크할 항목도 같이 적어두었습니다.',
    contentHtml: `
      <p>TOPIK 듣기와 읽기 대비용으로 정리한 <strong>필기 노트</strong>를 공유합니다.</p>
      <p>문제 유형별 포인트와 자주 틀리는 함정을 표로 정리했고, 시험 직전 체크할 항목도 같이 적어두었습니다.</p>
      <figure style="margin: 16px 0;">
        <img
          src="${mockPostPreviewImage}"
          alt="TOPIK 필기 노트 미리보기"
          style="display:block;max-width:100%;border-radius:16px;border:1px solid #E5E7EB;"
        />
      </figure>
      <ul>
        <li><strong>듣기</strong>: 보기 선지 함정 패턴 정리</li>
        <li><strong>읽기</strong>: 시간 배분 기준과 오답 포인트 메모</li>
        <li><strong>쓰기</strong>: 자주 쓰는 연결 표현 정리</li>
      </ul>
    `,
    authorName: getCommunityUserName('U00012', 'member_12'),
    authorId: 'U00012',
    board: '자유게시판',
    createdAt: '2026-03-02',
    views: 189,
    comments: 16,
    reports: 0,
    status: '게시',
    adminNotes: [
      {
        id: 'POST-001-MEMO-01',
        title: '정상 게시글 1차 검토',
        type: '기타',
        authorId: 'admin_park',
        authorName: '박수미',
        createdAt: '2026-03-12 09:18:00',
        content: '학습 후기 성격의 정상 게시글입니다. 신고 이력 없이 조회수만 높아 추적 대상에서는 제외합니다.'
      }
    ]
  },
  {
    id: 'POST-002',
    title: '운영 정책 문의',
    content:
      '신고 누적 시 제재 기준이 어떻게 적용되는지 문의드립니다.\n경고 누적 기준과 정지 처리 기준이 공지와 실제 운영에서 동일한지 확인하고 싶습니다.',
    contentHtml: `
      <p>신고 누적 시 제재 기준이 어떻게 적용되는지 문의드립니다.</p>
      <p><strong>경고 누적 기준</strong>과 <strong>정지 처리 기준</strong>이 공지와 실제 운영에서 동일한지 확인하고 싶습니다.</p>
      <blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 4px solid #D1D5DB; background: #F8FAFC;">
        신고 처리 과정에서 참고할 만한 공지 링크가 있으면 같이 안내 부탁드립니다.
      </blockquote>
    `,
    authorName: getCommunityUserName('U00047', 'member_47'),
    authorId: 'U00047',
    board: '질문',
    createdAt: '2026-03-01',
    views: 54,
    comments: 3,
    reports: 3,
    status: '게시',
    adminNotes: [
      {
        id: 'POST-002-MEMO-01',
        title: '댓글 분쟁성 확인 필요',
        type: '욕설/혐오',
        authorId: 'admin_kim',
        authorName: '김혜영',
        createdAt: '2026-03-13 14:06:00',
        content: '신고 사유는 정책 문의 자체보다 댓글로 붙은 분쟁성 응답 때문입니다. 원문은 유지 가능성이 있어 댓글 흐름과 함께 확인이 필요합니다.'
      },
      {
        id: 'POST-002-MEMO-02',
        title: '작성자 재검토 인수인계',
        type: '기타',
        authorId: 'admin_park',
        authorName: '박수미',
        createdAt: '2026-03-14 10:22:00',
        content: '작성자 이력 확인 시 동일 유형 신고가 추가로 1건 있습니다. 즉시 삭제보다는 숨김 후 재검토 쪽이 적절합니다.'
      }
    ]
  },
  {
    id: 'POST-003',
    title: '시험 후기 공유',
    content:
      '최근 TOPIK 시험 후기를 공유합니다.\n듣기 파트는 예상보다 빨랐고, 쓰기 파트는 시간 배분이 가장 중요했습니다.\n실수했던 포인트도 함께 남겨둡니다.',
    contentHtml: `
      <p>최근 TOPIK 시험 후기를 공유합니다.</p>
      <p>듣기 파트는 예상보다 빨랐고, 쓰기 파트는 <strong>시간 배분</strong>이 가장 중요했습니다.</p>
      <p>실수했던 포인트도 함께 남겨둡니다.</p>
      <p><a href="https://example.com/community/post/POST-003" target="_blank" rel="noreferrer">관련 스터디 링크</a>를 함께 올렸습니다.</p>
    `,
    authorName: getCommunityUserName('U00019', 'member_19'),
    authorId: 'U00019',
    board: '후기',
    createdAt: '2026-02-28',
    views: 410,
    comments: 22,
    reports: 1,
    status: '숨김',
    adminNotes: [
      {
        id: 'POST-003-MEMO-01',
        title: '외부 링크 포함 확인',
        type: '광고/홍보',
        authorId: 'admin_lee',
        authorName: '이서준',
        createdAt: '2026-03-10 16:35:00',
        content: '후기 자체는 유익하지만 외부 오픈채팅 링크가 포함돼 있어 우선 숨김 처리했습니다. 링크 제거 후 재게시 가능 여부를 추후 확인합니다.'
      }
    ],
    lastModerationPolicyCode: 'AD',
    lastModerationReason: '외부 오픈채팅 유도 링크가 포함되어 임시 숨김 처리했습니다.',
    lastModeratedAt: '2026-03-10 16:33:51'
  }
];

const initialCommunityReports: CommunityReport[] = [
  {
    id: 'RP-001',
    targetPostId: 'POST-002',
    targetUserId: 'U00047',
    targetUserName: getResolvedUserName('U00047'),
    reporterId: 'U00012',
    reporterName: getResolvedUserName('U00012'),
    reason: '욕설 포함',
    createdAt: '2026-03-03 14:12',
    processStatus: '처리 대기'
  },
  {
    id: 'RP-002',
    targetPostId: 'POST-010',
    targetUserId: 'U00019',
    targetUserName: getResolvedUserName('U00019'),
    reporterId: 'U00031',
    reporterName: getResolvedUserName('U00031'),
    reason: '광고성 게시물',
    createdAt: '2026-03-04 09:31',
    processStatus: '처리 대기'
  },
  {
    id: 'RP-003',
    targetPostId: 'POST-003',
    targetUserId: 'U00077',
    targetUserName: getResolvedUserName('U00077'),
    reporterId: 'U00001',
    reporterName: getResolvedUserName('U00001'),
    reason: '스팸',
    createdAt: '2026-03-04 10:05',
    processStatus: '처리 완료'
  }
];


function cloneCommunityPost(post: CommunityPost): CommunityPost {
  return {
    ...post,
    adminNotes: post.adminNotes.map((note) => ({ ...note }))
  };
}

export function createInitialCommunityPosts(): CommunityPost[] {
  return initialCommunityPosts.map(cloneCommunityPost);
}

export function createInitialCommunityReports(): CommunityReport[] {
  return initialCommunityReports.map((report) => ({ ...report }));
}
