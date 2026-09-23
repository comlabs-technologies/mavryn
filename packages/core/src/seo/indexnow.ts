import { originOf } from "./canonical.js";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
/** IndexNow accepts at most 10,000 URLs per submission. */
const MAX_URLS = 10_000;

export interface IndexNowInput {
  /** Per-org key from Organization.settings.indexNowKey. */
  key: string;
  /** The tenant's site, e.g. "https://example.com". */
  orgDomain: string;
  urls: string[];
  /** Overridable for tests. */
  fetchImpl?: typeof fetch;
}

export type IndexNowResult =
  | { submitted: true; count: number; status: number }
  | { submitted: false; reason: string };

/**
 * Ping IndexNow so Bing/Yandex/Seznam recrawl straight after a publish.
 *
 * Skipped silently when the org has not configured a key — this is an
 * optimisation, and a missing key must never fail a publish.
 */
export async function submitToIndexNow(input: IndexNowInput): Promise<IndexNowResult> {
  const key = input.key?.trim();
  if (!key) return { submitted: false, reason: "No IndexNow key configured for this organization." };

  const origin = originOf(input.orgDomain);
  if (!origin) return { submitted: false, reason: "Organization has no valid domain configured." };

  const host = new URL(origin).host;
  const urls = [...new Set(input.urls.filter(Boolean))]
    .filter((url) => {
      try {
        return new URL(url).host === host;
      } catch {
        return false;
      }
    })
    .slice(0, MAX_URLS);

  if (urls.length === 0) return { submitted: false, reason: `No URLs on ${host} to submit.` };

  const doFetch = input.fetchImpl ?? fetch;
  const response = await doFetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `${origin}/${key}.txt`,
      urlList: urls,
    }),
  });

  if (!response.ok) {
    return { submitted: false, reason: `IndexNow responded ${response.status} ${response.statusText}.` };
  }
  return { submitted: true, count: urls.length, status: response.status };
}

/** A fresh 32-character hex key, the format IndexNow expects. */
export function generateIndexNowKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
