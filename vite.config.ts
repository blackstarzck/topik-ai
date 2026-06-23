import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';

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
function loadDotEnvLocalIntoProcessEnv(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1];
    if (process.env[key] !== undefined) continue;
    let value = match[2];
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
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

export default defineConfig({
  envPrefix: ['VITE_', 'REACT_APP_'],
  plugins: [react(), localApiPlugin()],
  server: {
    port: 5173
  }
});
