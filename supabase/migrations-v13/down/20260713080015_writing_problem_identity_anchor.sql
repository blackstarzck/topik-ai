-- Interface-only rollback. Identity rows are retained because writing drafts,
-- submissions, library items, recommendations, and metrics may reference them.

drop function if exists private.ensure_writing_problem_anchor(uuid, text, smallint);
