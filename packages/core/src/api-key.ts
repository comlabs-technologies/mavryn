import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const API_KEY_SCOPES = ["read", "write", "admin"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

const LIVE_PREFIX = "cm_live_";

export interface GeneratedApiKey {
  /** Shown to the user exactly once. Never persisted. */
  key: string;
  /** SHA-256 of `key`, stored in ApiKey.keyHash. */
  keyHash: string;
  /** Display fragment stored in ApiKey.prefix, e.g. "cm_live_3f9a2b1c". */
  prefix: string;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function generateApiKey(): GeneratedApiKey {
  const key = `${LIVE_PREFIX}${randomBytes(24).toString("hex")}`;
  return { key, keyHash: hashApiKey(key), prefix: key.slice(0, LIVE_PREFIX.length + 8) };
}

/** Constant-time comparison of two hex digests. */
export function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Pull the key out of a request. `Authorization: Bearer cm_live_...` is the
 * documented form; `?api_key=` exists so a `<script>` embed on a static site
 * can read published content without a proxy.
 */
export function extractApiKey(headers: Headers, url: URL): string | null {
  const auth = headers.get("authorization");
  if (auth) {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (match?.[1]) return match[1].trim();
  }
  const header = headers.get("x-api-key");
  if (header) return header.trim();
  return url.searchParams.get("api_key");
}

/** `admin` implies `write`, `write` implies `read`. */
export function hasScope(granted: readonly string[], needed: ApiKeyScope): boolean {
  if (granted.includes("admin")) return true;
  if (needed === "read") return granted.includes("read") || granted.includes("write");
  if (needed === "write") return granted.includes("write");
  return false;
}
