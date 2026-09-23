import { firstSentence, htmlToText, truncateAtWord } from "../text";
import { contentUrl, resolveCanonical } from "./canonical";

/** Hard limits, chosen so Google rarely truncates the rendered snippet. */
export const SEO_LIMITS = {
  metaTitle: 60,
  metaDescription: 155,
  excerpt: 160,
} as const;

export interface SeoFields {
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  canonicalUrl: string;
  ogImage: string;
}

export interface SeoTemplate {
  /** Field key holding the main body, defaults to "content". */
  bodyField?: string;
  /** Field key holding the cover image, defaults to "coverImage". */
  imageField?: string;
  /** Field key holding a hand-written summary, defaults to "summary". */
  summaryField?: string;
  /** Appended to metaTitle when it still fits, e.g. "Acme Blog". */
  titleSuffix?: string;
  /** Path shape on the tenant's site, defaults to "/:type/:slug". */
  urlPattern?: string;
}

export interface BuildSeoInput {
  title: string;
  slug: string;
  typeSlug: string;
  /** Raw field values for the content item. */
  fields?: Record<string, unknown>;
  template?: SeoTemplate | null;
  orgDomain?: string | null;
  /** Values the author typed by hand. Non-empty entries always win. */
  overrides?: Partial<SeoFields> | null;
}

export interface BuildSeoResult extends SeoFields {
  /** Fields that were filled in automatically rather than by the author. */
  generated: (keyof SeoFields)[];
  /** Non-fatal problems, e.g. a rejected off-domain canonical. */
  warnings: string[];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function withSuffix(title: string, suffix: string | undefined): string {
  if (!suffix) return title;
  const candidate = `${title} | ${suffix}`;
  return candidate.length <= SEO_LIMITS.metaTitle ? candidate : title;
}

/**
 * Fill in the SEO fields an author left blank.
 *
 * Content-type agnostic: it is told which field holds the body and which holds
 * the image through the content type's `seoTemplate`, so a custom type gets the
 * same treatment as the built-in blog type. Every value the author supplied is
 * preserved verbatim — this only ever fills gaps.
 */
export function buildSeo(input: BuildSeoInput): BuildSeoResult {
  const template = input.template ?? {};
  const fields = input.fields ?? {};
  const overrides = input.overrides ?? {};
  const generated: (keyof SeoFields)[] = [];
  const warnings: string[] = [];

  const bodyHtml = asString(fields[template.bodyField ?? "content"]);
  const summary = asString(fields[template.summaryField ?? "summary"]);
  const image = asString(fields[template.imageField ?? "coverImage"]);
  const bodyText = htmlToText(bodyHtml);
  const source = (summary || bodyText).trim();

  // metaTitle -------------------------------------------------------------
  let metaTitle = overrides.metaTitle?.trim() ?? "";
  if (!metaTitle) {
    metaTitle = withSuffix(
      truncateAtWord(input.title, SEO_LIMITS.metaTitle),
      template.titleSuffix,
    );
    generated.push("metaTitle");
  } else {
    metaTitle = truncateAtWord(metaTitle, SEO_LIMITS.metaTitle);
  }

  // excerpt ---------------------------------------------------------------
  let excerpt = overrides.excerpt?.trim() ?? "";
  if (!excerpt) {
    excerpt = truncateAtWord(source, SEO_LIMITS.excerpt);
    generated.push("excerpt");
  } else {
    excerpt = truncateAtWord(excerpt, SEO_LIMITS.excerpt);
  }

  // metaDescription -------------------------------------------------------
  let metaDescription = overrides.metaDescription?.trim() ?? "";
  if (!metaDescription) {
    // Prefer a complete first sentence when one fits; it reads better as a snippet.
    const sentence = firstSentence(source);
    const candidate =
      sentence.length >= 60 && sentence.length <= SEO_LIMITS.metaDescription ? sentence : source;
    metaDescription = truncateAtWord(candidate, SEO_LIMITS.metaDescription);
    generated.push("metaDescription");
  } else {
    metaDescription = truncateAtWord(metaDescription, SEO_LIMITS.metaDescription);
  }

  // canonicalUrl ----------------------------------------------------------
  let canonicalUrl = "";
  const requested = overrides.canonicalUrl?.trim() ?? "";
  if (requested) {
    const resolved = resolveCanonical(requested, input.orgDomain);
    if (resolved.ok) {
      canonicalUrl = resolved.url;
    } else {
      warnings.push(resolved.reason);
    }
  }
  if (!canonicalUrl) {
    canonicalUrl = contentUrl(input.orgDomain, input.typeSlug, input.slug, template.urlPattern);
    generated.push("canonicalUrl");
  }

  // ogImage ---------------------------------------------------------------
  let ogImage = overrides.ogImage?.trim() ?? "";
  if (!ogImage) {
    ogImage = image;
    if (ogImage) generated.push("ogImage");
  }

  return { metaTitle, metaDescription, excerpt, canonicalUrl, ogImage, generated, warnings };
}
