import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlogList } from "../components/blog-list";
import { BlogPost } from "../components/blog-post";
import { FaqAccordion } from "../components/faq-accordion";
import { metadataFromContent } from "../components/content-seo";
import { CmsProvider } from "../provider";
import type { CmsContent } from "../types";

const post: CmsContent = {
  id: "c1",
  type: "blog",
  typeName: "Blog Post",
  title: "When AI Agents Get Stuck in Loops",
  slug: "when-ai-agents-get-stuck-in-loops",
  url: "https://example.com/blog/when-ai-agents-get-stuck-in-loops",
  fields: {
    content: "<p>Body text.</p>",
    coverImage: "https://cdn.example.com/cover.png",
    coverImageAlt: "A diagram",
    tags: ["Agents", "Reliability"],
  },
  seo: {
    metaTitle: "When AI Agents Get Stuck in Loops",
    metaDescription: "Repeated tool failures are a signal to escalate.",
    excerpt: "Repeated tool failures are a signal to escalate.",
    canonicalUrl: "https://example.com/blog/when-ai-agents-get-stuck-in-loops",
    ogImage: "https://cdn.example.com/cover.png",
  },
  faqs: [
    { question: "Why do agents loop?", answer: "Because a retry looks like a first attempt." },
    { question: "How do I stop it?", answer: "Escalate instead of retrying." },
  ],
  status: "published",
  author: "Demo Team",
  publishedAt: "2026-08-16T08:00:00.000Z",
  scheduledAt: null,
  updatedAt: "2026-08-16T08:00:00.000Z",
  readingTime: 6,
  structuredData: { "@context": "https://schema.org", "@graph": [{ "@type": "BlogPosting" }] },
};

function wrap(ui: React.ReactNode) {
  return render(
    <CmsProvider apiKey="cm_live_test" baseUrl="https://cms.test/api/v1">
      {ui}
    </CmsProvider>,
  );
}

describe("BlogList", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("renders pre-fetched items without touching the network", () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    wrap(<BlogList items={[post]} />);

    expect(screen.getByText(post.title)).toBeTruthy();
    expect(screen.getByText("Agents")).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
  });

  it("fetches when no items are supplied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ data: [post], meta: { total: 1, page: 1, limit: 12, hasMore: false } }),
        ),
      ),
    );

    wrap(<BlogList type="blog" />);

    await waitFor(() => expect(screen.getByText(post.title)).toBeTruthy());
  });

  it("shows the empty message rather than an empty list", () => {
    wrap(<BlogList items={[]} emptyMessage="Nothing here yet." />);
    expect(screen.getByText("Nothing here yet.")).toBeTruthy();
  });

  it("links to /{type}/{slug} by default and honours hrefFor", () => {
    const { unmount } = wrap(<BlogList items={[post]} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe(`/blog/${post.slug}`);
    unmount();

    wrap(<BlogList items={[post]} hrefFor={(i) => `/writing/${i.slug}`} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe(`/writing/${post.slug}`);
  });
});

describe("BlogPost", () => {
  it("renders the sanitized body and the structured data script", () => {
    const { container } = wrap(<BlogPost slug={post.slug} content={post} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(post.title);
    expect(container.querySelector(".cms-article__body")?.innerHTML).toBe("<p>Body text.</p>");

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(script?.innerHTML ?? "{}")["@graph"][0]["@type"]).toBe("BlogPosting");
  });

  it("uses the cover image alt text from the fields", () => {
    wrap(<BlogPost slug={post.slug} content={post} />);
    expect(screen.getByAltText("A diagram")).toBeTruthy();
  });

  it("can omit structured data", () => {
    const { container } = wrap(
      <BlogPost slug={post.slug} content={post} includeStructuredData={false} />,
    );
    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
});

describe("FaqAccordion", () => {
  it("renders every question collapsed by default", () => {
    wrap(<FaqAccordion content={post} />);

    const triggers = screen.getAllByRole("button");
    expect(triggers).toHaveLength(2);
    for (const trigger of triggers) {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    }
  });

  it("wires aria-controls to the panel it toggles", () => {
    wrap(<FaqAccordion content={post} defaultOpen={0} />);

    const trigger = screen.getAllByRole("button")[0]!;
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    // useId produces colons, which are not valid in a CSS selector.
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!);
    expect(panel?.getAttribute("aria-labelledby")).toBe(trigger.id);
    expect(panel?.textContent).toContain("Because a retry looks like a first attempt.");
  });

  it("renders nothing when there are no FAQs", () => {
    const { container } = wrap(<FaqAccordion faqs={[]} />);
    expect(container.querySelector(".cms-faq")).toBeNull();
  });
});

describe("metadataFromContent", () => {
  it("maps the API's SEO block onto framework metadata", () => {
    const metadata = metadataFromContent(post);
    expect(metadata.title).toBe(post.seo.metaTitle);
    expect(metadata.alternates.canonical).toBe(post.seo.canonicalUrl);
    expect(metadata.openGraph.images).toEqual([post.seo.ogImage]);
    expect(metadata.twitter.card).toBe("summary_large_image");
  });
});

describe("CmsProvider", () => {
  it("tells you when a component is used outside the provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<BlogList type="blog" />)).toThrow(/CmsProvider/);
    quiet.mockRestore();
  });
});
