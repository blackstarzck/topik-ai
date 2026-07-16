import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { cwd, execPath } from 'node:process';

import ts from 'typescript';
import { describe, expect, test } from 'vitest';

import {
  chunkItems,
  duplicateQuestionIdsOf,
  promotionQuestionIdsOf
} from '../../api/writing-tasks/ingest.ts';

const root = cwd();
const entryPath = join(root, 'api', 'writing-tasks', 'ingest.ts');
const relativeImportPattern = /from\s+['"](\.[^'"]+)['"]/g;
const compilerOptions = {
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022
};

function outputPath(tempRoot, sourcePath) {
  return join(tempRoot, relative(root, sourcePath)).replace(/\.ts$/, '.js');
}

function transpileInto(tempRoot, sourcePath) {
  const source = readFileSync(sourcePath, 'utf8');
  const destination = outputPath(tempRoot, sourcePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(
    destination,
    ts.transpileModule(source, { compilerOptions, fileName: sourcePath }).outputText,
    'utf8'
  );
  return source;
}

describe('writing task ingest Vercel entrypoint', () => {
  test('uses redacted structured results and fails closed on promotion errors', () => {
    const source = readFileSync(entryPath, 'utf8');

    expect(source).toMatch(/event:\s*["']writing_ingest_result["']/);
    expect(source).toMatch(/error:\s*["']promotion_failed["']/);
    expect(source).toMatch(/error:\s*["']promotion_partial_failure["']/);
    expect(source).toMatch(/error:\s*["']ingest_partial_failure["']/);
    expect(source).not.toContain('promote_error: promoteError.message');
    expect(source).not.toContain('JSON.stringify(promoted)');
    expect(source).not.toContain('text.slice(0, ERROR_SNIPPET_MAX)');
  });

  test('limits promotion to the current fetched payload, including an empty payload', () => {
    expect(
      promotionQuestionIdsOf([
        { source_task_id: 'task-51-a' },
        { source_task_id: 'task-51-a' },
        { source_task_id: 'task-52-b' }
      ])
    ).toEqual(['task-51-a', 'task-52-b']);
    expect(promotionQuestionIdsOf([])).toEqual([]);

    const source = readFileSync(entryPath, 'utf8');
    expect(source).toContain('for (const chunk of chunkItems(payload))');
    expect(source).toContain('for (const questionIdChunk of chunkItems(promotionQuestionIds))');
    expect(source).toContain('p_question_ids: questionIdChunk');
    expect(source).not.toContain('p_question_ids: null');
    expect(source).toMatch(
      /idempotent_skipped:\s*numberField\(value,\s*["']idempotent_skipped["']\)/
    );
  });

  test('chunks ingest and promotion deterministically and rejects duplicate question IDs', () => {
    const items = Array.from({ length: 121 }, (_, index) => index + 1);
    expect(chunkItems(items).map((chunk) => chunk.length)).toEqual([50, 50, 21]);
    expect(chunkItems([])).toEqual([]);
    expect(() => chunkItems(items, 0)).toThrow('chunk size must be a positive integer');

    expect(
      duplicateQuestionIdsOf([
        { source_task_id: 'question-a' },
        { source_task_id: 'question-b' },
        { source_task_id: 'question-a' }
      ])
    ).toEqual(['question-a']);
    expect(duplicateQuestionIdsOf([{ source_task_id: 'question-a' }])).toEqual([]);

    const source = readFileSync(entryPath, 'utf8');
    expect(source.indexOf('for (const chunk of chunkItems(payload))')).toBeLessThan(
      source.indexOf('for (const questionIdChunk of chunkItems(promotionQuestionIds))')
    );
    expect(source).toContain("error: 'upstream_contract_invalid'");
  });

  test('loads after TypeScript emit in the Node ESM runtime', () => {
    const tempRoot = mkdtempSync(join(root, '.tmp-ingest-entrypoint-'));

    try {
      writeFileSync(join(tempRoot, 'package.json'), '{"type":"module"}', 'utf8');
      const entrySource = transpileInto(tempRoot, entryPath);

      for (const match of entrySource.matchAll(relativeImportPattern)) {
        const specifier = match[1];
        const resolved = ts.resolveModuleName(specifier, entryPath, compilerOptions, ts.sys)
          .resolvedModule?.resolvedFileName;

        expect(resolved, `relative import ${specifier} must resolve`).toBeTruthy();
        transpileInto(tempRoot, resolved);
      }

      const result = spawnSync(execPath, [outputPath(tempRoot, entryPath)], {
        cwd: root,
        encoding: 'utf8'
      });

      expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
      expect(result.status, result.stderr).toBe(0);
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });
});
