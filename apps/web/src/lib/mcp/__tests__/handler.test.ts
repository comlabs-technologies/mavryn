import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Organization } from "@comlabs/cms-db";

// The real tool set reaches the database; the protocol layer is what is under
// test here, so the tools are stubbed at the module boundary.
const listHandler = vi.fn(async () => ({ items: [] }));
const createHandler = vi.fn(async (args: Record<string, unknown>) => ({ id: "c1", ...args }));
const deleteHandler = vi.fn(async () => ({ deleted: true }));
const failingHandler = vi.fn(async () => {
  throw new Error("Body is required.");
});

vi.mock("../tools", () => ({
  buildToolsForOrg: vi.fn(async () => [
    {
      name: "list_blog",
      title: "List",
      description: "d",
      inputSchema: { type: "object" },
      scope: "read",
      handler: listHandler,
    },
    {
      name: "create_blog",
      title: "Create",
      description: "d",
      inputSchema: { type: "object" },
      scope: "write",
      handler: createHandler,
    },
    {
      name: "delete_blog",
      title: "Delete",
      description: "d",
      inputSchema: { type: "object" },
      scope: "admin",
      handler: deleteHandler,
    },
    {
      name: "broken",
      title: "Broken",
      description: "d",
      inputSchema: { type: "object" },
      scope: "write",
      handler: failingHandler,
    },
  ]),
}));

const { handleMcpPost, JSON_RPC_ERRORS, PROTOCOL_VERSION } = await import("../handler");

const org = { id: "org1", name: "Acme", slug: "acme" } as Organization;

async function post(body: unknown, scopes: string[] = ["admin"]) {
  const response = await handleMcpPost(body, { org, scopes });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

describe("MCP handler", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("initialize", () => {
    it("echoes a supported protocol version and identifies the org", async () => {
      const { body } = await post({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26" },
      });

      expect(body.result.protocolVersion).toBe("2025-03-26");
      expect(body.result.serverInfo.name).toBe("comlabs-cms:acme");
      expect(body.result.capabilities.tools).toBeDefined();
    });

    it("falls back to its own version when the client asks for an unknown one", async () => {
      const { body } = await post({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "1999-01-01" },
      });
      expect(body.result.protocolVersion).toBe(PROTOCOL_VERSION);
    });
  });

  describe("notifications", () => {
    it("acknowledges with 202 and no body", async () => {
      const { response, body } = await post({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });
      expect(response.status).toBe(202);
      expect(body).toBeNull();
    });
  });

  describe("tools/list", () => {
    it("returns every tool for an admin key", async () => {
      const { body } = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" });
      expect(body.result.tools.map((t: { name: string }) => t.name)).toEqual([
        "list_blog",
        "create_blog",
        "delete_blog",
        "broken",
      ]);
    });

    it("hides tools the key cannot call", async () => {
      const { body } = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, ["read"]);
      expect(body.result.tools.map((t: { name: string }) => t.name)).toEqual(["list_blog"]);
    });

    it("omits the handler from the wire format", async () => {
      const { body } = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" });
      expect(body.result.tools[0]).not.toHaveProperty("handler");
      expect(body.result.tools[0]).not.toHaveProperty("scope");
    });
  });

  describe("tools/call", () => {
    it("runs the tool and returns both text and structured content", async () => {
      const { body } = await post({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "create_blog", arguments: { title: "Hello" } },
      });

      expect(createHandler).toHaveBeenCalledWith({ title: "Hello" }, org);
      expect(body.result.structuredContent).toEqual({ id: "c1", title: "Hello" });
      expect(JSON.parse(body.result.content[0].text)).toEqual({ id: "c1", title: "Hello" });
      expect(body.result.isError).toBeUndefined();
    });

    it("rejects an unknown tool as a protocol error", async () => {
      const { body } = await post({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "nope" },
      });
      expect(body.error.code).toBe(JSON_RPC_ERRORS.invalidParams);
      expect(body.error.message).toContain("nope");
    });

    it("refuses a tool the key lacks the scope for, and does not run it", async () => {
      const { body } = await post(
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "delete_blog" } },
        ["read", "write"],
      );
      expect(body.error.code).toBe(JSON_RPC_ERRORS.invalidParams);
      expect(body.error.message).toContain("admin");
      expect(deleteHandler).not.toHaveBeenCalled();
    });

    it("reports a tool failure inside the result so the model can react", async () => {
      const { body } = await post({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "broken" },
      });
      expect(body.error).toBeUndefined();
      expect(body.result.isError).toBe(true);
      expect(body.result.content[0].text).toBe("Body is required.");
    });

    it("defaults missing arguments to an empty object", async () => {
      await post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_blog" } });
      expect(listHandler).toHaveBeenCalledWith({}, org);
    });
  });

  describe("protocol handling", () => {
    it("answers ping", async () => {
      const { body } = await post({ jsonrpc: "2.0", id: 4, method: "ping" });
      expect(body.result).toEqual({});
    });

    it("reports an unsupported method", async () => {
      const { body } = await post({ jsonrpc: "2.0", id: 5, method: "resources/list" });
      expect(body.error.code).toBe(JSON_RPC_ERRORS.methodNotFound);
    });

    it("rejects a malformed message", async () => {
      const { body } = await post({ id: 6, method: "tools/list" });
      expect(body.error.code).toBe(JSON_RPC_ERRORS.invalidRequest);
    });

    it("answers a batch with an array, dropping the notifications", async () => {
      const { body } = await post([
        { jsonrpc: "2.0", id: 1, method: "ping" },
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
      ]);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      expect(body.map((m: { id: number }) => m.id)).toEqual([1, 2]);
    });

    it("rejects an empty batch", async () => {
      const { response, body } = await post([]);
      expect(response.status).toBe(400);
      expect(body.error.code).toBe(JSON_RPC_ERRORS.invalidRequest);
    });
  });
});
