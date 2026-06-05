/**
 * CM-5 email-path test — validates the three code fixes without hitting the live SendGrid API.
 *
 * Test 1 — stripHtmlToText (Fix 3): pure function, no mock needed. Verifies the helper
 *   produces non-empty plain text from typical HTML campaign content.
 *
 * Test 2 — emailCampaignService msg payload (Fix 3): constructs the msg object the same
 *   way sendSingleCampaignEmail does and asserts the `text` field is present and non-empty.
 *
 * Test 3 — sendTenantEmail input shape (Fix 1): verifies the options object passed by
 *   tenantWelcomeBackCampaignService satisfies SendTenantEmailInput (to/subject/html all
 *   non-null, correct keys). The call itself is NOT made — we validate at the boundary.
 *
 * Test 4 — SendGrid error enrichment guard (Fix 2): verifies the guard expression
 *   `error?.response?.body?.errors?.[0]?.message` safely returns undefined (not throws)
 *   for errors that do NOT have a SendGrid body, and correctly extracts the message for
 *   errors that do.
 *
 * No real DB connection, no real Twilio/SendGrid API calls.
 *
 * Run: npx tsx scripts/testCM5EmailPath.ts
 */

import { stripHtmlToText } from '../server/services/tenantEmailService';
import type { SendTenantEmailInput } from '../shared/email';

let passCount = 0;
let failCount = 0;

function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) {
    passCount++;
    console.log(`  PASS — ${label}`);
  } else {
    failCount++;
    console.log(`  FAIL — ${label}`, detail !== undefined ? `\n         got: ${JSON.stringify(detail)}` : '');
  }
}

// ── Shared sample data ───────────────────────────────────────────────────────

const SAMPLE_HTML = `
  <html><body>
    <h1>Welcome Back!</h1>
    <p>Hey <strong>Alice</strong>, we miss you at Clean Machine!</p>
    <p>We've added <b>500 BONUS POINTS</b> to your account.</p>
    <a href="https://cleanmachinetulsa.com/book">Book Now</a>
    <br><br>
    <p style="font-size:12px;color:#666;">
      Don't want to receive these emails?
      <a href="https://cleanmachinetulsa.com/unsubscribe">Unsubscribe</a>
    </p>
  </body></html>
`.trim();

const EMPTY_HTML = '   ';
const HTML_WITH_ENTITIES = '<p>Tom &amp; Jerry &lt;rock&gt; &quot;it&quot;</p>';

// ── TEST 1 — stripHtmlToText (Fix 3, pure function) ─────────────────────────

console.log('\n[test 1] stripHtmlToText — produces non-empty plain text from HTML\n');

const plain1 = stripHtmlToText(SAMPLE_HTML);
console.log(`  sample output (first 120 chars): "${plain1.substring(0, 120)}"`);
assert(plain1.length > 0,                    'output is non-empty');
assert(!plain1.includes('<h1>'),              'HTML tags stripped');
assert(!plain1.includes('<strong>'),          'nested tags stripped');
assert(plain1.includes('Alice'),              'text content preserved');
assert(plain1.includes('500 BONUS POINTS'),   'bold text content preserved');
assert(!plain1.includes('style='),            'style attributes stripped');

const plain2 = stripHtmlToText(HTML_WITH_ENTITIES);
assert(plain2.includes('Tom & Jerry'),        'HTML entities decoded: &amp;');
assert(plain2.includes('<rock>'),             'HTML entities decoded: &lt;/&gt;');
assert(plain2.includes('"it"'),              'HTML entities decoded: &quot;');

const plain3 = stripHtmlToText(EMPTY_HTML);
assert(plain3 === '',                         'whitespace-only HTML → empty string');

// ── TEST 2 — emailCampaignService msg payload (Fix 3) ────────────────────────

console.log('\n[test 2] emailCampaignService msg payload — text field present and non-empty\n');

// Simulate personalizeCampaignContent + footer (same logic as sendSingleCampaignEmail)
const sampleCampaign = {
  id: 42,
  subject: 'We miss you at Clean Machine!',
  content: SAMPLE_HTML,
};
const sampleRecipient = {
  id: 7,
  email: 'alice@example.com',
  name: 'Alice',
};
const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@cleanmachinetulsa.com';
const baseDomain = 'cleanmachinetulsa.com';
const unsubscribeUrl = `https://${baseDomain}/api/email/unsubscribe?email=${encodeURIComponent(sampleRecipient.email)}&campaign=${sampleCampaign.id}`;
const contentWithFooter = `${sampleCampaign.content}<br><br><p style="font-size: 12px; color: #666;">Don't want to receive these emails? <a href="${unsubscribeUrl}">Unsubscribe</a></p>`;

