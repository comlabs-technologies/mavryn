/**
 * Canonical URLs must point back at the tenant's own site. A canonical that
 * points somewhere else tells search engines to index the other site instead,
 * so an off-domain value is rejected rather than silently stored.
 */

export type CanonicalResult =
  | { ok: true; url: string }
  | { ok: false; reason: string };

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

export function originOf(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const withScheme = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

/**
 * Resolve a user-supplied canonical against the org's domain.
 * Relative values ("/blog/foo") are allowed and made absolute.
 */
export function resolveCanonical(
  candidate: string | null | undefined,
  orgDomain: string | null | undefined,
): CanonicalResult {
  const value = candidate?.trim();
  if (!value) return { ok: true, url: "" };

  const origin = originOf(orgDomain);

  let url: URL;
  try {
    url = origin ? new URL(value, origin) : new URL(value);
  } catch {
    return { ok: false, reason: `"${value}" is not a valid URL.` };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: `Canonical URLs must use http or https, got "${url.protocol}".` };
  }

  if (origin) {
    const expected = normalizeHost(new URL(origin).host);
    if (normalizeHost(url.host) !== expected) {
      return {
        ok: false,
        reason: `Canonical URL must stay on ${expected}. Pointing it at ${url.host} would hand indexing to another site.`,
      };
    }
  }

  url.hash = "";
  return { ok: true, url: url.toString() };
}

/** Public URL for a content item on the tenant's site, e.g. https://x.com/blog/slug */
export function contentUrl(
  orgDomain: string | null | undefined,
  typeSlug: string,
  contentSlug: string,
  urlPattern?: string | null,
): string {
  const path = (urlPattern ?? "/:type/:slug")
    .replace(":type", typeSlug)
    .replace(":slug", contentSlug);
  const origin = originOf(orgDomain);
  if (!origin) return path;
  return new URL(path, origin).toString();
}
