import { originOf } from "./canonical.js";

export interface Faq {
  question: string;
  answer: string;
}

export interface StructuredDataInput {
  title: string;
  description: string;
  url: string;
  image?: string;
  author?: string | null;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  faqs?: Faq[];
  orgName: string;
  orgDomain?: string | null;
  orgLogo?: string | null;
  /** Content type slug — decides BlogPosting vs Article. */
  typeSlug: string;
  /** Label shown in the breadcrumb trail, e.g. "Blog". */
  typeName: string;
}

export type JsonLd = Record<string, unknown>;

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function publisher(input: StructuredDataInput): JsonLd {
  const org: JsonLd = { "@type": "Organization", name: input.orgName };
  const origin = originOf(input.orgDomain);
  if (origin) org.url = origin;
  if (input.orgLogo) org.logo = { "@type": "ImageObject", url: input.orgLogo };
  return org;
}

/** schema.org BlogPosting (blog-ish types) or Article (everything else). */
export function buildArticleSchema(input: StructuredDataInput): JsonLd {
  const isBlog = /blog|post|news|article/i.test(input.typeSlug);
  const node: JsonLd = {
    "@context": "https://schema.org",
    "@type": isBlog ? "BlogPosting" : "Article",
    headline: input.title,
    description: input.description,
    url: input.url,
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
    publisher: publisher(input),
  };

  if (input.image) node.image = [input.image];
  if (input.author) node.author = { "@type": "Person", name: input.author };
  const published = iso(input.publishedAt);
  const modified = iso(input.updatedAt);
  if (published) node.datePublished = published;
  if (modified ?? published) node.dateModified = modified ?? published;

  return node;
}

/** schema.org FAQPage. Returns null when there is nothing to describe. */
export function buildFaqSchema(faqs: Faq[] | undefined, url: string): JsonLd | null {
  const entries = (faqs ?? []).filter((f) => f.question?.trim() && f.answer?.trim());
  if (entries.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: entries.map((f) => ({
      "@type": "Question",
      name: f.question.trim(),
      acceptedAnswer: { "@type": "Answer", text: f.answer.trim() },
    })),
  };
}

export function buildBreadcrumbSchema(input: StructuredDataInput): JsonLd | null {
  const origin = originOf(input.orgDomain);
  if (!origin) return null;

  const listing = `${origin}/${input.typeSlug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin },
      { "@type": "ListItem", position: 2, name: input.typeName, item: listing },
      { "@type": "ListItem", position: 3, name: input.title, item: input.url },
    ],
  };
}

/**
 * Everything a page needs in one `@graph`, so a consumer can drop a single
 * `<script type="application/ld+json">` into `<head>`.
 */
export function buildStructuredData(input: StructuredDataInput): JsonLd {
  const graph = [
    buildArticleSchema(input),
    buildFaqSchema(input.faqs, input.url),
    buildBreadcrumbSchema(input),
  ].filter((n): n is JsonLd => n !== null);

  return { "@context": "https://schema.org", "@graph": graph.map(({ "@context": _c, ...rest }) => rest) };
}
