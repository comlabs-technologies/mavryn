import { authenticateApiRequest } from "@/lib/api-auth";
import {
  deleteContent,
  findContentById,
  findContentBySlug,
  serializeContent,
  updateContent,
} from "@/lib/content-service";
import { json, preflight, readJsonBody, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

type Params = { params: Promise<{ id: string }> };

/** Content ids are cuids; anything else in the path is treated as a slug. */
function looksLikeId(value: string): boolean {
  return /^c[a-z0-9]{20,}$/i.test(value);
}

/**
 * GET /api/v1/content/:idOrSlug
 *
 * Slugs are the documented form for site integrations, ids are what the MCP
 * tools hand back, so both resolve here.
 */
export const GET = route(async (request, { params }: Params) => {
  const { org, scopes } = await authenticateApiRequest(request, "read");
  const { id } = await params;
  const url = new URL(request.url);
  const canSeeDrafts = scopes.includes("write") || scopes.includes("admin");

  const content = looksLikeId(id)
    ? await findContentById(org.id, id)
    : await findContentBySlug(org.id, url.searchParams.get("type") ?? undefined, id, {
        publishedOnly: !canSeeDrafts,
      });

  if (content.status !== "published" && !canSeeDrafts) {
    // Do not confirm that an unpublished item exists to a read-only key.
    return json({ error: { code: "not_found", message: `No content with slug "${id}".` } }, { status: 404 });
  }

  return json({ data: serializeContent(content, content.contentType, org) });
});

/** PATCH /api/v1/content/:id — partial update. */
export const PATCH = route(async (request, { params }: Params) => {
  const { org } = await authenticateApiRequest(request, "write");
  const { id } = await params;
  const body = await readJsonBody(request);

  const { content, warnings } = await updateContent(org, id, body);
  return json({ data: serializeContent(content, content.contentType, org), warnings });
});

/** DELETE /api/v1/content/:id — permanent. Requires the admin scope. */
export const DELETE = route(async (request, { params }: Params) => {
  const { org } = await authenticateApiRequest(request, "admin");
  const { id } = await params;
  await deleteContent(org.id, id);
  return json({ data: { id, deleted: true } });
});
