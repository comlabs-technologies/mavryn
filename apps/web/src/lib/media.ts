import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CmsError } from "@comlabs/cms-core";
import { prisma, type Media, type Organization } from "@comlabs/cms-db";

export type MediaProvider = "local" | "cloudinary" | "s3";

/** Formats the editor and the embed widgets can actually render. */
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function currentProvider(): MediaProvider {
  const value = (process.env.MEDIA_PROVIDER ?? "local").toLowerCase();
  if (value === "cloudinary" || value === "s3" || value === "local") return value;
  throw new Error(`MEDIA_PROVIDER must be one of local, cloudinary, s3 — got "${value}".`);
}

export interface UploadInput {
  org: Organization;
  data: Buffer;
  filename: string;
  contentType: string;
}

function assertUploadable(input: UploadInput) {
  if (!ALLOWED_MIME.has(input.contentType)) {
    throw CmsError.badRequest(
      `Unsupported image type "${input.contentType}". Allowed: ${[...ALLOWED_MIME].join(", ")}.`,
    );
  }
  if (input.data.byteLength === 0) throw CmsError.badRequest("The uploaded file is empty.");
  if (input.data.byteLength > MAX_UPLOAD_BYTES) {
    throw CmsError.badRequest(
      `Image is ${(input.data.byteLength / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    );
  }
}

/** Stable, collision-free object key scoped to the org. */
function objectKey(input: UploadInput): string {
  const ext = EXTENSIONS[input.contentType] ?? "bin";
  const base = path
    .basename(input.filename, path.extname(input.filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "image";
  return `${input.org.id}/${base}-${randomBytes(6).toString("hex")}.${ext}`;
}

async function uploadLocal(input: UploadInput, key: string): Promise<string> {
  const root = path.resolve(process.env.LOCAL_MEDIA_DIR ?? "./.media");
  const target = path.join(root, key);
  // `key` is built from a cuid and a hex suffix, but resolve defensively anyway.
  if (!target.startsWith(root + path.sep)) throw CmsError.badRequest("Invalid upload path.");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, input.data);
  return `/uploads/${key}`;
}

async function uploadCloudinary(input: UploadInput, key: string): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("MEDIA_PROVIDER=cloudinary requires CLOUDINARY_CLOUD_NAME, _API_KEY and _API_SECRET.");
  }

  const publicId = key.replace(/\.[^.]+$/, "");
  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary signs the alphabetically-sorted parameter string.
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(input.data)], { type: input.contentType }), input.filename);
  form.append("public_id", publicId);
  form.append("timestamp", String(timestamp));
  form.append("api_key", apiKey);
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Cloudinary upload failed: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as { secure_url?: string };
  if (!body.secure_url) throw new Error("Cloudinary returned no secure_url.");
  return body.secure_url;
}

async function uploadS3(input: UploadInput, key: string): Promise<string> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("MEDIA_PROVIDER=s3 requires S3_BUCKET.");

  const client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
    ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.data,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("MEDIA_PROVIDER=s3 requires S3_PUBLIC_BASE_URL to build public URLs.");
  return `${base}/${key}`;
}

/** Store an image and record it in the org's media library. */
export async function uploadMedia(input: UploadInput): Promise<Media> {
  assertUploadable(input);
  const provider = currentProvider();
  const key = objectKey(input);

  const url =
    provider === "cloudinary"
      ? await uploadCloudinary(input, key)
      : provider === "s3"
        ? await uploadS3(input, key)
        : await uploadLocal(input, key);

  return prisma.media.create({
    data: {
      orgId: input.org.id,
      url,
      filename: input.filename,
      contentType: input.contentType,
      size: input.data.byteLength,
      provider,
    },
  });
}

/** Fetch a remote image and store it as our own, so posts never hotlink. */
export async function uploadMediaFromUrl(org: Organization, source: string): Promise<Media> {
  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    throw CmsError.badRequest(`"${source}" is not a valid URL.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw CmsError.badRequest("Image URLs must be http or https.");
  }

  const response = await fetch(parsed, { redirect: "follow" });
  if (!response.ok) {
    throw CmsError.badRequest(`Could not fetch ${source}: ${response.status} ${response.statusText}.`);
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim();
  const data = Buffer.from(await response.arrayBuffer());
  const filename = path.basename(parsed.pathname) || "image";

  return uploadMedia({ org, data, filename, contentType });
}

/** Decode a data URI or bare base64 payload from an MCP tool call. */
export function decodeBase64Image(
  value: string,
  fallbackContentType = "image/png",
): { data: Buffer; contentType: string } {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(value.trim());
  const contentType = match?.[1] ?? fallbackContentType;
  const payload = match?.[2] ?? value.trim();
  const data = Buffer.from(payload, "base64");
  if (data.byteLength === 0) throw CmsError.badRequest("Could not decode base64 image data.");
  return { data, contentType };
}
