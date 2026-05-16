// Audit T3 Task #21: pure helpers for the messages keyboard shortcut layer.
// Extracted so we can unit-test hotkey collision rules (e.g. shortcuts must
// not fire while the user is typing in an input/textarea/contenteditable).

export type HotkeyTarget = Pick<HTMLElement, 'tagName' | 'isContentEditable'> | null;

export function isEditableTarget(target: HotkeyTarget): boolean {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.isContentEditable);
}

export interface HotkeyEventLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  target: HotkeyTarget;
}

// Returns true if this keyboard event should be consumed by the messages
// hotkey layer. Escape is always allowed (so it can close cheatsheets etc.
// even when focus is in an input); everything else is suppressed when
// editing text or when a modifier key is held.
export function shouldHandleHotkey(e: HotkeyEventLike): boolean {
  if (e.key === 'Escape') return true;
  if (isEditableTarget(e.target)) return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  return true;
}
