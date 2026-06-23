// Send the terms-change email to the Resend-allowed test recipient
// (guestkeduall@gmail.com = the account owner) so the rendering can be verified
// now. Resend test mode rejects any other recipient until a domain is verified.
import { runSql } from './db.mjs';

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'onboarding@resend.dev';
const TO = 'guestkeduall@gmail.com';
const SITE = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://app.talkpik.ai').replace(/\/+$/, '');

const renderName = (s, n) => (s || '').split('{{display_name}}').join(n || '회원');
const appendCta = (html, link) => {
  const p = (link || '').trim();
  if (!p) return html;
  const href = /^https?:\/\//i.test(p) ? p : `${SITE}/${p.replace(/^\/+/, '')}`;
  return `${html}\n<p><a href="${href}">약관 확인 및 동의하기</a></p>`;
};

const tpl = (await runSql(`select subject, body_html, link_url from public.notification_templates where template_key='legal_terms_changed' and channel='email' limit 1;`))[0];
const subject = renderName(tpl.subject, '회원');
const html = appendCta(renderName(tpl.body_html, '회원'), tpl.link_url);

const resp = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: FROM, to: TO, subject, html }),
});
console.log('resend HTTP', resp.status, (await resp.text()).slice(0, 240));
console.log('to:', TO, '| from:', FROM, '| cta -> ', `${SITE}/terms-agreement`);
