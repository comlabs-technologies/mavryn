import { authenticateApiRequest } from "@/lib/api-auth";
import {
  createContent,
  listContent,
  MAX_PAGE_SIZE,
  releaseDueScheduledContent,
  resolveContentType,
  serializeContent,
  type ContentStatus,
} from "@/lib/content-service";
import { json, preflight, readJsonBody, route } from "@/lib/http";
import { CmsError } from "@comlabs/cms-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

/**
 * GET /api/v1/content — list published content.
 *
 * A `read` key can only ever see published items. Drafts are visible to
 * `write`/`admin` keys, and only when they ask for them with `?status=`.
 */
export const GET = route(async (request) => {
  const { org, scopes } = await authenticateApiRequest(request, "read");
  const url = new URL(request.url);

  await releaseDueScheduledContent(org.id);

  const requestedStatus = url.searchParams.get("status");
  const canSeeDrafts = scopes.includes("write") || scopes.includes("admin");
  if (requestedStatus && !canSeeDrafts) {
    throw CmsError.forbidden("Filtering by status requires a key with the write scope.");
  }

  const limit = Number(url.searchParams.get("limit") ?? 20);
  if (Number.isNaN(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw CmsError.badRequest(`"limit" must be between 1 and ${MAX_PAGE_SIZE}.`);
  }

  const result = await listContent({
    orgId: org.id,
    typeSlug: url.searchParams.get("type") ?? undefined,
    status: (requestedStatus as ContentStatus | null) ?? "published",
    tag: url.searchParams.get("tag") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    page: Number(url.searchParams.get("page") ?? 1),
    limit,
    sort: (url.searchParams.get("sort") as "newest" | "oldest" | "title" | null) ?? "newest",
  });

  return json({
    data: result.items.map((item) => serializeContent(item, item.contentType, org)),
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    },
  });
});

/** POST /api/v1/content — create a content item. */
export const POST = route(async (request) => {
  const { org } = await authenticateApiRequest(request, "write");
  const body = await readJsonBody(request);

  const typeSlug = typeof body.type === "string" ? body.type : "";
  if (!typeSlug) throw CmsError.badRequest('A "type" is required, e.g. "blog".');

  const type = await resolveContentType(org.id, typeSlug);
  const { content, warnings } = await createContent(org, type, body);

  return json(
    { data: serializeContent(content, content.contentType, org), warnings },
    { status: 201 },
  );
});
