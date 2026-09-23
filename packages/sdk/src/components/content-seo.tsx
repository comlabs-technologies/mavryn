import type { CmsContent } from "../types";

export interface ContentSeoProps {
  content: CmsContent;
}

/**
 * JSON-LD for a content item.
 *
 * The graph — BlogPosting/Article, FAQPage and BreadcrumbList — is built
 * server-side and travels with the API response, so this only has to emit it.
 * For `<title>` and `<meta>` tags, prefer your framework's metadata API and
 * read the same values from `content.seo`; see `metadataFromContent`.
 */
export function ContentSeo({ content }: ContentSeoProps) {
  return (
    <script
      type="application/ld+json"
      // Server-generated JSON, not user markup; the escape guards against a
      // literal "</script>" sequence inside a field value.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(content.structuredData).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/**
 * Values for a Next.js `generateMetadata` (or any head manager).
 *
 *   export async function generateMetadata({ params }) {
 *     const post = await client.get(params.slug, "blog");
 *     return metadataFromContent(post);
 *   }
 */
export function metadataFromContent(content: CmsContent) {
  return {
    title: content.seo.metaTitle || content.title,
    description: content.seo.metaDescription,
    alternates: { canonical: content.seo.canonicalUrl || content.url },
    openGraph: {
      type: "article" as const,
      title: content.seo.metaTitle || content.title,
      description: content.seo.metaDescription,
      url: content.seo.canonicalUrl || content.url,
      images: content.seo.ogImage ? [content.seo.ogImage] : undefined,
      publishedTime: content.publishedAt ?? undefined,
      authors: content.author ? [content.author] : undefined,
    },
    twitter: {
      card: content.seo.ogImage ? ("summary_large_image" as const) : ("summary" as const),
      title: content.seo.metaTitle || content.title,
      description: content.seo.metaDescription,
      images: content.seo.ogImage ? [content.seo.ogImage] : undefined,
    },
  };
}
