/**
 * SMS Text Sanitizer
 * R1.6b: Prevents markdown, emojis, and rich text from leaking into SMS.
 */

export function stripMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // Bold
    .replace(/(\*|_)(.*?)\1/g, "$2")    // Italic
    .replace(/`{1,3}.*?`{1,3}/g, "")    // Inline code & code blocks
    .replace(/#+\s+/g, "")               // Headings
    .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Links
    .replace(/>\s+/g, "");               // Blockquotes
}

export function stripEmojis(text: string): string {
  if (!text) return "";
  // Remove Unicode Extended_Pictographic, emoji joiners, and variation selectors
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\uFE0F\u200D]/g, "");
}

export function sanitizeSmsText(text: string): string {
  if (!text) return "";
  let sanitized = text;
  sanitized = stripMarkdown(sanitized);
  sanitized = stripEmojis(sanitized);
  // Collapse excessive whitespace and trim
  return sanitized.replace(/\s+/g, " ").trim();
}
