/**
 * Audit T1 S-10/W-1: Verify the AI token-budget downgrade logic.
 * At >=80% of the per-tenant daily budget the resolver must return
 * model=gpt-4o-mini (status='downgrade'); at >=100% it must return
 * status='exhausted' with the canned reply text from business_settings.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => ({ db: { execute: vi.fn() } }));

import { db } from '../db';
import {
  resolveBudgetDecision,
  _clearBudgetCache,
} from '../services/aiTokenBudget';

const BASE_MODEL = 'gpt-4o';
const TENANT_ID = 'tenant-budget-test';

function makeTenantDb(budget: number, cannedReply = 'Canned reply for tests') {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{
            id: 1,
            aiDailyTokenBudget: budget,
            aiBudgetExhaustedReply: cannedReply,
          }],
        }),
      }),
    }),
  } as any;
}

describe('AI token budget downgrade (Audit T1 S-10/W-1)', () => {
  beforeEach(() => {
    _clearBudgetCache();
    vi.clearAllMocks();
  });

  it('returns base model when usage <80% of budget', async () => {
    (db.execute as any).mockResolvedValue({ rows: [{ tokens: 5_000 }] });
    const d = await resolveBudgetDecision(makeTenantDb(100_000), TENANT_ID, BASE_MODEL);
    expect(d.status).toBe('ok');
    expect(d.model).toBe(BASE_MODEL);
  });

  it('downgrades to gpt-4o-mini at >=80% but <100% of budget', async () => {
    (db.execute as any).mockResolvedValue({ rows: [{ tokens: 80_000 }] });
    const d = await resolveBudgetDecision(makeTenantDb(100_000), TENANT_ID, BASE_MODEL);
    expect(d.status).toBe('downgrade');
    expect(d.model).toBe('gpt-4o-mini');
  });

  it('marks exhausted at >=100% of budget and returns canned reply', async () => {
    (db.execute as any).mockResolvedValue({ rows: [{ tokens: 100_000 }] });
    const d = await resolveBudgetDecision(
      makeTenantDb(100_000, 'We are catching up — back shortly!'),
      TENANT_ID,
      BASE_MODEL,
    );
    expect(d.status).toBe('exhausted');
    expect(d.cannedReply).toBe('We are catching up — back shortly!');
  });

  it('disables enforcement when budget is 0 (unlimited)', async () => {
    (db.execute as any).mockResolvedValue({ rows: [{ tokens: 999_999 }] });
    const d = await resolveBudgetDecision(makeTenantDb(0), TENANT_ID, BASE_MODEL);
    expect(d.status).toBe('ok');
    expect(d.model).toBe(BASE_MODEL);
  });
});
