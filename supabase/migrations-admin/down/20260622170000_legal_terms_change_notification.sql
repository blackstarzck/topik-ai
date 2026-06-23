drop function if exists public.admin_send_terms_change_notification(text);
delete from public.notification_templates where template_key = 'legal_terms_changed';
-- 전체 활성 사용자 그룹은 다른 공지에서도 재사용될 수 있어 보존(수동 정리).
