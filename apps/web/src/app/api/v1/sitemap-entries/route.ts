import { authenticateApiRequest } from "@/lib/api-auth";
import { listContent, releaseDueScheduledContent, serializeContent } from "@/lib/content-service";
import { json, preflight, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

/**
 * GET /api/v1/sitemap-entries — everything the customer's own sitemap needs.
 *
 * Returned as JSON rather than XML because these entries are merged into the
 * site's existing sitemap (a Next.js `sitemap.ts`, for example) alongside
 * pages the CMS knows nothing about.
 */
export const GET = route(async (request) => {
  const { org } = await authenticateApiRequest(request, "read");
  const url = new URL(request.url);

  await releaseDueScheduledContent(org.id);

  const { items } = await listContent({
    orgId: org.id,
    typeSlug: url.searchParams.get("type") ?? undefined,
    status: "published",
    limit: 100,
    sort: "newest",
  });

  return json({
    data: items.map((item) => {
      const serialized = serializeContent(item, item.contentType, org);
      return {
        url: serialized.seo.canonicalUrl || serialized.url,
        lastModified: serialized.updatedAt,
        // Newer posts are crawled more eagerly; everything else settles at 0.6.
        changeFrequency: "weekly" as const,
        priority: item.publishedAt && Date.now() - item.publishedAt.getTime() < 30 * 864e5 ? 0.8 : 0.6,
        type: serialized.type,
      };
    }),
  });
});
