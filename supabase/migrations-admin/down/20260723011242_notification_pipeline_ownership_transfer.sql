-- notification pipeline migration home: topik-ai
--
-- This ownership transfer is intentionally roll-forward only. Removing the shared
-- dispatcher, email configuration, or cron during rollback would interrupt user
-- notifications and could strand existing dispatch/attempt rows. Apply a corrective
-- forward migration instead; this file preserves all objects and data.

do $notification_pipeline_roll_forward_only$
begin
  raise notice 'notification pipeline ownership transfer is roll-forward only; no objects changed';
end
$notification_pipeline_roll_forward_only$;