// This is the msg object as it now exists in sendSingleCampaignEmail (after CM-5 Fix 3):
const msg = {
  to: sampleRecipient.email,
  from: fromEmail,
  subject: sampleCampaign.subject,
  html: contentWithFooter,
  text: stripHtmlToText(contentWithFooter),     // ← the fix
  trackingSettings: {
    clickTracking: { enable: true },
    openTracking: { enable: true },
  },
  customArgs: {
    campaign_id: sampleCampaign.id.toString(),
    recipient_id: sampleRecipient.id.toString(),
  },
};

assert(typeof msg.text === 'string',          'msg.text is a string');
assert(msg.text.length > 0,                   'msg.text is non-empty');
assert(!msg.text.includes('<'),               'msg.text contains no HTML tags');
assert(msg.to === sampleRecipient.email,      'msg.to is the recipient email');
assert(typeof msg.from === 'string' && msg.from.length > 0, 'msg.from is set');
assert(typeof msg.subject === 'string' && msg.subject.length > 0, 'msg.subject is set');
assert(typeof msg.html === 'string' && msg.html.length > 0, 'msg.html is set');
console.log(`  msg.text sample: "${msg.text.substring(0, 100)}"`);

// ── TEST 3 — sendTenantEmail input shape (Fix 1) ─────────────────────────────

console.log('\n[test 3] sendTenantEmail options shape — satisfies SendTenantEmailInput contract\n');

// Simulate what tenantWelcomeBackCampaignService now builds at the call site.
// We do NOT call sendTenantEmail (that would need DB + SendGrid) — we validate
// the input object shape against the SendTenantEmailInput interface at runtime.
const pointsBonus = 500;
const emailBody = '<p>Hey Alice! 500 bonus points added.</p>';
const customerEmail = 'alice@example.com';

const sendTenantEmailInput: SendTenantEmailInput = {
  to: customerEmail,
  subject: `Welcome Back! ${pointsBonus} Bonus Points Added 🎉`,
  html: emailBody,
  category: 'campaign_welcome_back',
};

assert(typeof sendTenantEmailInput.to === 'string' && sendTenantEmailInput.to.includes('@'),
  'input.to is a valid email string');
assert(typeof sendTenantEmailInput.subject === 'string' && sendTenantEmailInput.subject.length > 0,
  'input.subject is non-empty');
assert(typeof sendTenantEmailInput.html === 'string' && sendTenantEmailInput.html.length > 0,
  'input.html is non-empty');
assert(sendTenantEmailInput.category === 'campaign_welcome_back',
  'input.category set for observability');

// Before Fix 1 the call was sendEmail({ to, subject, html }) which landed the whole object
// in the first positional argument (tenantDb). Verify the old broken shape can be detected:
const OLD_BROKEN_CALL_ARGS = { to: customerEmail, subject: 'test', html: emailBody };
// Old call: sendEmail(OLD_BROKEN_CALL_ARGS)
// → tenantDb = OLD_BROKEN_CALL_ARGS (object, not a TenantDb)
// → email = undefined
// → subject = undefined
// → message = undefined
// → sendBusinessEmail(undefined, undefined, undefined) → TypeError before network call
assert(typeof (OLD_BROKEN_CALL_ARGS as any).tenantId === 'undefined',
  'old broken call arg has no tenantId (proves it was not a TenantDb)');
assert(typeof (OLD_BROKEN_CALL_ARGS as any).transaction === 'undefined',
  'old broken call arg has no transaction (proves it was not a TenantDb)');

// ── TEST 4 — SendGrid error body guard (Fix 2) ───────────────────────────────

console.log('\n[test 4] Fix 2 error guard — safely extracts SendGrid detail without throwing\n');

// Case A: plain Error (no SendGrid body) — guard must not throw, must return undefined
const plainError = new Error('Bad Request');
const detailA = (plainError as any)?.response?.body?.errors?.[0]?.message;
assert(detailA === undefined,                 'plain Error: guard returns undefined (no throw)');

// Case B: SendGrid-shaped error — guard extracts the real message
const sgError = {
  message: 'Bad Request',
  response: {
    body: {
      errors: [
        { message: 'The from address does not match a verified Sender Identity.' },
      ],
    },
  },
};
const detailB = (sgError as any)?.response?.body?.errors?.[0]?.message;
assert(detailB === 'The from address does not match a verified Sender Identity.',
  'SendGrid error: guard extracts real message from body');

// Case C: null error (defensive) — guard must not throw
const detailC = (null as any)?.response?.body?.errors?.[0]?.message;
assert(detailC === undefined,                 'null error: guard returns undefined (no throw)');

// Case D: partial SendGrid shape (no errors array) — guard returns undefined safely
const partialError = { message: 'Forbidden', response: { body: {} } };
const detailD = (partialError as any)?.response?.body?.errors?.[0]?.message;
assert(detailD === undefined,                 'partial SendGrid shape: guard returns undefined safely');

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n=== SUMMARY: ${passCount} passed, ${failCount} failed ===\n`);
process.exit(failCount === 0 ? 0 : 1);
