import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { sanitizedBaseEnv } from './account-context.mjs';

// 세션 도구의 최하위 계층 — 분해로 session-lifecycle.mjs 에서 이동(동작 동일).
// 분류 상수·명령 실행·경로/시간/이름 유틸·JSON 입출력만 담고, 다른 세션 모듈을
// import 하지 않는다(core → git → manifest → audit → cleanup 단방향 계층).

export const CLASSIFICATIONS = Object.freeze([
  'DETACHED_PROBE',
  'ACTIVE',
  'MERGED_CLEANUP',
  'RETENTION_HOLD',
  'RETRY_PENDING',
  'ORPHAN_REVIEW',
  'DIRTY_BLOCKED',
  'SAFE_QUARANTINE',
  'FOREIGN_REPO',
  'RECOVERY_REQUIRED',
  'MAIN_HISTORY_DRIFT'
]);

export const RETENTION_DAYS = 7;

export const STRICT_CLASSIFICATIONS = new Set([
  'MERGED_CLEANUP',
  'RETRY_PENDING',
  'ORPHAN_REVIEW',
  'DIRTY_BLOCKED',
  'SAFE_QUARANTINE',
  'RECOVERY_REQUIRED',
  'MAIN_HISTORY_DRIFT'
]);

export const GENERATED_DIRECTORY_NAMES = new Set(['.omx', '.vite', 'log', 'logs']);
export const SOURCE_DIRECTORY_NAMES = new Set(['api', 'app', 'docs', 'public', 'scripts', 'src', 'supabase', 'tests']);
export const SOURCE_FILE_NAMES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'vite.config.ts',
  'next.config.js',
  'next.config.mjs',
  'tsconfig.json'
]);
export const SOURCE_EXTENSIONS = new Set([
  '.cjs', '.css', '.go', '.html', '.java', '.js', '.jsx', '.mjs', '.php', '.py', '.rb',
  '.rs', '.scss', '.sql', '.svelte', '.swift', '.ts', '.tsx', '.vue'
]);

export function defaultStateRoot() {
  return process.env.AGENT_SESSION_ROOT || join(homedir(), '.agent-sessions', 'topik-ai');
}

export function defaultCodexWorktreeRoot() {
  return process.env.CODEX_WORKTREE_ROOT || join(homedir(), '.codex', 'worktrees');
}

export function defaultRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: {
      ...sanitizedBaseEnv(),
      GIT_TERMINAL_PROMPT: '0',
      GH_PROMPT_DISABLED: '1'
    },
    windowsHide: true
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    const detail = (stderr || stdout).trim();
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})${detail ? `: ${detail}` : ''}`);
  }
  return { status: result.status ?? 1, stdout, stderr };
}

export function git(run, cwd, args, options = {}) {
  return run('git', ['-C', cwd, ...args], options);
}

export function gh(run, args, options = {}) {
  return run('gh', args, options);
}

export function normalizedPath(value) {
  const absolute = resolve(value);
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
}

export function pathsEqual(left, right) {
  return normalizedPath(left) === normalizedPath(right);
}

export function isPathWithin(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function assertDirectChild(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || rel.includes(sep)) {
    throw new Error(`Refusing to mutate path outside the expected direct-child boundary: ${child}`);
  }
}

export function nowIso(clock = () => new Date()) {
  return clock().toISOString();
}

export function timestampForFile(clock = () => new Date()) {
  return nowIso(clock).replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function sanitizeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'session';
}

export function parseOptions(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const [rawName, inlineValue] = token.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      options[rawName] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      options[rawName] = next;
      index += 1;
    } else {
      options[rawName] = true;
    }
  }
  return { positional, options };
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const tempFile = `${file}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`;
  writeFileSync(tempFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  // Windows AV/indexers can hold the destination briefly; bounded retries keep the
  // replace atomic without ever leaving a torn ledger file behind.
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      renameSync(tempFile, file);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  rmSync(tempFile, { force: true });
  throw lastError;
}

export function manifestFiles(stateRoot) {
  if (!existsSync(stateRoot)) return [];
  return readdirSync(stateRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(stateRoot, entry.name));
}
