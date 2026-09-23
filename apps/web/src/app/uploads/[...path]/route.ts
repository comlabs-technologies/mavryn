import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { currentProvider } from "@/lib/media";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

/**
 * Serve images stored by the `local` media provider.
 *
 * Self-hosted installs without an object store keep uploads on disk; SaaS
 * installs use Cloudinary or S3 and never reach this route.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (currentProvider() !== "local") {
    return new Response("Not found", { status: 404 });
  }

  const root = path.resolve(process.env.LOCAL_MEDIA_DIR ?? "./.media");
  const { path: segments } = await params;
  const target = path.resolve(root, ...segments);

  // Refuse anything that escapes the media root via "..".
  if (target !== root && !target.startsWith(root + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const stats = await stat(target);
    if (!stats.isFile()) return new Response("Not found", { status: 404 });

    const stream = Readable.toWeb(createReadStream(target)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": CONTENT_TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream",
        "Content-Length": String(stats.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
