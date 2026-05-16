import { describe, it, expect } from 'vitest';
import { isEditableTarget, shouldHandleHotkey } from './messagesHotkeys';

const mkTarget = (tagName: string, isContentEditable = false) =>
  ({ tagName, isContentEditable } as unknown as HTMLElement);

describe('messagesHotkeys collision rules', () => {
  it('treats input/textarea/select and contenteditable as editable', () => {
    expect(isEditableTarget(mkTarget('INPUT'))).toBe(true);
    expect(isEditableTarget(mkTarget('TEXTAREA'))).toBe(true);
    expect(isEditableTarget(mkTarget('SELECT'))).toBe(true);
    expect(isEditableTarget(mkTarget('DIV', true))).toBe(true);
    expect(isEditableTarget(mkTarget('DIV', false))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it('suppresses shortcuts when typing in the composer', () => {
    expect(shouldHandleHotkey({ key: 'j', target: mkTarget('TEXTAREA') })).toBe(false);
    expect(shouldHandleHotkey({ key: 'r', target: mkTarget('INPUT') })).toBe(false);
    expect(shouldHandleHotkey({ key: '/', target: mkTarget('INPUT') })).toBe(false);
  });

  it('suppresses shortcuts when modifier keys are held', () => {
    expect(shouldHandleHotkey({ key: 'j', target: mkTarget('BODY'), metaKey: true })).toBe(false);
    expect(shouldHandleHotkey({ key: 'k', target: mkTarget('BODY'), ctrlKey: true })).toBe(false);
    expect(shouldHandleHotkey({ key: 'r', target: mkTarget('BODY'), altKey: true })).toBe(false);
  });

  it('always allows Escape, even from an input', () => {
    expect(shouldHandleHotkey({ key: 'Escape', target: mkTarget('INPUT') })).toBe(true);
    expect(shouldHandleHotkey({ key: 'Escape', target: mkTarget('TEXTAREA') })).toBe(true);
    expect(shouldHandleHotkey({ key: 'Escape', target: mkTarget('BODY') })).toBe(true);
  });

  it('allows normal shortcuts on non-editable elements', () => {
    expect(shouldHandleHotkey({ key: 'j', target: mkTarget('BODY') })).toBe(true);
    expect(shouldHandleHotkey({ key: 'k', target: mkTarget('DIV') })).toBe(true);
    expect(shouldHandleHotkey({ key: '?', target: mkTarget('BODY') })).toBe(true);
  });
});
