import { describe, it, expect } from 'vitest';

const iMessageReactionPattern =
  /^(Loved|Liked|Emphasized|Laughed at|Disliked|Questioned)\s+["“].+["”][\s.!?]*$/i;

function isTapback(body: string, numMedia: string | number | undefined): boolean {
  const isTextOnly = !numMedia || parseInt(String(numMedia), 10) === 0;
  return isTextOnly && iMessageReactionPattern.test(body.trim());
}

describe('SMS-AUDIT-T1 S-3: iMessage tapback filter', () => {
  it('matches the six standard Apple reactions with ASCII quotes', () => {
    expect(isTapback('Loved "Your appointment is confirmed"', 0)).toBe(true);
    expect(isTapback('Liked "We will see you Saturday"', 0)).toBe(true);
    expect(isTapback('Emphasized "10am works"', 0)).toBe(true);
    expect(isTapback('Laughed at "Ha"', 0)).toBe(true);
    expect(isTapback('Disliked "Sorry that slot is gone"', 0)).toBe(true);
    expect(isTapback('Questioned "Are you available Friday"', 0)).toBe(true);
  });

  it('matches curly/smart quotes that some carriers transliterate', () => {
    expect(isTapback('Loved \u201CYour appointment is confirmed\u201D', 0)).toBe(true);
  });

  it('is case-insensitive on the reaction verb', () => {
    expect(isTapback('LOVED "ok"', 0)).toBe(true);
    expect(isTapback('liked "ok"', 0)).toBe(true);
  });

  it('does NOT match a real customer message that merely starts with a reaction word', () => {
    expect(isTapback('Loved my last detail, can I book again?', 0)).toBe(false);
    expect(isTapback('Liked the service. Thanks!', 0)).toBe(false);
    expect(isTapback('Emphasized that I need it tomorrow', 0)).toBe(false);
  });

  it('does NOT match a reaction-shaped string when an MMS attachment is present', () => {
    // A real customer photo + caption "Loved \"...\"" must not be silently dropped.
    expect(isTapback('Loved "look at this"', 1)).toBe(false);
    expect(isTapback('Loved "look at this"', '2')).toBe(false);
  });

  it('does NOT match unanchored matches in the middle of a message', () => {
    expect(isTapback('Hey - Loved "the job" - thanks!', 0)).toBe(false);
  });

  it('does NOT match a quote without the closing quote character', () => {
    expect(isTapback('Loved "your message', 0)).toBe(false);
  });

  it('tolerates a trailing period or whitespace from some carriers', () => {
    expect(isTapback('Loved "ok".', 0)).toBe(true);
    expect(isTapback('Liked "ok"  ', 0)).toBe(true);
  });
});
