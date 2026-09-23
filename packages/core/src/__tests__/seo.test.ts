import { describe, expect, it } from "vitest";
import { buildSeo, SEO_LIMITS } from "../seo/auto-metadata";
import { contentUrl, resolveCanonical } from "../seo/canonical";
import { readingTimeFromHtml } from "../seo/reading-time";
import { sanitizeContentHtml } from "../server";
import { buildFaqSchema, buildStructuredData } from "../seo/structured-data";
import { submitToIndexNow } from "../seo/indexnow";
import { htmlToText, truncateAtWord } from "../text";
import { slugify, uniqueSlug } from "../slug";

describe("text", () => {
  it("separates block elements with whitespace", () => {
    expect(htmlToText("<p>One</p><p>Two</p>")).toBe("One Two");
  });

  it("decodes entities and drops script bodies", () => {
    expect(htmlToText("<p>Tom &amp; Jerry</p><script>alert(1)</script>")).toBe("Tom & Jerry");
  });

  it("truncates on a word boundary and counts the ellipsis", () => {
    const out = truncateAtWord("the quick brown fox jumps", 15);
    expect(out.length).toBeLessThanOrEqual(15);
    expect(out).toBe("the quick…");
  });

  it("leaves short strings untouched", () => {
    expect(truncateAtWord("short", 40)).toBe("short");
  });
});

describe("slugify", () => {
  it("folds accents and punctuation", () => {
    expect(slugify("Héllo, Wörld! — 2026")).toBe("hello-world-2026");
  });

  it("suffixes until unique", () => {
    expect(uniqueSlug("My Post", ["my-post", "my-post-2"])).toBe("my-post-3");
  });
});

