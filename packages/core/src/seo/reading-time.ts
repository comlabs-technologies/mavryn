import { htmlToText } from "../text";

/** Words per minute used for reading-time estimates. */
export const WORDS_PER_MINUTE = 200;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/u).length;
}

/** Reading time in whole minutes, never below 1 for non-empty content. */
export function readingTimeFromText(text: string): number {
  const words = countWords(text);
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function readingTimeFromHtml(html: string): number {
  return readingTimeFromText(htmlToText(html));
}
