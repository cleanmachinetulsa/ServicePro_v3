import { wrapTenantDb } from '../tenantDb';
import { db } from '../db';
import { services } from '@shared/schema';

/**
 * Performs fuzzy matching between a natural-language service description
 * and the tenant's service list to find the best match.
 *
 * Matching algorithm (simple, fast, robust):
 * 1. Case-insensitive partial match
 * 2. Keyword-based scoring (interior, exterior, full, detail, basic, premium)
 * 3. Falls back to highest keyword score
 * 4. Falls back to null if nothing reasonable matches
 */
export async function resolveServiceFromNaturalText(
  tenantId: string,
  serviceText: string | null
): Promise<{ id: number | null; name: string | null }> {
  if (!serviceText) {
    return { id: null, name: null };
  }

  const text = serviceText.toLowerCase().trim();
  const tenantDb = wrapTenantDb(db, tenantId);

  const svcList = await tenantDb
    .select()
    .from(services);

  if (!svcList.length) {
    return { id: null, name: null };
  }

  // Fast path: direct ILIKE match
  const partial = svcList.find(svc =>
    svc.name.toLowerCase().includes(text)
  );
  if (partial) {
    return { id: partial.id, name: partial.name };
  }

  // Keyword scoring
  const keywords = [
    'interior',
    'exterior',
    'full',
    'detail',
    'deep',
    'clean',
    'wash',
    'basic',
    'premium',
    'signature',
  ];

  const score = (svcName: string) => {
    const lower = svcName.toLowerCase();
    return keywords.reduce((acc, kw) => {
      return acc + (text.includes(kw) || lower.includes(kw) ? 1 : 0);
    }, 0);
  };

  let best = null as any;
  let bestScore = 0;

  for (const svc of svcList) {
    const s = score(svc.name);
    if (s > bestScore) {
      best = svc;
      bestScore = s;
    }
  }

  if (best && bestScore > 0) {
    return { id: best.id, name: best.name };
  }

  // No good match
  return { id: null, name: null };
}
