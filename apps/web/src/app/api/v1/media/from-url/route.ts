import { authenticateApiRequest } from "@/lib/api-auth";
import { json, preflight, readJsonBody, route } from "@/lib/http";
import { uploadMediaFromUrl } from "@/lib/media";
import { CmsError } from "@comlabs/cms-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

/**
 * POST /api/v1/media/from-url — copy a remote image into the org's library so
 * published posts serve their own assets instead of hotlinking.
 */
export const POST = route(async (request) => {
  const { org } = await authenticateApiRequest(request, "write");
  const body = await readJsonBody(request);

  if (typeof body.url !== "string" || !body.url.trim()) {
    throw CmsError.badRequest('A "url" is required.');
  }

  const media = await uploadMediaFromUrl(org, body.url.trim());
  return json({ data: media }, { status: 201 });
});
