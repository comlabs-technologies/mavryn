import { errorResponse } from "@/lib/http";
import { MAX_UPLOAD_BYTES, uploadMedia } from "@/lib/media";
import { assertCanWrite, getDashboardContext } from "@/lib/session";
import { CmsError } from "@comlabs/cms-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/media — upload from the dashboard.
 *
 * Separate from `/api/v1/media` because it authenticates with the signed-in
 * user's session rather than an API key: the editor should not need one.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getDashboardContext();
    if (!context) throw CmsError.unauthorized("Sign in to upload media.");
    assertCanWrite(context);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw CmsError.badRequest('Expected a "file" part.');
    if (file.size > MAX_UPLOAD_BYTES) {
      throw CmsError.badRequest(`File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit.`);
    }

    const media = await uploadMedia({
      org: context.org,
      data: Buffer.from(await file.arrayBuffer()),
      filename: file.name || "upload",
      contentType: file.type || "application/octet-stream",
    });

    return Response.json({ data: media }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
