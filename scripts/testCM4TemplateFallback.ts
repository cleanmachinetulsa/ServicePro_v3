/**
 * CM-4 functional test — template token fallback + residual-artifact sweep.
 *
 * Pure string-manipulation test: no DB connection, no Twilio, no cleanup needed.
 * The rendering functions in portRecoveryService.ts and
 * tenantWelcomeBackCampaignService.ts are private, so this test mirrors their
 * fixed logic inline and verifies the output assertions.
 *
 * ARTIFACT_SENTINEL — the regex that must match zero occurrences in all output:
 *   /\[[A-Z_ ]+\]|\{\{?[a-zA-Z_]+\}?\}/
 * Any surviving [BRACKET TOKEN], {{doubleToken}}, or {singleToken} is a failure.
 *
 * Run: npx tsx scripts/testCM4TemplateFallback.ts
 */

// ── Mirrors of the fixed rendering logic ─────────────────────────────────────

/**
 * portRecoveryService.ts interpolateTemplate (CM-4 fixed version)
 */
function renderPortRecovery(
  template: string,
  customerName: string | null | undefined,
  ctaUrl: string,
  points: number,
  rewardsLink?: string,
): string {
  const firstName = (() => {
    if (!customerName) return '';
    const f = customerName.split(' ')[0];
    return f || '';
  })();
  const firstNameOrFallback = (firstName && firstName !== 'unknown') ? firstName : 'there';
  const customerNameGreeting = customerName ? ` ${customerName}` : '';

  let result = template
    .replace(/\{\{firstNameOrFallback\}\}/g, firstNameOrFallback)
    .replace(/\{\{customerName\}\}/g, customerName || 'Valued Customer')
    .replace(/\{\{customerNameGreeting\}\}/g, customerNameGreeting)
    .replace(/\{\{ctaUrl\}\}/g, ctaUrl)
    .replace(/\{\{bookingUrl\}\}/g, ctaUrl)
    .replace(/\{\{points\}\}/g, points.toString())
    .replace(/\{\{rewardsLink\}\}/gi, rewardsLink ?? '')
    .replace(/\{rewards_link\}/gi, rewardsLink ?? '');

  result = result
    .replace(/\{\{[a-zA-Z][a-zA-Z_]*\}\}/g, '')
    .replace(/\{[a-zA-Z][a-zA-Z_]*\}/g, '');

  return result;
}

/**
 * tenantWelcomeBackCampaignService.ts interpolateTemplate (CM-4 fixed version)
 */
function renderWelcomeBack(
  template: string,
  vars: {
    customerName?: string | null;
    businessName?: string | null;
    bookingLink?: string | null;
    rewardsLink?: string | null;
    qrLink?: string;
    pointsBonus?: number;
  },
): string {
  const customerName = (vars.customerName && vars.customerName.trim())
    ? vars.customerName.trim()
    : 'Valued Customer';
  const businessName = (vars.businessName && vars.businessName.trim())
    ? vars.businessName.trim()
    : 'our team';
  const bookingLink  = vars.bookingLink  ?? '';
  const rewardsLink  = vars.rewardsLink  ?? '';
  const pointsBonusStr = typeof vars.pointsBonus === 'number'
    ? String(vars.pointsBonus)
    : '';

  let result = template;
  result = result.replace(/\{\{customerName\}\}/gi, customerName);
  result = result.replace(/\{name\}/gi, customerName);
  result = result.replace(/\{\{businessName\}\}/gi, businessName);
  result = result.replace(/\{business_name\}/gi, businessName);
  result = result.replace(/\{\{bookingLink\}\}/gi, bookingLink);
  result = result.replace(/\{booking_link\}/gi, bookingLink);
  result = result.replace(/\{\{rewardsLink\}\}/gi, rewardsLink);
  result = result.replace(/\{rewards_link\}/gi, rewardsLink);
  result = result.replace(/\{\{qrLink\}\}/g, vars.qrLink ?? '');
  result = result.replace(/\{qr_link\}/gi, vars.qrLink ?? '');
  result = result.replace(/\{\{pointsBonus\}\}/gi, pointsBonusStr);
  result = result.replace(/\{points_bonus\}/gi, pointsBonusStr);

  result = result
    .replace(/\{\{[a-zA-Z][a-zA-Z_]*\}\}/g, '')
    .replace(/\{[a-zA-Z][a-zA-Z_]*\}/g, '');

  return result;
}

