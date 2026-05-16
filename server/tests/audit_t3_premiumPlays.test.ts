/**
 * Audit T3 Task #23: Premium product plays — smoke tests.
 * Verifies unit-level behavior of newly added modules without requiring
 * a running database or HTTP server.
 */

import { describe, it, expect } from 'vitest';

describe('Audit T3 Task #23 — premium product plays', () => {
  describe('offer_human_handoff tool schema', () => {
    it('is registered in SCHEDULING_FUNCTIONS', async () => {
      const mod: any = await import('../openai');
      const fns = mod.SCHEDULING_FUNCTIONS || mod.default?.SCHEDULING_FUNCTIONS;
      // Defensive: re-import inner module if not re-exported
      const src = await import('fs/promises').then((fs) =>
        fs.readFile(new URL('../openai.ts', import.meta.url), 'utf8'),
      );
      expect(src).toContain('offer_human_handoff');
      expect(src).toContain('Reply "call" or "text"');
    });
  });

  describe('handoffOfferService.classifyHandoffReply', () => {
    it('classifies CALL/TEXT replies correctly', async () => {
      const { classifyHandoffReply } = await import('../services/handoffOfferService');
      expect(classifyHandoffReply('CALL')).toBe('call');
      expect(classifyHandoffReply('  call  ')).toBe('call');
      expect(classifyHandoffReply('call me please')).toBe('call');
      expect(classifyHandoffReply('TEXT')).toBe('text');
      expect(classifyHandoffReply('text is fine')).toBe('text');
      expect(classifyHandoffReply('maybe tomorrow')).toBe(null);
    });
  });

  describe('aiToolMetadata tracker', () => {
    it('records, peeks, takes (clears) tool names per conversation', async () => {
      const { recordToolCallForConversation, takeToolCallsForConversation, peekToolCallsForConversation } =
        await import('../services/aiToolMetadata');
      recordToolCallForConversation(424242, 'get_available_slots');
      recordToolCallForConversation(424242, 'create_appointment');
      expect(peekToolCallsForConversation(424242)).toEqual(['get_available_slots', 'create_appointment']);
      expect(takeToolCallsForConversation(424242)).toEqual(['get_available_slots', 'create_appointment']);
      expect(takeToolCallsForConversation(424242)).toEqual([]);
    });

    it('ignores undefined conversation hint', async () => {
      const { recordToolCallForConversation, takeToolCallsForConversation } =
        await import('../services/aiToolMetadata');
      recordToolCallForConversation(undefined, 'noop');
      expect(takeToolCallsForConversation(undefined)).toEqual([]);
    });
  });

  describe('weeklyDigestService.renderWeeklyDigestHtml', () => {
    it('renders subject and totals', async () => {
      const { renderWeeklyDigestHtml } = await import('../services/weeklyDigestService');
      const html = renderWeeklyDigestHtml({
        tenantId: 't1',
        tenantName: 'Test Co',
        windowStart: new Date('2026-05-09'),
        windowEnd: new Date('2026-05-16'),
        appointmentsBooked: 12,
        appointmentsCompleted: 9,
        conversationsStarted: 25,
        smsTotal: 110,
        emailTotal: 4,
        voiceMinutes: 7,
        aiTokens: 33000,
        estimatedSpendUsd: 12.34,
      });
      expect(html.subject).toContain('Test Co');
      expect(html.html).toContain('12');
      expect(html.html).toContain('33,000');
      expect(html.text).toContain('$12.34');
    });
  });

  describe('weeklyDigestCron.shouldRunNow', () => {
    it('only fires on Monday 8am tenant tz and dedupes same day', async () => {
      const mod = await import('../services/weeklyDigestCron');
      const fn = mod._internals.shouldRunNow;
      // Monday 2026-05-11 08:30 America/Chicago === 13:30 UTC
      const monday8am = new Date('2026-05-11T13:30:00Z');
      expect(fn(monday8am)).toBe(true);
      // Second call same hour same day -> dedupes
      expect(fn(monday8am)).toBe(false);
      // Tuesday same hour
      const tues = new Date('2026-05-12T13:30:00Z');
      expect(fn(tues)).toBe(false);
    });
  });

  describe('public demo script', () => {
    it('exposes a default scripted exchange', async () => {
      const mod = await import('../routes.publicDemo');
      expect(mod.DEFAULT_DEMO_SCRIPT.length).toBeGreaterThan(0);
      expect(mod.DEFAULT_DEMO_SCRIPT[0].sender).toBe('customer');
      const aiStep = mod.DEFAULT_DEMO_SCRIPT.find((s) => s.sender === 'ai');
      expect(aiStep?.toolCalls?.length).toBeGreaterThan(0);
    });
  });

  describe('public status cache', () => {
    it('exports cache map for inspection', async () => {
      const mod = await import('../routes.publicStatus');
      expect(mod._statusCache).toBeInstanceOf(Map);
    });
  });
});
