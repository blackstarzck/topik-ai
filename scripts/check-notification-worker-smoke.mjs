import { pathToFileURL } from 'node:url';

export function formatUsage() {
  return [
    'Usage: TOPIK_AI_PRODUCTION_URL=https://... npm run check:notification-worker-smoke',
    'Optional dispatch check: add -- --dispatch with CRON_SECRET and NOTIFICATION_WORKER_SECRET set. This may process pending email attempts.'
  ].join('\n');
}

export function endpointUrl(productionUrl) {
  if (!productionUrl) {
    throw new Error(formatUsage());
  }

  const base = productionUrl.replace(/\/+$/, '');
  const url = new URL(base);
  if (url.protocol !== 'https:') {
    throw new Error('TOPIK_AI_PRODUCTION_URL must be an HTTPS production URL.');
  }
  if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('TOPIK_AI_PRODUCTION_URL must not point to localhost.');
  }
  return `${base}/api/notifications/dispatch-email`;
}

export async function requestWorker({ fetchImpl = fetch, productionUrl, method, headers = {} }) {
  const response = await fetchImpl(endpointUrl(productionUrl), { method, headers });
  return {
    status: response.status,
    ok: response.ok
  };
}

export async function expectStatus(label, promise, expectedStatus) {
  const response = await promise;
  if (response.status !== expectedStatus) {
    throw new Error(`${label} expected ${expectedStatus}, received ${response.status}`);
  }
  return `${label}: ${response.status}`;
}

export async function expectOk(label, promise) {
  const response = await promise;
  if (!response.ok) {
    throw new Error(`${label} expected 2xx, received ${response.status}`);
  }
  return `${label}: ${response.status}`;
}

export async function runNotificationWorkerSmoke({
  args = [],
  env = process.env,
  fetchImpl = fetch
} = {}) {
  const shouldDispatch = new Set(args).has('--dispatch');
  const productionUrl = env.TOPIK_AI_PRODUCTION_URL;
  const cronSecret = env.CRON_SECRET;
  const workerSecret = env.NOTIFICATION_WORKER_SECRET;
  const output = [];

  output.push(
    await expectStatus(
      'unauthenticated GET',
      requestWorker({ fetchImpl, productionUrl, method: 'GET' }),
      401
    )
  );

  if (!shouldDispatch) {
    output.push('Notification worker smoke check passed without dispatch.');
    output.push('Use npm run check:notification-worker-smoke -- --dispatch to verify authenticated cron/manual paths.');
    return output;
  }

  if (!cronSecret || !workerSecret) {
    throw new Error('CRON_SECRET and NOTIFICATION_WORKER_SECRET are required for --dispatch.');
  }

  output.push(
    await expectOk(
      'authenticated cron GET',
      requestWorker({
        fetchImpl,
        productionUrl,
        method: 'GET',
        headers: { Authorization: `Bearer ${cronSecret}` }
      })
    )
  );
  output.push(
    await expectOk(
      'authenticated manual POST',
      requestWorker({
        fetchImpl,
        productionUrl,
        method: 'POST',
        headers: { 'x-worker-secret': workerSecret }
      })
    )
  );
  output.push('Notification worker dispatch smoke check passed.');
  return output;
}

async function main() {
  const output = await runNotificationWorkerSmoke({
    args: process.argv.slice(2),
    env: process.env,
    fetchImpl: fetch
  });
  for (const line of output) {
    console.log(line);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
