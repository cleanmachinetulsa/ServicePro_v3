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

  // Build a combined text from all relevant fields for keyword scanning
  const searchableText = [
    state.service,
    state.specialRequests,
    state.additionalNotes,
    state.customerNotes,
    state.problemDescription,
  ].filter(Boolean).join(' ');

  // 1. Special requests / problem areas (explicit fields)
  if (state.specialRequests) {
    notes.push(`Special request: ${state.specialRequests}`);
  }

  // 2. Additional notes if present
  if (state.additionalNotes) {
    notes.push(state.additionalNotes);
  }

  // 3. Pet hair detection keywords
  if (searchableText && /pet hair|dog hair|cat hair/i.test(searchableText)) {
    notes.push('Customer mentioned pet hair cleanup.');
  }

  // 4. Spill/stain keywords
  if (searchableText && /spill|stain|vomit|coffee|juice|milk/i.test(searchableText)) {
    notes.push('Customer described spill or stain needing extra attention.');
  }

  // 5. Odor / smell
  if (searchableText && /odor|smell|funky|mildew|cigarette|smoke/i.test(searchableText)) {
    notes.push('Customer mentioned interior odor/smell.');
  }

  // 6. Time constraints
  if (state.timeConstraints) {
    notes.push(`Time constraints: ${state.timeConstraints}`);
  }

  // 7. Vehicle-specific descriptions (AI V2 supports nested vehicle info)
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
