/**
 * SMS-AUDIT-T1: Minimal Slack notifier for audit-mandated alerts.
 *
 * The codebase did not previously have a generic Slack helper. This module
 * intentionally stays small and dependency-free: it POSTs to the
 * SLACK_WEBHOOK_URL incoming-webhook endpoint when one is configured and
 * silently degrades to a console log when it is not. It MUST NOT throw.
 *
 * Two callsites are wired today:
 *   1. server/index.ts -- production boot warning when PLATFORM_BG_JOBS_ENABLED=0
 *   2. server/services/smsConsentKeywords.ts -- TCPA START re-opt-in
 */

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

export async function notifySlackAudit(text: string, context?: Record<string, unknown>): Promise<void> {
  const enriched = context && Object.keys(context).length > 0
    ? `${text}\n\`\`\`${JSON.stringify(context, null, 2)}\`\`\``
    : text;

  // Always log so the signal is visible even without Slack configured.
  console.log(`[SLACK_AUDIT] ${text}${context ? ' ' + JSON.stringify(context) : ''}`);

  if (!WEBHOOK_URL) return;

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 3000);
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: enriched }),
      signal: ctrl.signal,
    }).catch(() => undefined);
    clearTimeout(timeout);
  } catch {
    // Non-blocking; never throw from an audit notifier.
  }
}
