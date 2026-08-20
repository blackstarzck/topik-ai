import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';

/**
 * dev 전용 /api 어댑터 — vite dev 서버에서 Vercel 서버 함수(api/**.ts)를 직접 실행한다.
 * vite는 /api/*를 서빙하지 않아 평소엔 SPA fallback(HTML)이 떨어지는데, 이 플러그인이
 * 경로에 맞는 api 파일을 로드해 web Request로 호출하고 Response를 그대로 돌려준다.
 * 프로덕션 빌드엔 영향 없음(apply: 'serve'). 프로덕션은 Vercel 런타임이 동일 함수를 서빙한다.
 *
 * vite는 VITE_ 변수만 import.meta.env에 노출하므로, 서버 함수가 읽는 process.env
 * (API_*, SUPABASE_SERVICE_ROLE_KEY/SECRET_KEY, CRON_SECRET 등)를 .env.local에서 주입한다.
 */
export function parseDotEnvLocal(raw: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const rawLine of raw.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    entries.push([match[1], value]);
  }
  return entries;
}

function loadDotEnvLocalIntoProcessEnv(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const [key, value] of parseDotEnvLocal(readFileSync(envPath, 'utf8'))) {
    if (process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolveBody) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
    req.on('error', () => resolveBody(Buffer.alloc(0)));
  });
}

function localApiPlugin(): Plugin {
  return {
    name: 'local-api-functions',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      loadDotEnvLocalIntoProcessEnv();

      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const rawUrl = req.url ?? '';
        if (!rawUrl.startsWith('/api/')) {
          next();
          return;
        }

        void (async () => {
          try {
            const url = new URL(rawUrl, 'http://localhost');
            const relative = url.pathname.replace(/^\/api\//, '');
            const modulePath = resolve(process.cwd(), 'api', `${relative}.ts`);
            if (!existsSync(modulePath)) {
              next();
              return;
            }

            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers)) {
              if (typeof value === 'string') headers.set(key, value);
              else if (Array.isArray(value)) headers.set(key, value.join(', '));
            }

            const method = (req.method ?? 'GET').toUpperCase();
            const body =
              method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(req);
            const request = new Request(`http://localhost${rawUrl}`, {
              method,
              headers,
              body: body && body.length > 0 ? body : undefined
            });

            const mod = (await server.ssrLoadModule(modulePath)) as {
              default?: { fetch?: (request: Request) => Promise<Response> | Response };
              POST?: (request: Request) => Promise<Response> | Response;
              GET?: (request: Request) => Promise<Response> | Response;
            };

            let response: Response | undefined;
            if (mod.default?.fetch) response = await mod.default.fetch(request);
            else if (method === 'POST' && mod.POST) response = await mod.POST(request);
            else if (method === 'GET' && mod.GET) response = await mod.GET(request);
            if (!response) {
              next();
              return;
            }

            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json');
            res.end(
              JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : 'local_api_error'
              })
            );
          }
        })();
      });
    }
  };
}

/**
 * 번들 분할 — 엔트리 청크(초기 페이로드)에 뭉쳐 있던 vendor 를 배포 간 안정된 청크로 떼어낸다.
 *
 * 판별 규칙이 핵심이다: **엔트리에서 정적 import 로 도달하는 모듈만** 그룹에 넣는다.
 * dynamic import 로만 도달하는 vendor(표 전용 `rc-table`, 날짜 전용 `rc-picker` 등)를
 * 패키지 이름만 보고 그룹에 넣으면 지연 로딩되던 코드가 초기 페이로드로 끌려와
 * 첫 로드가 오히려 커진다. 그래서 이름이 아니라 도달 방식으로 판별한다.
 *
 * 이득은 바이트 감소가 아니라 캐시 수명이다 — 앱 코드만 바뀌는 배포에서
 * vendor 청크 해시가 유지돼 재다운로드가 사라진다.
 */
const VENDOR_REACT_PACKAGES = new Set([
  '@remix-run/router',
  'react',
  'react-dom',
  'react-router',
  'react-router-dom',
  'scheduler'
]);

export function packageNameOfModuleId(moduleId: string): string | undefined {
  const normalized = moduleId.replace(/\\/g, '/');
  const marker = normalized.lastIndexOf('node_modules/');
  if (marker < 0) return undefined;
  const segments = normalized.slice(marker + 'node_modules/'.length).split('/');
  const [first, second] = segments;
  if (!first) return undefined;
  if (!first.startsWith('@')) return first;
  return second ? `${first}/${second}` : undefined;
}

export function vendorChunkOfPackage(packageName: string): string | undefined {
  if (VENDOR_REACT_PACKAGES.has(packageName)) return 'vendor-react';
  if (packageName.startsWith('@supabase/')) return 'vendor-supabase';
  return undefined;
}

type ModuleInfoLookup = (
  moduleId: string
) => { isEntry: boolean; importers: readonly string[] } | null;

/**
 * 엔트리에서 정적 import 만 밟아 도달하는지 판정한다.
 * `true` 는 실제 경로가 증인이라 캐시하고, `false` 는 순환 차단으로 잘린 결과일 수 있어
 * 캐시하지 않는다(다른 경로로 다시 물으면 `true` 가 나올 수 있다).
 */
function createEagerModuleTest(getModuleInfo: ModuleInfoLookup): (moduleId: string) => boolean {
  const eagerIds = new Set<string>();

  const walk = (moduleId: string, visiting: Set<string>): boolean => {
    if (eagerIds.has(moduleId)) return true;
    if (visiting.has(moduleId)) return false;
    const info = getModuleInfo(moduleId);
    if (!info) return false;
    if (info.isEntry) {
      eagerIds.add(moduleId);
      return true;
    }
    visiting.add(moduleId);
    const eager = info.importers.some((importer) => walk(importer, visiting));
    visiting.delete(moduleId);
    if (eager) eagerIds.add(moduleId);
    return eager;
  };

  return (moduleId) => walk(moduleId, new Set());
}

/** 판정 캐시는 빌드(=`getModuleInfo` 인스턴스) 단위로 유지한다. watch 재빌드 간 누수 방지. */
const eagerModuleTests = new WeakMap<ModuleInfoLookup, (moduleId: string) => boolean>();

function eagerModuleTestFor(getModuleInfo: ModuleInfoLookup): (moduleId: string) => boolean {
  const cached = eagerModuleTests.get(getModuleInfo);
  if (cached) return cached;
  const created = createEagerModuleTest(getModuleInfo);
  eagerModuleTests.set(getModuleInfo, created);
  return created;
}

export default defineConfig({
  envPrefix: ['VITE_', 'REACT_APP_'],
  plugins: [react(), localApiPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(moduleId, { getModuleInfo }) {
          const packageName = packageNameOfModuleId(moduleId);
          if (!packageName) return undefined;
          const vendorChunk = vendorChunkOfPackage(packageName);
          if (!vendorChunk) return undefined;
          return eagerModuleTestFor(getModuleInfo)(moduleId) ? vendorChunk : undefined;
        }
      }
    }
  },
  resolve: {
    // tsconfig.app.json paths(`@/*` → `src/*`)와 짝을 이루는 번들러측 alias.
    // vitest 는 vite.config 를 그대로 읽으므로 단위 테스트에도 동일 적용된다.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173
  }
});
