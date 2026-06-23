// Poll the v13 dev server, then POST the REAL worker route with the worker secret.
// The committed worker code resolves the pending attempt, sends via Daou SMTP,
// and marks it 'sent'. Then verify the DB row.
import { runSql } from './db.mjs';

const URL = 'http://localhost:3210/api/notifications/dispatch-email';
const SECRET = 'e2e-worker-secret-topik';
const ATTEMPT = '0bc94558-0d0c-4a68-8274-2e0495d7a6a9';

let resp = null;
for (let i = 0; i < 45; i++) {
  try {
    const r = await fetch(URL, { method: 'POST', headers: { 'x-worker-secret': SECRET } });
    const text = await r.text();
    resp = { status: r.status, text };
    break;
  } catch {
    await new Promise((res) => setTimeout(res, 2000));
  }
}
console.log('WORKER ROUTE response:', JSON.stringify(resp));

console.log('attempt after worker:', JSON.stringify(await runSql(
  `select status, provider_message_id, error_code, error_message from public.notification_delivery_attempts where id='${ATTEMPT}';`,
)));
