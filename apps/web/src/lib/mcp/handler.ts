import { CmsError } from "@comlabs/cms-core";
import { hasScope } from "@comlabs/cms-core/server";
import type { Organization } from "@comlabs/cms-db";
import { buildToolsForOrg, type McpTool } from "./tools";

/**
 * A minimal MCP server over Streamable HTTP.
 *
 * The transport surface an HTTP-only server needs is small — `initialize`,
 * `tools/list`, `tools/call`, `ping` and the `initialized` notification — and
 * implementing it directly keeps the endpoint stateless, which is what lets a
 * single Next.js route serve every tenant with per-request tool lists.
 */

export const PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

export const JSON_RPC_ERRORS = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function success(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function failure(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } };
}

function isRequest(value: unknown): value is JsonRpcRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as JsonRpcRequest).jsonrpc === "2.0" &&
    typeof (value as JsonRpcRequest).method === "string"
  );
}

export interface McpSession {
  org: Organization;
  scopes: string[];
}

async function dispatch(
  message: JsonRpcRequest,
  session: McpSession,
  tools: McpTool[],
): Promise<JsonRpcResponse | null> {
  const id = message.id ?? null;

  switch (message.method) {
    case "initialize": {
      const requested = String(message.params?.protocolVersion ?? PROTOCOL_VERSION);
      return success(id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: `comlabs-cms:${session.org.slug}`, version: "0.1.0" },
        instructions:
          `Content tools for "${session.org.name}". Create items as drafts, review them, then ` +
          `publish. SEO fields left empty are generated automatically — prefer that over guessing ` +
          `meta descriptions.`,
      });
    }

    // Notifications carry no id and get no response.
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;

    case "ping":
      return success(id, {});

    case "tools/list":
      return success(id, {
        tools: tools
          .filter((tool) => hasScope(session.scopes, tool.scope))
          .map(({ name, title, description, inputSchema }) => ({
            name,
            title,
            description,
            inputSchema,
          })),
      });

    case "tools/call": {
      const name = String(message.params?.name ?? "");
      const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
      const tool = tools.find((t) => t.name === name);

      if (!tool) {
        return failure(id, JSON_RPC_ERRORS.invalidParams, `Unknown tool "${name}".`);
      }
      if (!hasScope(session.scopes, tool.scope)) {
        return failure(
          id,
          JSON_RPC_ERRORS.invalidParams,
          `Tool "${name}" needs the "${tool.scope}" scope; this API key has [${session.scopes.join(", ")}].`,
        );
      }

      try {
        const result = await tool.handler(args, session.org);
        return success(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        });
      } catch (error) {
        // Tool failures are reported inside the result so the model can read
        // and act on them, rather than as transport-level errors.
        const message_ =
          error instanceof CmsError
            ? `${error.message}${error.details ? ` ${JSON.stringify(error.details)}` : ""}`
            : error instanceof Error
              ? error.message
              : "Unknown error.";
        return success(id, { content: [{ type: "text", text: message_ }], isError: true });
      }
    }

    default:
      return failure(id, JSON_RPC_ERRORS.methodNotFound, `Unsupported method "${message.method}".`);
  }
}

/** Handle one POST body, which may be a single message or a batch. */
export async function handleMcpPost(body: unknown, session: McpSession): Promise<Response> {
  const tools = await buildToolsForOrg(session.org.id);
  const messages = Array.isArray(body) ? body : [body];

  if (messages.length === 0) {
    return Response.json(failure(null, JSON_RPC_ERRORS.invalidRequest, "Empty batch."), {
      status: 400,
    });
  }

  const responses: JsonRpcResponse[] = [];
  for (const message of messages) {
    if (!isRequest(message)) {
      responses.push(
        failure(null, JSON_RPC_ERRORS.invalidRequest, "Not a valid JSON-RPC 2.0 message."),
      );
      continue;
    }
    const response = await dispatch(message, session, tools);
    if (response) responses.push(response);
  }

  // Every message was a notification — acknowledge without a body.
  if (responses.length === 0) return new Response(null, { status: 202 });

  const payload = Array.isArray(body) ? responses : responses[0];
  return Response.json(payload, {
    headers: { "MCP-Protocol-Version": PROTOCOL_VERSION },
  });
}
