import { authenticateApiRequest } from "@/lib/api-auth";
import { CORS_HEADERS, errorResponse } from "@/lib/http";
import { handleMcpPost, JSON_RPC_ERRORS } from "@/lib/mcp/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MCP_CORS = {
  ...CORS_HEADERS,
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Api-Key, MCP-Protocol-Version",
};

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: MCP_CORS });
}

/**
 * POST /api/v1/mcp — the Model Context Protocol endpoint.
 *
 * Stateless: the API key on the request identifies the organization, and the
 * tool list is rebuilt from that org's content types on every call. Point a
 * client at it with:
 *
 *   { "url": "https://<host>/api/v1/mcp", "headers": { "Authorization": "Bearer cm_live_..." } }
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // `read` is the floor; each tool re-checks the scope it actually needs.
    const { org, scopes } = await authenticateApiRequest(request, "read");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: JSON_RPC_ERRORS.parseError, message: "Request body is not valid JSON." },
        },
        { status: 400, headers: MCP_CORS },
      );
    }

    const response = await handleMcpPost(body, { org, scopes });
    for (const [key, value] of Object.entries(MCP_CORS)) response.headers.set(key, value);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Streamable HTTP allows a GET to open a server-to-client SSE stream. This
 * server never initiates messages, so it declines per the specification.
 */
export function GET(): Response {
  return new Response("This MCP endpoint does not offer a server-initiated SSE stream.", {
    status: 405,
    headers: { ...MCP_CORS, Allow: "POST, OPTIONS" },
  });
}
