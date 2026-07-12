/**
 * Scan entry limits shared by the /api/ai routes (server) and the add-words
 * sheet (client). Pure code only: no server or client imports may be added
 * here, or one of the two sides breaks.
 */

export const MAX_SCAN_WORDS = 40;
export const MAX_SCAN_SENTENCES = 20;

/**
 * Distinguishes example sentences from vocabulary items. Items keep up to
 * three tokens so entries like "der Hund, -e" or "sich freuen auf" still
 * count as words; anything longer, or ending like a sentence, does not.
 */
export function isSentence(entry: string): boolean {
  const trimmed = entry.trim();
  const tokens = trimmed.split(/\s+/).length;
  return tokens >= 4 || (tokens >= 2 && /[.!?]$/.test(trimmed));
}
