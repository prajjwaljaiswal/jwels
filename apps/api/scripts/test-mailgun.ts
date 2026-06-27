import 'dotenv/config';
import { sendWelcomeEmail } from '../src/lib/email';

const TO = process.argv[2] || 'jaiswalprajjwal486@gmail.com';

async function main() {
  console.log('[test-mailgun] MAILGUN_DOMAIN =', process.env.MAILGUN_DOMAIN || '(unset)');
  console.log('[test-mailgun] MAILGUN_FROM   =', process.env.MAILGUN_FROM || '(unset)');
  console.log('[test-mailgun] API key set    =', !!process.env.MAILGUN_API_KEY);
  console.log(`[test-mailgun] Sending welcome email to ${TO} ...`);
  await sendWelcomeEmail(TO, { name: 'Prajjwal', role: 'CUSTOMER' });
  console.log('[test-mailgun] ✅ Mailgun accepted the message (no error thrown).');
}

main().catch((e) => {
  console.error('[test-mailgun] ❌ FAILED:', e?.status ?? '', e?.message ?? e);
  if (e?.details) console.error('[test-mailgun] details:', e.details);
  process.exit(1);
});
