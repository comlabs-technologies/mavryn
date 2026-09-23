import { authenticateApiRequest } from "@/lib/api-auth";
import {
  listContent,
  orgSettings,
  releaseDueScheduledContent,
  serializeContent,
} from "@/lib/content-service";
import { CORS_HEADERS, route } from "@/lib/http";
import { originOf } from "@comlabs/cms-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * GET /api/v1/feed.xml — RSS 2.0 for one content type (default "blog").
 *
 * Served from the CMS rather than the customer's site so a static or
 * non-Node site gets a working feed by linking straight to this URL.
 */
export const GET = route(async (request) => {
  const { org } = await authenticateApiRequest(request, "read");
  const url = new URL(request.url);
  const typeSlug = url.searchParams.get("type") ?? "blog";

  await releaseDueScheduledContent(org.id);

  const { items } = await listContent({
    orgId: org.id,
    typeSlug,
    status: "published",
    limit: 50,
    sort: "newest",
  });

  const siteUrl = originOf(org.domain) ?? url.origin;
  const settings = orgSettings(org);
  const self = `${url.origin}${url.pathname}?type=${encodeURIComponent(typeSlug)}`;
  const latest = items[0]?.publishedAt ?? new Date();

  const entries = items.map((item) => {
    const serialized = serializeContent(item, item.contentType, org);
    const link = serialized.seo.canonicalUrl || serialized.url;
    return `    <item>
      <title>${escapeXml(serialized.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(serialized.seo.excerpt || serialized.seo.metaDescription)}</description>
      ${serialized.author ? `<dc:creator>${escapeXml(serialized.author)}</dc:creator>` : ""}
      ${serialized.publishedAt ? `<pubDate>${new Date(serialized.publishedAt).toUTCString()}</pubDate>` : ""}
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(org.name)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(settings.authorName ? `Updates from ${org.name}` : org.name)}</description>
    <language>en</language>
    <lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml" />
${entries.join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      ...CORS_HEADERS,
    },
  });
});
