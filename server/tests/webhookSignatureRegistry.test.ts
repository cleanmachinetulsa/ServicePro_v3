/**
 * Webhook signature registry test.
 *
 * Asserts that every non-Twilio inbound webhook route in this codebase has a
 * provider-specific signature verifier wired up, that production missing/invalid
 * signatures fail-closed via rejectIfProduction (→ HTTP 401), and that the
 * inventory below stays in sync with the actual mounted routes.
 *
 * Twilio webhooks are out of scope here — they're verified by
 * verifyTwilioSignature in server/twilioSignatureMiddleware.ts and covered by
 * Task #15.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

interface WebhookEntry {
  provider: 'stripe' | 'facebook' | 'sendgrid';
  routeFile: string;
  /** Source-level evidence the verifier is wired in. */
  expectStrings: string[];
}

const REGISTRY: WebhookEntry[] = [
  {
    provider: 'stripe',
    routeFile: 'server/routes.stripeWebhooks.ts',
    expectStrings: [
      "router.post('/api/webhooks/stripe'",
      'stripe.webhooks.constructEvent',
      "rejectIfProduction(res, { provider: 'stripe'",
    ],
  },
  {
    provider: 'facebook',
    routeFile: 'server/routes.facebook.ts',
    expectStrings: [
      "router.post('/webhook', verifyFacebookSignature",
      'x-hub-signature-256',
      'crypto.timingSafeEqual',
      "rejectIfProduction(res, { provider: 'facebook'",
    ],
  },
  {
    provider: 'sendgrid',
    routeFile: 'server/routes.sendgridWebhook.ts',
    expectStrings: [
      "router.post('/api/webhooks/sendgrid'",
      "createVerify('sha256')",
      "rejectIfProduction(res, result.fail)",
    ],
  },
];

function readFile(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('non-Twilio webhook signature verification registry', () => {
  for (const entry of REGISTRY) {
    it(`${entry.provider} webhook (${entry.routeFile}) has signature verification wired up`, () => {
      const src = readFile(entry.routeFile);
      for (const needle of entry.expectStrings) {
        expect(src, `${entry.provider}: missing required marker "${needle}"`).toContain(needle);
      }
    });
  }

  it('Stripe webhook is mounted with raw body parser BEFORE express.json()', () => {
    const src = readFile('server/index.ts');
    const rawIdx = src.indexOf("'/api/webhooks/stripe', express.raw");
    const jsonIdx = src.indexOf('app.use(express.json(');
    expect(rawIdx, 'raw body for /api/webhooks/stripe must be mounted').toBeGreaterThan(0);
    expect(jsonIdx, 'express.json must be mounted').toBeGreaterThan(0);
    expect(rawIdx, 'raw body must come before express.json').toBeLessThan(jsonIdx);
  });

  it('express.json verify hook captures rawBody for webhook URLs', () => {
    const src = readFile('server/index.ts');
    expect(src).toContain('req.rawBody = buf');
    expect(src).toContain('/api/facebook/webhook');
    expect(src).toContain('/api/webhooks/');
  });

  it('webhook verifier policy returns 401 in production for any failure', () => {
    const src = readFile('server/services/webhookVerifierPolicy.ts');
    expect(src).toContain('res.status(401)');
    expect(src).toContain("'webhook_signature_invalid'");
    expect(src).toContain("process.env.NODE_ENV === 'production'");
  });

  it('discovers no other inbound webhook POST routes outside the registry (drift guard)', () => {
    const knownRouteFiles = new Set([
      'server/routes.stripeWebhooks.ts',
      'server/routes.sendgridWebhook.ts',
      'server/routes.facebook.ts',
      // Twilio is out of scope (verified separately via verifyTwilioSignature)
      'server/routes/twilioTestSms.ts',
      'server/twilioSignatureMiddleware.ts',
    ]);
    const serverDir = path.join(process.cwd(), 'server');
    const candidates: string[] = [];
    function walk(dir: string) {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (name === 'tests' || name === 'node_modules') continue;
          walk(full);
        } else if (name.endsWith('.ts')) {
          const src = fs.readFileSync(full, 'utf8');
          // Look for inbound POST handlers whose path mentions "webhook"
          if (/router\.post\([^)]*webhook|app\.post\([^)]*webhook/i.test(src)) {
            const rel = path.relative(process.cwd(), full).replace(/\\/g, '/');
            if (!knownRouteFiles.has(rel)) candidates.push(rel);
          }
        }
      }
    }
    walk(serverDir);
    expect(
      candidates,
      `Unregistered webhook route file(s) found — add to REGISTRY or knownRouteFiles: ${candidates.join(', ')}`
    ).toEqual([]);
  });
});
