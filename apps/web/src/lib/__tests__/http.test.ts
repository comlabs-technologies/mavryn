import { describe, expect, it, vi } from "vitest";
import { CmsError } from "@comlabs/cms-core";
import { CORS_HEADERS, errorResponse, json, readJsonBody, route } from "../http";

function request(body: string, method = "POST"): Request {
  return new Request("https://cms.test/api/v1/content", { method, body });
}

describe("json", () => {
  it("sends JSON with CORS headers", async () => {
    const response = json({ ok: true });
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("lets an explicit header win over the defaults", () => {
    const response = json({}, { headers: { "Cache-Control": "no-store" } });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(Object.keys(CORS_HEADERS).length).toBeGreaterThan(0);
  });
});

describe("errorResponse", () => {
  it("maps a CmsError onto its status and code", async () => {
    const response = errorResponse(CmsError.forbidden("Needs write."));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatchObject({
      code: "forbidden",
      message: "Needs write.",
    });
  });

  it("carries validation details through", async () => {
    const details = [{ path: "content", message: "required" }];
    const response = errorResponse(CmsError.badRequest("Invalid.", details));
    expect(response.status).toBe(400);
    expect((await response.json()).error.details).toEqual(details);
  });

  it("does not leak an unexpected error's message", async () => {
    // The handler logs the real error server-side on purpose; keep it out of
    // the test output while still asserting it stays out of the response.
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = errorResponse(new Error("connect ECONNREFUSED 10.0.0.3:5432"));
    quiet.mockRestore();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });
});

describe("route", () => {
  it("turns a thrown CmsError into a response", async () => {
    const handler = route(async () => {
      throw CmsError.notFound("No such post.");
    });
    const response = await handler(request("{}"));
    expect(response.status).toBe(404);
  });

  it("passes the handler's response through untouched", async () => {
    const handler = route(async () => json({ hello: "world" }, { status: 201 }));
    const response = await handler(request("{}"));
    expect(response.status).toBe(201);
  });
});

describe("readJsonBody", () => {
  it("parses an object", async () => {
    expect(await readJsonBody(request('{"title":"Hi"}'))).toEqual({ title: "Hi" });
  });

  it("treats an empty body as an empty object", async () => {
    expect(await readJsonBody(request(""))).toEqual({});
  });

  it("rejects malformed JSON with a 400", async () => {
    await expect(readJsonBody(request("{not json"))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a top-level array or scalar", async () => {
    await expect(readJsonBody(request("[1,2]"))).rejects.toMatchObject({ status: 400 });
    await expect(readJsonBody(request('"hello"'))).rejects.toMatchObject({ status: 400 });
  });
});
