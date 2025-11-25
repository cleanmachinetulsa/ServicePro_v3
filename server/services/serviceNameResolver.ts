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

  // Token-based similarity scoring with proper tie-breaking
  // ALL services go through the same scoring + tie-breaking logic
  const inputTokens = text.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  interface ScoredService {
    service: typeof svcList[0];
    score: number;
    matchRatio: number;
    nameLength: number;
  }
  
  const scoredServices: ScoredService[] = [];
  
  for (const svc of svcList) {
    const svcName = svc.name;
    const svcLower = svcName.toLowerCase();
    const svcTokens = svcLower.split(/\s+/).filter(t => t.length > 2);
    
    let exactMatches = 0;
    let partialMatches = 0;
    
    // Count token overlaps
    for (const inputToken of inputTokens) {
      for (const svcToken of svcTokens) {
        if (inputToken === svcToken) {
          exactMatches++;
        } else if (inputToken.includes(svcToken) || svcToken.includes(inputToken)) {
          partialMatches++;
        }
      }
    }
    
    // Substring bonus: if input is contained in service name or vice versa
    let substringBonus = 0;
    if (svcLower.includes(text) || text.includes(svcLower)) {
      substringBonus = 8; // Strong signal, but still subject to tie-breaking
    }
    
    // Keyword bonus when keyword appears in BOTH input and service name
    const importantKeywords = [
      'interior', 'exterior', 'full', 'detail', 'deep', 'clean',
      'wash', 'basic', 'premium', 'signature', 'complete', 'express'
    ];
    
    let keywordBonus = 0;
    for (const keyword of importantKeywords) {
      if (text.includes(keyword) && svcLower.includes(keyword)) {
        keywordBonus++;
      }
    }
    
    // Calculate final score
    const score = (exactMatches * 10) + (partialMatches * 3) + (keywordBonus * 5) + substringBonus;
    
    // Calculate match ratio: how many input tokens were matched?
    const matchRatio = inputTokens.length > 0 
      ? (exactMatches + partialMatches * 0.5) / inputTokens.length 
      : 0;
    
    if (score > 0) {
      scoredServices.push({
        service: svc,
        score,
        matchRatio,
        nameLength: svcName.length,
      });
    }
  }
  
  if (scoredServices.length === 0) {
    return { id: null, name: null };
  }
  
  // Sort by:
  // 1. Highest score first
  // 2. Highest match ratio (more complete coverage of input)
  // 3. Shortest name (more specific)
  scoredServices.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.matchRatio !== b.matchRatio) return b.matchRatio - a.matchRatio;
    return a.nameLength - b.nameLength;
  });
  
  const best = scoredServices[0];
  
  // Only return if we have a reasonable match
  if (best && best.score > 0) {
    return { id: best.service.id, name: best.service.name };
  }

  // No good match
  return { id: null, name: null };
}
