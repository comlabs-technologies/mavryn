import { beforeEach, describe, expect, it, vi } from "vitest";
import { CmsClient } from "../client";
import { CmsApiError } from "../types";

function mockFetch(response: unknown, status = 200) {
  const spy = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(response), { status }),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("CmsClient", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("refuses to construct without credentials", () => {
    expect(() => new CmsClient({ apiKey: "", baseUrl: "https://x/api/v1" })).toThrow(/apiKey/);
    expect(() => new CmsClient({ apiKey: "k", baseUrl: "" })).toThrow(/baseUrl/);
  });

  it("sends the key as a bearer token and drops a trailing slash", async () => {
    const spy = mockFetch({ data: [], meta: { total: 0, page: 1, limit: 20, hasMore: false } });
    const client = new CmsClient({ apiKey: "cm_live_x", baseUrl: "https://cms.test/api/v1/" });

    await client.list({ type: "blog" });

    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("https://cms.test/api/v1/content?type=blog");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer cm_live_x");
  });

  it("omits empty query parameters", async () => {
    const spy = mockFetch({ data: [], meta: {} });
    const client = new CmsClient({ apiKey: "k", baseUrl: "https://cms.test/api/v1" });

    await client.list({ type: "blog", tag: "", search: undefined, limit: 5 });

    expect(spy.mock.calls[0]![0]).toBe("https://cms.test/api/v1/content?type=blog&limit=5");
  });

  it("turns an API error body into a typed error", async () => {
    mockFetch({ error: { code: "forbidden", message: "Needs write." } }, 403);
    const client = new CmsClient({ apiKey: "k", baseUrl: "https://cms.test/api/v1" });

    await expect(client.get("x", "blog")).rejects.toMatchObject({
      name: "CmsApiError",
      status: 403,
      code: "forbidden",
      message: "Needs write.",
    });
    await expect(client.get("x")).rejects.toBeInstanceOf(CmsApiError);
  });

  it("encodes slugs so a path cannot be escaped", async () => {
    const spy = mockFetch({ data: {} });
    const client = new CmsClient({ apiKey: "k", baseUrl: "https://cms.test/api/v1" });

    await client.get("../../admin", "blog");

    expect(spy.mock.calls[0]![0]).toBe(
      "https://cms.test/api/v1/content/..%2F..%2Fadmin?type=blog",
    );
  });

  it("builds a feed URL carrying the key", () => {
    const client = new CmsClient({ apiKey: "cm_live_k", baseUrl: "https://cms.test/api/v1" });
    expect(client.feedUrl("blog")).toBe(
      "https://cms.test/api/v1/feed.xml?type=blog&api_key=cm_live_k",
    );
  });
});
