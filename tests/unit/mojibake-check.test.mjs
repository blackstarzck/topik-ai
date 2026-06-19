import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateMojibake,
  formatMojibakeReport,
  scanTextForMojibake
} from '../../scripts/check-mojibake.mjs';

let tempDirs = [];

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'topik-ai-mojibake-'));
  tempDirs.push(root);
  return root;
}

function write(root, relativePath, content) {
  const file = join(root, relativePath);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('check-mojibake', () => {
  it('detects replacement characters and common mojibake fragments', () => {
    expect(scanTextForMojibake('broken ??line')).toHaveLength(1);
    expect(scanTextForMojibake('Message > ?꾩룇裕???????page-sync')).toHaveLength(1);
    expect(scanTextForMojibake('Message > 獄쏆뮇??????sync contract')).toHaveLength(1);
    expect(scanTextForMojibake('docs/???뵝-疫꿸퀡???닌뗭겱-??륁뵠筌?揶쎛??諭?md')).toHaveLength(1);
    expect(scanTextForMojibake('Message > 諛쒖넚 ?대젰 sync contract')).toHaveLength(1);
    expect(scanTextForMojibake('docs/?뚮┝-湲곕뒫-援ы쁽-?섏씠利?媛?대뱶.md')).toHaveLength(1);
    expect(scanTextForMojibake('active SOT??DB object')).toHaveLength(0);
  });

  it('scans scripts and tests, not only docs', () => {
    const root = createTempRoot();
    write(root, 'scripts/bad.mjs', "const label = '?꾩룇裕??;\n");
    write(root, 'tests/unit/good.test.mjs', "const label = 'Message history';\n");

    const result = evaluateMojibake({ rootDir: root, scanRoots: ['scripts', 'tests'] });

    expect(result.findings).toEqual([
      {
        filePath: 'scripts/bad.mjs',
        line: 1,
        text: "const label = '?꾩룇裕??;"
      }
    ]);
    expect(formatMojibakeReport(result)).toContain('scripts/bad.mjs:1');
  });
});
