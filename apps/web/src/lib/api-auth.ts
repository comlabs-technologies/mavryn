import { CmsError } from "@comlabs/cms-core";
import {
  type ApiKeyScope,
  extractApiKey,
  hasScope,
  hashApiKey,
} from "@comlabs/cms-core/server";
import { prisma, type Organization } from "@comlabs/cms-db";

export interface ApiContext {
  org: Organization;
  apiKeyId: string;
  scopes: string[];
}

/** Keep `lastUsed` roughly current without a write on every single request. */
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Authenticate a request against an API key.
 *
 * The raw key is never stored, so lookup is by SHA-256 digest — a unique index,
 * which also means an invalid key costs one indexed read and nothing more.
 */
export async function authenticateApiRequest(
  request: Request,
  required: ApiKeyScope,
): Promise<ApiContext> {
  const url = new URL(request.url);
  const raw = extractApiKey(request.headers, url);
  if (!raw) {
    throw CmsError.unauthorized(
      "Provide an API key as `Authorization: Bearer cm_live_...` or `?api_key=`.",
    );
  }

  const record = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(raw) },
    include: { org: true },
  });
  if (!record) throw CmsError.unauthorized("This API key is not valid.");

  if (!hasScope(record.scopes, required)) {
    throw CmsError.forbidden(
      `This key has scopes [${record.scopes.join(", ")}] but the request needs "${required}".`,
    );
  }

  if (!record.lastUsed || Date.now() - record.lastUsed.getTime() > LAST_USED_THROTTLE_MS) {
    // Best-effort bookkeeping — never let it fail the request.
    void prisma.apiKey
      .update({ where: { id: record.id }, data: { lastUsed: new Date() } })
      .catch(() => undefined);
  }

  return { org: record.org, apiKeyId: record.id, scopes: record.scopes };
}
