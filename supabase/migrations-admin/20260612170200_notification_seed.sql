-- =====================================================================
-- topik-ai admin · 알림 기능 WP0-5 · admin-0003
-- 초기 템플릿 seed — contract §3의 7개 template_key × 채널 변형 10행.
-- in_app 변형은 active(1차 출시 채널), email 변형은 draft(transport 전),
-- marketing은 email 전용 draft. on conflict do nothing — idempotent.
-- down: supabase/migrations-admin/down/20260612170200_notification_seed.sql
-- =====================================================================

insert into public.notification_templates
  (template_key, channel, class, mandatory, mode, category, name, summary, subject, body_html, variables, trigger_key, status)
values
  ('study_reminder', 'in_app', 'learning', false, 'auto', 'study',
   '학습 리마인더 (인앱)', '사용자 지정 시간·요일 학습 리마인더',
   '오늘의 학습 시간이에요',
   '<p>{{display_name}}님, 오늘의 TOPIK 쓰기 연습 시간이에요. 이어서 학습을 시작해 보세요.</p>',
   '["display_name"]'::jsonb, 'study_reminder_slot', 'active'),
  ('study_reminder', 'email', 'learning', false, 'auto', 'study',
   '학습 리마인더 (이메일)', '사용자 지정 시간·요일 학습 리마인더',
   '[Talkpik] 오늘의 학습 시간이에요',
   '<p>{{display_name}}님, 오늘의 TOPIK 쓰기 연습 시간이에요.</p>',
   '["display_name"]'::jsonb, 'study_reminder_slot', 'draft'),
  ('weekly_summary', 'in_app', 'learning', false, 'auto', 'study',
   '주간 학습 요약 (인앱)', '주 1회 학습 성과 요약',
   '이번 주 학습 요약이 도착했어요',
   '<p>{{display_name}}님의 이번 주 학습 요약이 준비됐어요. 성장 대시보드에서 확인해 보세요.</p>',
   '["display_name"]'::jsonb, 'weekly_summary_slot', 'active'),
  ('weekly_summary', 'email', 'learning', false, 'auto', 'study',
   '주간 학습 요약 (이메일)', '주 1회 학습 성과 요약',
   '[Talkpik] 이번 주 학습 요약',
   '<p>{{display_name}}님의 이번 주 학습 요약입니다.</p>',
   '["display_name"]'::jsonb, 'weekly_summary_slot', 'draft'),
  ('feedback_ready', 'in_app', 'transactional', false, 'auto', 'study',
   'AI 첨삭 완료 (인앱)', '첨삭 완료 시 즉시 알림',
   'AI 첨삭이 완료됐어요',
   '<p>{{display_name}}님이 제출한 답안의 AI 첨삭이 완료됐어요. 지금 확인해 보세요.</p>',
   '["display_name"]'::jsonb, 'feedback_ready', 'active'),
  ('feedback_ready', 'email', 'transactional', false, 'auto', 'study',
   'AI 첨삭 완료 (이메일)', '첨삭 완료 시 즉시 알림',
   '[Talkpik] AI 첨삭이 완료됐어요',
   '<p>{{display_name}}님이 제출한 답안의 AI 첨삭이 완료됐어요.</p>',
   '["display_name"]'::jsonb, 'feedback_ready', 'draft'),
  ('exam_schedule', 'in_app', 'operational', false, 'manual', 'exam_schedule',
   '시험 일정 안내 (인앱)', 'TOPIK 시험 일정·중요 변경 안내',
   'TOPIK 시험 일정 안내',
   '<p>다가오는 TOPIK 시험 일정을 확인하세요.</p>',
   '[]'::jsonb, null, 'active'),
  ('notice', 'in_app', 'operational', false, 'manual', 'notice',
   '공지사항 (인앱)', '서비스 운영 공지',
   '새로운 공지사항이 있어요',
   '<p>서비스 공지사항을 확인해 주세요.</p>',
   '[]'::jsonb, null, 'active'),
  ('event', 'in_app', 'operational', false, 'manual', 'event',
   '이벤트 안내 (인앱)', '이벤트 시작/종료 안내',
   '새로운 이벤트가 시작됐어요',
   '<p>진행 중인 이벤트를 확인해 보세요.</p>',
   '[]'::jsonb, null, 'active'),
  ('marketing', 'email', 'marketing', false, 'manual', 'marketing',
   '마케팅 (이메일)', '프로모션/마케팅 발송 (수신 동의자 한정)',
   '[Talkpik] 특별한 소식을 전해드려요',
   '<p>{{display_name}}님을 위한 소식입니다.</p>',
   '["display_name"]'::jsonb, null, 'draft')
on conflict (template_key, channel) do nothing;
