-- down: seed 템플릿 제거 (seed가 넣은 (template_key, channel) 조합만)
delete from public.notification_templates
 where (template_key, channel) in (
   ('study_reminder','in_app'), ('study_reminder','email'),
   ('weekly_summary','in_app'), ('weekly_summary','email'),
   ('feedback_ready','in_app'), ('feedback_ready','email'),
   ('exam_schedule','in_app'), ('notice','in_app'), ('event','in_app'),
   ('marketing','email')
 );
