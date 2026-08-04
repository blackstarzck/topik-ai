import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

const migrationName = '20260801100200_institution_exposure_mode_delete_cleanup.sql';
const upSql = readFileSync(
  join(cwd(), 'supabase', 'migrations-admin', migrationName),
  'utf8'
).replace(/\s+/g, ' ').toLowerCase();
const downSql = readFileSync(
  join(cwd(), 'supabase', 'migrations-admin', 'down', migrationName),
  'utf8'
).replace(/\s+/g, ' ').toLowerCase();

const developmentManifest = JSON.parse(
  readFileSync(
    join(cwd(), 'scripts', 'db', 'manifests', 'admin-development-reconciliation.json'),
    'utf8'
  )
);
const productionManifest = JSON.parse(
  readFileSync(
    join(cwd(), 'scripts', 'db', 'manifests', 'admin-production-cutover.json'),
    'utf8'
  )
);

describe('institution exposure mode deletion lifecycle', () => {
  it('cleans the mode ledger before deleting an institution code and audits the result', () => {
    const modeCleanup = upSql.indexOf(
      'delete from public.topik_writing_institution_exposure_mode where institution_code = $1'
    );
    const codeDelete = upSql.indexOf('delete from public.institution_codes where code = v_code');

    expect(modeCleanup).toBeGreaterThanOrEqual(0);
    expect(codeDelete).toBeGreaterThan(modeCleanup);
    expect(upSql).toContain("'deleted_exposure_mode_count', v_deleted_exposure_mode_count");
    expect(upSql).toContain('institution_exposure_mode_delete_cleanup_not_wired');
  });

  it('serializes mode writes with code deletion on the institution code row', () => {
    const setFunctionStart = upSql.indexOf(
      'create or replace function public.admin_set_institution_exposure_mode'
    );
    const deleteFunctionStart = upSql.indexOf(
      'create or replace function public.admin_delete_institution_code'
    );
    const setFunction = upSql.slice(setFunctionStart, deleteFunctionStart);

    expect(setFunction).toContain(
      'from public.institution_codes c where c.code = v_code for update'
    );
    expect(upSql).toContain('institution_exposure_mode_code_lock_not_wired');
    expect(downSql).toContain(
      'if not exists (select 1 from public.institution_codes c where c.code = v_code)'
    );
  });

  it('keeps rollback scoped to the cleanup without dropping either namespace table', () => {
    expect(downSql).not.toContain(
      'delete from public.topik_writing_institution_exposure_mode where institution_code = $1'
    );
    expect(downSql).not.toContain('drop table');
    expect(downSql).toContain(
      'create or replace function public.admin_delete_institution_code'
    );
  });

  it.each([
    ['development', developmentManifest],
    ['production', productionManifest]
  ])('registers the forward migration in the %s release manifest', (_, manifest) => {
    expect(manifest.expectedLocalCount).toBe(97);
    // 이 마이그는 더 이상 release-all 의 끝이 아니다(20260804100200~400 이 뒤에 붙었다).
    // 끝을 고정하면 뒤에 파일이 붙을 때마다 무관한 테스트가 깨지므로, "릴리스 범위에
    // 포함된다" 는 원래 의도만 남긴다.
    expect(manifest.batches['release-all'].to >= migrationName).toBe(true);
    expect(manifest.batches['institution-exposure-mode-delete-cleanup'].migrations).toEqual([
      migrationName
    ]);
    expect(
      manifest.batches['institution-exposure-mode-delete-cleanup'].expectPresentAfter
    ).toEqual(
      expect.arrayContaining([
        {
          kind: 'function',
          identity: 'public.admin_set_institution_exposure_mode(text,text,text)'
        }
      ])
    );
  });
});
