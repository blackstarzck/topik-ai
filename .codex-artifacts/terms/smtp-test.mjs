// Validate Daou Office SMTP (outbound.daouoffice.com:465 SSL) and deliver the
// real terms-change email to bucheongosok@gmail.com. SPF already authorizes
// guest@keduall.com (keduall.com SPF includes _spf.daouoffice.com), so any
// recipient should receive it — no Resend domain verification needed.
import nodemailer from 'nodemailer';
import { runSql } from './db.mjs'; // loads .env.local (SMTP_* + supabase token)

const TO = process.argv[2] || 'bucheongosok@gmail.com';
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://app.talkpik.ai').replace(/\/+$/, '');

const renderName = (s, n) => (s || '').split('{{display_name}}').join(n || '회원');
const appendCta = (html, link) => {
  const p = (link || '').trim();
  if (!p) return html;
  const href = /^https?:\/\//i.test(p) ? p : `${SITE}/${p.replace(/^\/+/, '')}`;
  return `${html}\n<p><a href="${href}">약관 확인 및 동의하기</a></p>`;
};

const tpl = (await runSql(
  `select subject, body_html, link_url from public.notification_templates where template_key='legal_terms_changed' and channel='email' limit 1;`,
))[0];
const subject = renderName(tpl.subject, '회원');
const html = appendCta(renderName(tpl.body_html, '회원'), tpl.link_url);

const port = Number(process.env.SMTP_PORT || 465);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465, // 465 = implicit TLS
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

console.log('verifying SMTP connection to', process.env.SMTP_HOST, port, '...');
await transporter.verify();
console.log('  SMTP connection + auth OK');

const info = await transporter.sendMail({
  from: process.env.SMTP_FROM,
  to: TO,
  subject,
  html,
});
console.log('SENT to', TO);
console.log('  messageId:', info.messageId);
console.log('  response :', info.response);
console.log('  accepted :', JSON.stringify(info.accepted), 'rejected:', JSON.stringify(info.rejected));
