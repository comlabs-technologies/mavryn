import sanitize from "sanitize-html";
import { originOf } from "./canonical";

export interface SanitizeOptions {
  /** The tenant's own domain. Links to it stay dofollow and same-tab. */
  orgDomain?: string | null;
}

const ALLOWED_TAGS = [
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "span", "div",
];

const ALLOWED_ATTRIBUTES: sanitize.IOptions["allowedAttributes"] = {
  a: ["href", "name", "target", "rel", "title"],
  img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
  th: ["colspan", "rowspan", "scope"],
  td: ["colspan", "rowspan"],
  code: ["class"],
  pre: ["class"],
  span: ["class"],
  div: ["class"],
  p: ["class"],
  h2: ["id"],
  h3: ["id"],
  h4: ["id"],
};

function isSameSite(href: string, orgOrigin: string | null): boolean {
  if (href.startsWith("/") || href.startsWith("#")) return true;
  if (!orgOrigin) return false;
  try {
    const host = new URL(href).host.toLowerCase().replace(/^www\./, "");
    const own = new URL(orgOrigin).host.toLowerCase().replace(/^www\./, "");
    return host === own;
  } catch {
    return false;
  }
}

/**
 * Make author- or model-supplied HTML safe to serve, and fix up its links:
 *
 *  - `<script>`, `<style>`, `<iframe>`, event handlers and `javascript:` URLs are dropped.
 *  - `<meta name="robots" content="noindex">` and friends are removed, so pasted
 *    markup can never de-index the page it lands on.
 *  - Internal links stay dofollow and open in the same tab.
 *  - External links get `rel="nofollow noopener noreferrer"` and `target="_blank"`.
 */
export function sanitizeContentHtml(html: string, options: SanitizeOptions = {}): string {
  if (!html) return "";
  const orgOrigin = originOf(options.orgDomain);

  return sanitize(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowProtocolRelative: false,
    // Anything not in allowedTags is dropped along with its children when it can
    // only carry markup or behaviour rather than prose.
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "embed", "meta", "link"],
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        if (!href) return { tagName, attribs: {} };

        if (isSameSite(href, orgOrigin)) {
          const { target: _target, rel: _rel, ...rest } = attribs;
          return { tagName, attribs: rest };
        }
        return {
          tagName,
          attribs: { ...attribs, rel: "nofollow noopener noreferrer", target: "_blank" },
        };
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          alt: attribs.alt ?? "",
          loading: attribs.loading ?? "lazy",
          decoding: attribs.decoding ?? "async",
        },
      }),
    },
  }).trim();
}

/** Strip every tag. Used for plain-text excerpts and feed summaries. */
export function stripHtml(html: string): string {
  return sanitize(html, { allowedTags: [], allowedAttributes: {} });
}
