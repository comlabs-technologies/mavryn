import { CmsError } from "@comlabs/cms-core";

export interface JsonInit {
  status?: number;
  headers?: Record<string, string>;
}

/**
 * The public API is called straight from browsers on customer domains, so every
 * response carries permissive CORS. Reads are safe by design (published content
 * only) and writes still require a bearer key, which a cross-site request
 * cannot obtain on its own.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Api-Key",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, init: JsonInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...init.headers,
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof CmsError) {
    return json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  console.error("[api] unhandled error", error);
  return json(
    { error: { code: "internal_error", message: "Something went wrong handling this request." } },
    { status: 500 },
  );
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Wrap a route handler so thrown CmsErrors become clean JSON responses. */
export function route<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw CmsError.badRequest("Request body must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof CmsError) throw error;
    throw CmsError.badRequest("Request body is not valid JSON.");
  }
}
