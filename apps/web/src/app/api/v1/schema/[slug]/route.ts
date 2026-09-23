import { authenticateApiRequest } from "@/lib/api-auth";
import { findContentBySlug, serializeContent } from "@/lib/content-service";
import { json, preflight, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

/**
 * GET /api/v1/schema/:slug — JSON-LD for one content item.
 *
 * A convenience over `GET /content/:slug` for sites that render structured
 * data separately from the article body.
 */
export const GET = route(async (request, { params }: { params: Promise<{ slug: string }> }) => {
  const { org } = await authenticateApiRequest(request, "read");
  const { slug } = await params;
  const url = new URL(request.url);

  const content = await findContentBySlug(org.id, url.searchParams.get("type") ?? undefined, slug, {
    publishedOnly: true,
  });

  return json({ data: serializeContent(content, content.contentType, org).structuredData });
});
