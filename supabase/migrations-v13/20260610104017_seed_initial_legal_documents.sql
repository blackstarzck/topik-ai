-- =====================================================================
-- TALKPIK AI · Google OAuth consent gate support · 2026-06-10
-- Seed initial published placeholder legal documents for auth consent.
--
-- The schema migration 20260608120000 created legal_documents and
-- user_consents, but did not publish any required documents. OAuth users now
-- pass through /auth/consent after callback, so dev/prod need a required
-- terms/privacy baseline per supported locale.
-- =====================================================================

insert into public.legal_documents (
  doc_type,
  version,
  locale,
  title,
  body,
  summary,
  is_placeholder,
  requires_consent,
  status,
  effective_at
)
values
  (
    'terms',
    'placeholder-2026-06-10',
    'ko',
    '이용약관',
    '본 문서는 TALKPIK AI 서비스의 임시 이용약관입니다. 정식 약관은 운영 시작 전 별도 게시되며, 게시 시점에 다시 동의를 요청할 수 있습니다.',
    'TALKPIK AI 이용을 위한 임시 약관입니다.',
    true,
    true,
    'published',
    timestamptz '2026-06-10 00:00:00+09'
  ),
  (
    'privacy',
    'placeholder-2026-06-10',
    'ko',
    '개인정보처리방침',
    '본 문서는 TALKPIK AI의 임시 개인정보 처리 안내입니다. 수집 항목, 이용 목적, 보관 기간은 정식 개인정보처리방침 게시 전까지 현재 구현 범위에 한합니다.',
    'TALKPIK AI 개인정보 처리를 위한 임시 안내입니다.',
    true,
    true,
    'published',
    timestamptz '2026-06-10 00:00:00+09'
  ),
  (
    'terms',
    'placeholder-2026-06-10',
    'en',
    'Terms of Service',
    'This is a provisional terms notice for TALKPIK AI. Formal terms will be published before launch, and users may be asked to consent again at that time.',
    'Provisional terms required to use TALKPIK AI.',
    true,
    true,
    'published',
    timestamptz '2026-06-10 00:00:00+09'
  ),
  (
    'privacy',
    'placeholder-2026-06-10',
    'en',
    'Privacy Policy',
    'This is a provisional privacy notice for TALKPIK AI. Collection, purpose, and retention details are limited to the currently implemented service scope until the formal policy is published.',
    'Provisional privacy notice for TALKPIK AI.',
    true,
    true,
    'published',
    timestamptz '2026-06-10 00:00:00+09'
  ),
  (
    'terms',
    'placeholder-2026-06-10',
    'vi',
    'Điều khoản dịch vụ',
    'Đây là thông báo điều khoản tạm thời cho TALKPIK AI. Điều khoản chính thức sẽ được công bố trước khi ra mắt và người dùng có thể được yêu cầu đồng ý lại khi đó.',
    'Điều khoản tạm thời cần thiết để sử dụng TALKPIK AI.',
    true,
    true,
    'published',
    timestamptz '2026-06-10 00:00:00+09'
  ),
  (
    'privacy',
    'placeholder-2026-06-10',
    'vi',
    'Chính sách bảo mật',
    'Đây là thông báo quyền riêng tư tạm thời cho TALKPIK AI. Các nội dung về thu thập, mục đích sử dụng và lưu giữ dữ liệu chỉ giới hạn trong phạm vi dịch vụ hiện đã triển khai cho đến khi chính sách chính thức được công bố.',
    'Thông báo quyền riêng tư tạm thời cho TALKPIK AI.',
    true,
    true,
    'published',
    timestamptz '2026-06-10 00:00:00+09'
  )
on conflict (doc_type, version, locale) do nothing;
