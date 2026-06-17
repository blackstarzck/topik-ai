-- down: Operation FAQ admin RPC + tables removal
drop function if exists public.admin_delete_operation_faq_curation(text, text);
drop function if exists public.admin_save_operation_faq_curation(text, jsonb, text);
drop function if exists public.admin_delete_operation_faq(text, text);
drop function if exists public.admin_toggle_operation_faq_status(text, text, text);
drop function if exists public.admin_save_operation_faq(text, jsonb, text);
drop table if exists public.operation_faq_metrics;
drop table if exists public.operation_faq_curations;
drop table if exists public.operation_faqs;