describe("sanitizeContentHtml", () => {
  it("drops scripts and inline handlers", () => {
    const out = sanitizeContentHtml('<p onclick="steal()">hi</p><script>bad()</script>');
    expect(out).toBe("<p>hi</p>");
  });

  it("strips injected robots meta so pasted markup cannot de-index a page", () => {
    const out = sanitizeContentHtml('<meta name="robots" content="noindex"><p>body</p>');
    expect(out).not.toContain("noindex");
    expect(out).toContain("<p>body</p>");
  });

  it("marks external links nofollow and internal links untouched", () => {
    const out = sanitizeContentHtml(
      '<a href="https://other.com/x">out</a><a href="/blog/x">in</a>',
      { orgDomain: "https://example.com" },
    );
    expect(out).toContain('rel="nofollow noopener noreferrer"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('<a href="/blog/x">in</a>');
  });

  it("treats the org's own absolute links as internal", () => {
    const out = sanitizeContentHtml('<a href="https://www.example.com/a">x</a>', {
      orgDomain: "example.com",
    });
    expect(out).not.toContain("nofollow");
  });

  it("rejects javascript: URLs", () => {
    expect(sanitizeContentHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
  });
});

describe("resolveCanonical", () => {
  it("makes relative canonicals absolute against the org domain", () => {
    expect(resolveCanonical("/blog/x", "example.com")).toEqual({
      ok: true,
      url: "https://example.com/blog/x",
    });
  });

  it("refuses to point indexing at another domain", () => {
    const result = resolveCanonical("https://competitor.com/x", "example.com");
    expect(result.ok).toBe(false);
  });

  it("treats an empty canonical as unset", () => {
    expect(resolveCanonical("", "example.com")).toEqual({ ok: true, url: "" });
  });

  it("builds content URLs from the type's pattern", () => {
    expect(contentUrl("example.com", "blog", "hello", "/blog/:slug")).toBe(
      "https://example.com/blog/hello",
    );
  });
});

describe("buildSeo", () => {
  const base = {
    title: "When AI Agents Get Stuck in Loops",
    slug: "when-ai-agents-get-stuck-in-loops",
    typeSlug: "blog",
    orgDomain: "example.com",
    template: { bodyField: "content", imageField: "coverImage", summaryField: "summary" },
  };

  it("fills every empty field and reports which it generated", () => {
    const result = buildSeo({
      ...base,
      fields: {
        content: "<p>Agents loop when a tool keeps returning the same error. Here is how to break the cycle.</p>",
        coverImage: "https://cdn.example.com/a.png",
      },
    });

    expect(result.metaTitle).toBe(base.title);
    expect(result.metaDescription.length).toBeLessThanOrEqual(SEO_LIMITS.metaDescription);
    expect(result.metaDescription).toContain("Agents loop");
    expect(result.excerpt.length).toBeLessThanOrEqual(SEO_LIMITS.excerpt);
    expect(result.canonicalUrl).toBe("https://example.com/blog/when-ai-agents-get-stuck-in-loops");
    expect(result.ogImage).toBe("https://cdn.example.com/a.png");
    expect(result.generated).toContain("metaTitle");
    expect(result.generated).toContain("canonicalUrl");
  });

  it("never overwrites what the author typed", () => {
    const result = buildSeo({
      ...base,
      fields: { content: "<p>body text here</p>" },
      overrides: { metaTitle: "Hand written title", excerpt: "Hand written excerpt" },
    });
    expect(result.metaTitle).toBe("Hand written title");
    expect(result.excerpt).toBe("Hand written excerpt");
    expect(result.generated).not.toContain("metaTitle");
  });

  it("prefers the explicit summary over the body", () => {
    const result = buildSeo({
      ...base,
      fields: { content: "<p>Long body.</p>", summary: "A tight one-line summary." },
    });
    expect(result.excerpt).toBe("A tight one-line summary.");
  });

  it("falls back to the generated canonical and warns when the override is off-domain", () => {
    const result = buildSeo({
      ...base,
      fields: { content: "<p>body</p>" },
      overrides: { canonicalUrl: "https://competitor.com/steal" },
    });
    expect(result.canonicalUrl).toBe("https://example.com/blog/when-ai-agents-get-stuck-in-loops");
    expect(result.warnings).toHaveLength(1);
  });

  it("keeps a long title inside the meta title limit", () => {
    const result = buildSeo({
      ...base,
      title: "A very long title ".repeat(10),
      fields: { content: "<p>body</p>" },
    });
    expect(result.metaTitle.length).toBeLessThanOrEqual(SEO_LIMITS.metaTitle);
  });
});

describe("readingTime", () => {
  it("rounds to whole minutes and never returns zero for real content", () => {
    expect(readingTimeFromHtml(`<p>${"word ".repeat(400)}</p>`)).toBe(2);
    expect(readingTimeFromHtml("<p>hello</p>")).toBe(1);
    expect(readingTimeFromHtml("")).toBe(0);
  });
});

describe("structured data", () => {
  const input = {
    title: "Post",
    description: "Description",
    url: "https://example.com/blog/post",
    typeSlug: "blog",
    typeName: "Blog",
    orgName: "Example Inc",
    orgDomain: "example.com",
    publishedAt: "2026-08-16T08:00:00.000Z",
    faqs: [{ question: "Why?", answer: "Because." }],
  };

  it("emits a BlogPosting, FAQPage and BreadcrumbList in one graph", () => {
    const graph = buildStructuredData(input)["@graph"] as Record<string, unknown>[];
    expect(graph.map((n) => n["@type"])).toEqual(["BlogPosting", "FAQPage", "BreadcrumbList"]);
  });

  it("omits the FAQ node when no answered questions exist", () => {
    expect(buildFaqSchema([{ question: "Why?", answer: "  " }], input.url)).toBeNull();
    expect(buildFaqSchema([], input.url)).toBeNull();
  });
});

describe("indexnow", () => {
  it("skips submission when the org has no key", async () => {
    const result = await submitToIndexNow({ key: "", orgDomain: "example.com", urls: ["https://example.com/a"] });
    expect(result).toEqual({ submitted: false, reason: expect.any(String) });
  });

  it("submits only URLs on the org's own host", async () => {
    let body: Record<string, unknown> | undefined;
    const result = await submitToIndexNow({
      key: "abc123",
      orgDomain: "https://example.com",
      urls: ["https://example.com/a", "https://other.com/b", "https://example.com/a"],
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return new Response(null, { status: 200 });
      },
    });
    expect(result).toEqual({ submitted: true, count: 1, status: 200 });
    expect(body?.urlList).toEqual(["https://example.com/a"]);
  });
});