// ── Sentinel and helpers ──────────────────────────────────────────────────────

// Any surviving bracket-token is a failure.
const ARTIFACT_SENTINEL = /\[[A-Z_ ]+\]|\{\{?[a-zA-Z_]+\}?\}/;

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

function noArtifacts(rendered: string, label: string) {
  const match = rendered.match(ARTIFACT_SENTINEL);
  if (match) {
    failCount++;
    console.log(`  FAIL — ${label}: artifact found: "${match[0]}"`);
    console.log(`         in: "${rendered.substring(0, 120)}"`);
  } else {
    passCount++;
    console.log(`  PASS — ${label}: no bracket artifacts`);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n=== CM-4 template fallback + artifact sweep functional test ===\n');

// ── SECTION A: portRecoveryService interpolateTemplate ───────────────────────
console.log('[A] portRecovery interpolateTemplate\n');

// A-1: missing name → clean fallback "Hey there,"
{
  console.log('[A-1] Missing name — {{firstNameOrFallback}} falls back to "there"');
  const tpl = `Hey {{firstNameOrFallback}}, thanks for being a customer! Book here: {{ctaUrl}}`;
  const out = renderPortRecovery(tpl, null, 'https://example.com/book', 500);
  console.log(`  rendered: "${out}"`);
  assert(out.includes('Hey there,'),          'starts with "Hey there,"',   out);
  assert(!out.includes('{{firstNameOrFallback}}'), 'no firstNameOrFallback token');
  noArtifacts(out, 'no artifact (A-1)');
}

// A-2: present name → personalized
{
  console.log('\n[A-2] Present name — personalized correctly');
  const tpl = `Hey {{firstNameOrFallback}}, great to hear from you!`;
  const out = renderPortRecovery(tpl, 'Alice Smith', 'https://example.com/book', 500);
  console.log(`  rendered: "${out}"`);
  assert(out.includes('Hey Alice,'), 'uses first name "Alice"', out);
  noArtifacts(out, 'no artifact (A-2)');
}

// A-3: rewardsLink missing → token removed, not left as {{rewardsLink}}
{
  console.log('\n[A-3] rewardsLink undefined — token stripped to empty');
  const tpl = `Check your rewards: {{rewardsLink}} or {rewards_link}. Book: {{ctaUrl}}`;
  const out = renderPortRecovery(tpl, 'Bob', 'https://example.com/book', 500, undefined);
  console.log(`  rendered: "${out}"`);
  assert(!out.includes('{{rewardsLink}}'), 'no {{rewardsLink}} token',      out);
  assert(!out.includes('{rewards_link}'),  'no {rewards_link} token',       out);
  noArtifacts(out, 'no artifact (A-3)');
}

// A-4: rewardsLink present → substituted
{
  console.log('\n[A-4] rewardsLink present — substituted correctly');
  const tpl = `Rewards: {{rewardsLink}} and also {rewards_link}`;
  const link = 'https://example.com/rewards?token=abc123';
  const out  = renderPortRecovery(tpl, 'Carol', 'https://example.com/book', 500, link);
  console.log(`  rendered: "${out}"`);
  assert(out.includes(link), 'rewardsLink substituted', out);
  assert(out.indexOf(link) !== out.lastIndexOf(link), 'both tokens substituted (appears twice)');
  noArtifacts(out, 'no artifact (A-4)');
}

// A-5: unknown/future token → swept away
{
  console.log('\n[A-5] Unknown token {{unknownFutureField}} — stripped by residual sweep');
  const tpl = `Hello {{firstNameOrFallback}}, your {{unknownFutureField}} is ready.`;
  const out  = renderPortRecovery(tpl, 'Dave', 'https://example.com/book', 500);
  console.log(`  rendered: "${out}"`);
  assert(!out.includes('{{unknownFutureField}}'), 'unknown token stripped', out);
  noArtifacts(out, 'no artifact (A-5)');
}

// A-6: 'unknown' as customerName string → falls back to 'there'
{
  console.log('\n[A-6] customerName === "unknown" string → falls back to "there"');
  const tpl = `Hey {{firstNameOrFallback}},`;
  const out  = renderPortRecovery(tpl, 'unknown', 'https://example.com/book', 500);
  console.log(`  rendered: "${out}"`);
  assert(out.includes('Hey there,'), 'falls back when name is literal "unknown"', out);
  noArtifacts(out, 'no artifact (A-6)');
}

// ── SECTION B: tenantWelcomeBackCampaignService interpolateTemplate ───────────
console.log('\n[B] welcomeBack interpolateTemplate\n');

// B-1: null customerName → 'Valued Customer', no "null" in output
{
  console.log('[B-1] null customerName → "Valued Customer" (no "null" in output)');
  const tpl = `Hey {{customerName}}! We miss you at {{businessName}}!`;
  const out  = renderWelcomeBack(tpl, { customerName: null, businessName: 'Clean Machine', bookingLink: 'https://book.example.com', rewardsLink: 'https://rewards.example.com' });
  console.log(`  rendered: "${out}"`);
  assert(!out.includes('null'),            '"null" not in output', out);
  assert(out.includes('Valued Customer'),  '"Valued Customer" fallback used', out);
  noArtifacts(out, 'no artifact (B-1)');
}

// B-2: present customerName → personalized
{
  console.log('\n[B-2] Present customerName → personalized');
  const tpl = `Hey {{customerName}}! We miss you at {{businessName}}!`;
  const out  = renderWelcomeBack(tpl, { customerName: 'Eve Jones', businessName: 'Clean Machine', bookingLink: 'https://book.example.com', rewardsLink: 'https://rewards.example.com' });
  console.log(`  rendered: "${out}"`);
  assert(out.includes('Eve Jones'),   'name personalized', out);
  assert(out.includes('Clean Machine'), 'business name personalized', out);
  noArtifacts(out, 'no artifact (B-2)');
}

// B-3: null businessName → 'our team', not "null"
{
  console.log('\n[B-3] null businessName → "our team" fallback');
  const tpl = `We miss you at {{businessName}}!`;
  const out  = renderWelcomeBack(tpl, { customerName: 'Frank', businessName: null, bookingLink: 'https://book.example.com', rewardsLink: 'https://rewards.example.com' });
  console.log(`  rendered: "${out}"`);
  assert(!out.includes('null'),       '"null" not in output', out);
  assert(out.includes('our team'),    '"our team" fallback used', out);
  noArtifacts(out, 'no artifact (B-3)');
}

// B-4: pointsBonus not a number → token stripped
{
  console.log('\n[B-4] pointsBonus undefined → {{pointsBonus}} stripped');
  const tpl = `You earned {{pointsBonus}} bonus points!`;
  const out  = renderWelcomeBack(tpl, { customerName: 'Grace', businessName: 'Clean Machine', bookingLink: '', rewardsLink: '', pointsBonus: undefined });
  console.log(`  rendered: "${out}"`);
  assert(!out.includes('{{pointsBonus}}'), '{{pointsBonus}} not in output', out);
  noArtifacts(out, 'no artifact (B-4)');
}

// B-5: pointsBonus present → substituted
{
  console.log('\n[B-5] pointsBonus = 500 → substituted');
  const tpl = `You earned {{pointsBonus}} bonus points!`;
  const out  = renderWelcomeBack(tpl, { customerName: 'Hank', businessName: 'Clean Machine', bookingLink: '', rewardsLink: '', pointsBonus: 500 });
  console.log(`  rendered: "${out}"`);
  assert(out.includes('500'), '"500" present', out);
  noArtifacts(out, 'no artifact (B-5)');
}

// B-6: {name} single-curly variant — also substituted
{
  console.log('\n[B-6] Single-curly {name} variant → substituted');
  const tpl = `Hi {name}, welcome back to {business_name}!`;
  const out  = renderWelcomeBack(tpl, { customerName: 'Iris', businessName: 'Clean Machine', bookingLink: '', rewardsLink: '' });
  console.log(`  rendered: "${out}"`);
  assert(out.includes('Iris'),         '{name} substituted', out);
  assert(out.includes('Clean Machine'), '{business_name} substituted', out);
  noArtifacts(out, 'no artifact (B-6)');
}

// B-7: completely null vars → all clean fallbacks, no coercion artifacts
{
  console.log('\n[B-7] All null/undefined vars → clean fallbacks throughout');
  const tpl = `Hey {{customerName}}! Book at {{bookingLink}}. Rewards: {{rewardsLink}}. {{unknownToken}} Bonus: {{pointsBonus}}`;
  const out  = renderWelcomeBack(tpl, {});
  console.log(`  rendered: "${out}"`);
  assert(!out.includes('null'),       '"null" not in output', out);
  assert(!out.includes('undefined'),  '"undefined" not in output', out);
  noArtifacts(out, 'no artifact (B-7)');
}

// ── SECTION C: sentinel check on the actual default blast template ────────────
console.log('\n[C] Sentinel check on the real default SMS template\n');

{
  console.log('[C-1] DEFAULT_SMS_TEMPLATE with missing name + missing rewardsLink');
  const DEFAULT_SMS_TEMPLATE = `Hey {{firstNameOrFallback}}, it's Jody with Clean Machine Auto Detail. We had a phone system change and may have missed a message from you — I'm really sorry about that. To make it right, I've added 500 reward points to your account good toward protectants or future details. You can check your rewards or book here: {{ctaUrl}} P.S. We now offer digital gift cards – perfect last-minute gifts. Reply STOP to unsubscribe.`;
  const out = renderPortRecovery(DEFAULT_SMS_TEMPLATE, null, 'https://cleanmachinetulsa.com/book', 500, undefined);
  console.log(`  rendered (first 120 chars): "${out.substring(0, 120)}..."`);
  assert(out.startsWith('Hey there,'), 'starts with "Hey there," when name missing');
  assert(out.includes('cleanmachinetulsa.com'), 'ctaUrl substituted');
  noArtifacts(out, 'no artifact in default blast template');
}

{
  console.log('\n[C-2] DEFAULT_VIP_SMS_TEMPLATE from tenantWelcomeBackCampaignService with null name');
  const DEFAULT_VIP_SMS_TEMPLATE = `Hey {{customerName}}! 🎉 We miss you at {{businessName}}!\n\nAs one of our VIP customers, we've added 500 BONUS POINTS to your rewards account!\n\nReady to book?\n📅 {{bookingLink}}\n\nCheck your rewards:\n🏆 {{rewardsLink}}\n\nReply STOP to opt out`;
  const out = renderWelcomeBack(DEFAULT_VIP_SMS_TEMPLATE, {
    customerName: null,
    businessName: 'Clean Machine Auto Detail',
    bookingLink:  'https://cleanmachinetulsa.com/book',
    rewardsLink:  'https://cleanmachinetulsa.com/rewards?token=testtoken',
    pointsBonus:  500,
  });
  console.log(`  rendered (first 120 chars): "${out.substring(0, 120)}..."`);
  assert(out.includes('Valued Customer'),   '"Valued Customer" fallback when name is null');
  assert(out.includes('Clean Machine'),     'business name present');
  assert(out.includes('cleanmachinetulsa'), 'links present');
  noArtifacts(out, 'no artifact in VIP SMS template with null name');
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n=== SUMMARY: ${passCount} passed, ${failCount} failed ===\n`);
process.exit(failCount === 0 ? 0 : 1);
