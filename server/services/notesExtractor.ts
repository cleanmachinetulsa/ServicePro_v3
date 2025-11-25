/**
 * Generates human-friendly notes from conversation state.
 * Pulls from:
 * - keywords
 * - vehicle condition descriptions
 * - special instructions
 */
export function extractNotesFromConversationState(state: any): string | null {
  if (!state) return null;

  const notes: string[] = [];

  // 1. Special requests / problem areas
  if (state.specialRequests) {
    notes.push(`Special request: ${state.specialRequests}`);
  }

  // 2. Pet hair detection keywords
  if (state.service && /pet hair|dog hair|cat hair/i.test(state.service)) {
    notes.push('Customer mentioned pet hair cleanup.');
  }

  // 3. Spill/stain keywords
  if (state.service && /spill|stain|vomit|coffee|juice|milk/i.test(state.service)) {
    notes.push('Customer described spill or stain needing extra attention.');
  }

  // 4. Odor / smell
  if (state.service && /odor|smell|funky|mildew|cigarette|smoke/i.test(state.service)) {
    notes.push('Customer mentioned interior odor/smell.');
  }

  // 5. Time constraints
  if (state.timeConstraints) {
    notes.push(`Time constraints: ${state.timeConstraints}`);
  }

  // 6. Vehicle-specific descriptions (AI V2 supports nested vehicle info)
  if (state.vehicles?.length) {
    const v = state.vehicles[0];
    if (v.condition) {
      notes.push(`Vehicle condition: ${v.condition}`);
    }
    if (v.notes) {
      notes.push(`Vehicle notes: ${v.notes}`);
    }
  }

  // Final output
  if (!notes.length) return null;

  return notes.join(' ');
}
