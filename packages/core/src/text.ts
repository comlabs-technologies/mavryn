/** Shared text utilities used by the SEO engine. Pure, no DOM, no Node APIs. */

const BLOCK_TAGS =
  /<\/?(p|div|section|article|header|footer|h[1-6]|li|ul|ol|br|blockquote|pre|tr|td|th|table|figure|figcaption)\b[^>]*>/gi;

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&hellip;": "…",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|hellip|mdash|ndash|rsquo|lsquo|ldquo|rdquo|#39);/gi, (m) => {
      return HTML_ENTITIES[m.toLowerCase()] ?? HTML_ENTITIES[m] ?? m;
    })
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

/**
 * Flatten HTML to readable plain text. Block-level tags become spaces so that
 * `<p>One</p><p>Two</p>` reads as "One Two" rather than "OneTwo".
 */
export function htmlToText(html: string): string {
  if (!html) return "";
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(BLOCK_TAGS, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Truncate to at most `max` characters without splitting a word. An ellipsis is
 * appended (and counted) whenever text was actually dropped.
 */
export function truncateAtWord(input: string, max: number, ellipsis = "…"): string {
  const text = input.replace(/\s+/g, " ").trim();
  if (max <= 0) return "";
  if (text.length <= max) return text;

  const budget = Math.max(0, max - ellipsis.length);
  const window = text.slice(0, budget + 1);
  const lastSpace = window.lastIndexOf(" ");
  const cut = lastSpace > 0 ? window.slice(0, lastSpace) : window.slice(0, budget);

  return `${cut.replace(/[\s,;:.–—-]+$/u, "")}${ellipsis}`;
}

/** First sentence of a body of text, falling back to the whole string. */
export function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/u);
  return (match?.[0] ?? text).trim();
}
