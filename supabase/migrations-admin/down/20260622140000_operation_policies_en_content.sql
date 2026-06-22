-- down: drop the English content columns added for the v13 legal projection.
-- (POL-001 body_html baseline content is intentionally NOT reverted.)
alter table public.operation_policies
  drop column if exists title_en,
  drop column if exists body_html_en,
  drop column if exists summary_en;
