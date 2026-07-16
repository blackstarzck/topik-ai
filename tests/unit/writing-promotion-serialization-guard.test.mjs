import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

const migrationName = '20260713082500_topik_writing_promotion_serialization_guard.sql';
const sql = readFileSync(join(cwd(), 'supabase', 'migrations', migrationName), 'utf8')
  .replace(/\s+/g, ' ')
  .toLowerCase();
const down = readFileSync(
  join(cwd(), 'supabase', 'migrations', 'down', migrationName),
  'utf8'
)
  .replace(/\s+/g, ' ')
  .toLowerCase();

describe('writing promotion serialization guard', () => {
  it('uses the shared cutover lock and rechecks canonical mode at destructive writes', () => {
    expect(sql).toContain('pg_advisory_xact_lock(731971029691967530::bigint)');
    expect(sql).toContain("private.is_writing_canonical_read_enabled()");
    expect(sql).toContain('canonical_question_replacement_requires_noncanonical_mode');
  });

  it.each([51, 52, 53, 54])('guards Q%s delete/reinsert promotion', (itemNumber) => {
    expect(sql).toContain(`before delete on public.topik_writing_${itemNumber}_questions`);
    expect(down).toContain(`on public.topik_writing_${itemNumber}_questions`);
  });
});
