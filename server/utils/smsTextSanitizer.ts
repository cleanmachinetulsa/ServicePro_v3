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
  // Robust emoji stripping
  return text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}]/gu, "")
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
