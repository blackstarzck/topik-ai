select p.proname as name, pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
and p.proname in (
 'admin_assign_question_tag','admin_remove_question_tag','admin_update_tag_master_status',
 'admin_update_topik_question','admin_cancel_notification_dispatch','admin_delete_notification_group',
 'admin_delete_notification_template','admin_save_notification_group','admin_save_notification_template',
 'admin_send_notification','admin_set_notification_template_status')
order by p.proname;
