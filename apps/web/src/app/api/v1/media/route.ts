import { authenticateApiRequest } from "@/lib/api-auth";
import { json, preflight, route } from "@/lib/http";
import { decodeBase64Image, MAX_UPLOAD_BYTES, uploadMedia } from "@/lib/media";
import { CmsError } from "@comlabs/cms-core";
import { prisma } from "@comlabs/cms-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

/** GET /api/v1/media — the org's media library, newest first. */
export const GET = route(async (request) => {
  const { org } = await authenticateApiRequest(request, "read");
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

  const media = await prisma.media.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return json({ data: media });
});

/**
 * POST /api/v1/media — upload an image.
 *
 * Accepts `multipart/form-data` with a `file` part (browsers and curl) or JSON
 * `{ data, filename, contentType }` where `data` is base64 (MCP clients).
 */
export const POST = route(async (request) => {
  const { org } = await authenticateApiRequest(request, "write");
  const contentTypeHeader = request.headers.get("content-type") ?? "";

  if (contentTypeHeader.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw CmsError.badRequest('Expected a "file" part in the form data.');
    if (file.size > MAX_UPLOAD_BYTES) {
      throw CmsError.badRequest(`File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit.`);
    }

    const media = await uploadMedia({
      org,
      data: Buffer.from(await file.arrayBuffer()),
      filename: file.name || "upload",
      contentType: file.type || "application/octet-stream",
    });
    return json({ data: media }, { status: 201 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.data !== "string") {
    throw CmsError.badRequest(
      'Send multipart form data with a "file" part, or JSON with a base64 "data" field.',
    );
  }

  const decoded = decodeBase64Image(
    body.data,
    typeof body.contentType === "string" ? body.contentType : undefined,
  );
  const media = await uploadMedia({
    org,
    data: decoded.data,
    filename: typeof body.filename === "string" ? body.filename : "upload",
    contentType: decoded.contentType,
  });

  return json({ data: media }, { status: 201 });
});
