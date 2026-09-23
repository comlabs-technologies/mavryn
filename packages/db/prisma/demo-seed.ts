/**
 * Fill an organization with realistic dummy content, so a fresh install has
 * something to look at and demo.
 *
 *     pnpm db:demo            # fills the most recently created organization
 *     pnpm db:demo acme       # fills the organization with this slug
 *
 * Everything here is invented. Idempotent: re-running updates the same rows
 * rather than piling up duplicates, and it never touches content it did not
 * create (matched on slug).
 */
import {
  buildSeo,
  readingTimeFromHtml,
  type SeoTemplate,
} from "@comlabs/cms-core";
import { sanitizeContentHtml } from "@comlabs/cms-core/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { toJson } from "../src/index";

const prisma = new PrismaClient();

/**
 * Cover art, generated rather than downloaded so the seed pulls nothing from
 * the network. Only written when MEDIA_PROVIDER is `local` (the default) —
 * against Cloudinary or S3 the demo simply runs without cover images.
 */
const COVERS: { slug: string; from: string; to: string; label: string }[] = [
  { slug: "when-ai-agents-get-stuck-in-loops", from: "#1d4ed8", to: "#7c3aed", label: "Agents" },
  { slug: "cms-api-before-theme", from: "#0f766e", to: "#15803d", label: "Architecture" },
  { slug: "answer-engines-read-your-faqs", from: "#b45309", to: "#be123c", label: "AEO" },
  { slug: "multi-tenant-from-the-first-migration", from: "#334155", to: "#0f172a", label: "Postgres" },
  { slug: "shipping-an-mcp-server-to-production", from: "#7c3aed", to: "#1d4ed8", label: "MCP" },
  { slug: "field-guide-sanitizing-user-html", from: "#be123c", to: "#7c2d12", label: "Security" },
];

function coverSvg(from: string, to: string, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#g)"/>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="2">
    <circle cx="960" cy="150" r="150"/><circle cx="960" cy="150" r="230"/><circle cx="960" cy="150" r="310"/>
  </g>
  <text x="80" y="580" font-family="ui-sans-serif, system-ui, sans-serif" font-size="46"
        font-weight="600" fill="#ffffff" fill-opacity="0.92">${label}</text>
</svg>`;
}

/** Write the cover art and register it in the media library. */
async function seedCovers(orgId: string): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const provider = (process.env.MEDIA_PROVIDER ?? "local").toLowerCase();
  if (provider !== "local") {
    console.log(`MEDIA_PROVIDER is "${provider}" — skipping cover images.`);
    return urls;
  }

  // LOCAL_MEDIA_DIR is resolved against the current working directory, and this
  // script does not run from the same directory the server does. An unset value
  // therefore means "somewhere the app will not look", so say so loudly rather
  // than writing files nobody can serve.
  if (!process.env.LOCAL_MEDIA_DIR) {
    console.warn(
      "LOCAL_MEDIA_DIR is not set. Set it to the same absolute path the app uses,\n" +
        "otherwise the cover images will be written where the server cannot find them.",
    );
    return urls;
  }

  const root = path.resolve(process.env.LOCAL_MEDIA_DIR);
  console.log(`Writing cover images to ${root}`);

  for (const cover of COVERS) {
    const key = `${orgId}/demo-${cover.slug}.svg`;
    const target = path.join(root, key);
    const body = Buffer.from(coverSvg(cover.from, cover.to, cover.label), "utf8");

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);

    const url = `/uploads/${key}`;
    urls.set(cover.slug, url);

    const existing = await prisma.media.findFirst({ where: { orgId, url } });
    if (!existing) {
      await prisma.media.create({
        data: {
          orgId,
          url,
          filename: `${cover.slug}.svg`,
          contentType: "image/svg+xml",
          size: body.byteLength,
          provider: "local",
        },
      });
    }
  }

  return urls;
}

interface DemoPost {
  title: string;
  slug: string;
  status: "published" | "draft" | "scheduled";
  summary: string;
  tags: string[];
  body: string;
  faqs?: { question: string; answer: string }[];
  /** Days before now. Negative means the future, for scheduled posts. */
  daysAgo?: number;
}

const POSTS: DemoPost[] = [
  {
    title: "When AI Agents Get Stuck in Loops",
    slug: "when-ai-agents-get-stuck-in-loops",
    status: "published",
    daysAgo: 3,
    summary: "Repeated tool failures are a signal to escalate, not to retry.",
    tags: ["Agents", "Reliability"],
    body: `
<p>Agents get stuck for a boring reason: a tool keeps returning the same error, and nothing in the loop treats the second failure differently from the first.</p>
<h2>Detect the repeat, not the error</h2>
<p>The fix is not better error messages. It is remembering what you already tried. Hash the tool call together with its result; when the same pair comes back twice, escalate instead of retrying.</p>
<blockquote><p>A retry is indistinguishable from a first attempt unless you track what you already tried.</p></blockquote>
<h2>Escalation beats retry</h2>
<p>Escalating can mean asking the user, switching strategy, or stopping with a clear report. All three beat a third identical call.</p>
<pre><code>if (seen.has(fingerprint(call, result))) {
  return escalate(call, result);
}</code></pre>
<p>The <a href="https://modelcontextprotocol.io">MCP specification</a> describes how tool results are shaped, which is what makes fingerprinting them practical.</p>`,
    faqs: [
      {
        question: "Why do agents loop instead of stopping?",
        answer:
          "Because nothing in a plain retry loop distinguishes a repeated failure from a first attempt. Without memory of prior calls, the second attempt looks exactly as promising as the first.",
      },
      {
        question: "How many retries is the right number?",
        answer:
          "Retry count is the wrong control. Retry once on a transient error, then change something — the strategy, the tool, or who is being asked.",
      },
    ],
  },
  {
    title: "Your CMS Should Have an API Before It Has a Theme",
    slug: "cms-api-before-theme",
    status: "published",
    daysAgo: 9,
    summary:
      "Content that only exists inside a template is content you cannot reuse, syndicate or hand to a model.",
    tags: ["Product", "Architecture"],
    body: `
<p>Most content tools start from the page and work backwards. That gets you a nice-looking site and a dead end.</p>
<h2>Templates are a rendering choice</h2>
<p>The moment you want the same post in an app, a newsletter, a feed and an answer engine, the template stops being the content and starts being one of several outputs.</p>
<h2>Structure is what survives</h2>
<p>A post with typed fields can be rendered four ways. A post that exists as a blob of theme markup can be rendered one way, forever.</p>
<ul>
<li>Typed fields validate on the way in, not on the way out.</li>
<li>Structured data comes almost free once fields are typed.</li>
<li>An agent can write to typed fields; it cannot safely write to a theme.</li>
</ul>`,
    faqs: [
      {
        question: "Does this mean headless is always right?",
        answer:
          "No. It means the API should exist first. A rendering layer on top of a clean API is easy; an API retrofitted onto a template system rarely is.",
      },
    ],
  },
  {
    title: "Answer Engines Read Your FAQs, Not Your Keywords",
    slug: "answer-engines-read-your-faqs",
    status: "published",
    daysAgo: 21,
    summary:
      "Structured question-and-answer pairs are the most directly quotable thing on a page.",
    tags: ["AEO", "SEO"],
    body: `
<p>Keyword density was a proxy for relevance in an era when machines could not read. They can read now.</p>
<h2>Be quotable</h2>
<p>A question with a direct two-sentence answer is the easiest thing on a page to lift into a response. Burying the same answer in paragraph nine of a listicle does not make it more valuable, only harder to find.</p>
<h2>Mark it up</h2>
<p>Publishing questions as <code>schema.org/FAQPage</code> makes the structure explicit rather than something a parser has to infer from your heading levels.</p>`,
    faqs: [
      {
        question: "What is answer engine optimization?",
        answer:
          "Structuring content so that a model answering a question can find, quote and attribute a specific passage — rather than optimizing for a ranked list of links.",
      },
      {
        question: "Do FAQ schema markup and rich results still matter?",
        answer:
          "The rich result is a bonus. The structure is the point: it is what makes an answer extractable whether or not it ever renders as a card.",
      },
    ],
  },
  {
    title: "Multi-Tenant From the First Migration",
    slug: "multi-tenant-from-the-first-migration",
    status: "published",
    daysAgo: 34,
    summary:
      "Retrofitting tenancy means touching every query you have ever written. Starting with it costs one column.",
    tags: ["Architecture", "Postgres"],
    body: `
<p>Single-tenant is a decision that looks free and is not. Every query you write without a tenant scope is a query you will rewrite later, under time pressure, with production data at stake.</p>
<h2>One column, from the start</h2>
<p>An <code>orgId</code> on every tenant-scoped table, present in every index that matters, is close to free on day one.</p>
<h2>Configuration is not code</h2>
<p>Site name, domain, brand colours and integration keys belong in a settings column, not in a constants file. The moment there are two tenants, a constants file is a bug.</p>`,
  },
  {
    title: "What We Learned Shipping an MCP Server to Production",
    slug: "shipping-an-mcp-server-to-production",
    status: "draft",
    daysAgo: 1,
    summary:
      "Stateless beats session-based when your server has to survive a serverless runtime.",
    tags: ["MCP", "Agents"],
    body: `
<p>The tempting design is a long-lived session per client. The design that actually deploys is a request that carries everything it needs.</p>
<h2>Statelessness is a deployment decision</h2>
<p>A stateless endpoint runs anywhere: one box, twenty boxes, or a function that is cold most of the day. A session-based one needs shared storage before it needs anything else.</p>
<p><em>Draft — needs a section on scope filtering before this goes out.</em></p>`,
  },
  {
    title: "A Field Guide to Sanitizing User HTML",
    slug: "field-guide-sanitizing-user-html",
    status: "scheduled",
    daysAgo: -4,
    summary:
      "Scripts are the obvious threat. Injected robots directives are the one that quietly costs you traffic.",
    tags: ["Security", "SEO"],
    body: `
<p>Everyone strips <code>&lt;script&gt;</code>. Fewer people strip a pasted <code>&lt;meta name="robots" content="noindex"&gt;</code>, which will happily de-index the page it lands on.</p>
<h2>Allowlist, never blocklist</h2>
<p>Name the tags and attributes you permit. Anything you forgot is then merely absent rather than exploitable.</p>
<h2>Rewrite links while you are there</h2>
<p>Sanitizing is the one point where you already parse every link, which makes it the cheapest place to mark external ones <code>nofollow noopener</code>.</p>`,
  },
];

const CASE_STUDY = {
  title: "Northwind Analytics: 40 Posts Migrated in an Afternoon",
  slug: "northwind-analytics-migration",
  fields: {
    headline: {
      before: "Northwind moved their entire blog",
      highlight: "in a single afternoon",
      after: "without touching their front end",
    },
    client: "Northwind Analytics",
    industry: "B2B SaaS",
    summary:
      "A forty-post archive moved out of hand-written TypeScript files and into a database, with SEO metadata generated rather than retyped.",
    sections: [
      {
        number: "01",
        title: "The problem",
        paragraphs: [
          "Every post lived in a TypeScript file. Publishing meant a pull request, a review and a deploy.",
          "Meta descriptions were written by hand, which meant half of them were missing and the other half were the first sentence of the post.",
        ],
      },
      {
        number: "02",
        title: "The migration",
        paragraphs: [
          "A script read the existing files and posted each one through the REST API.",
          "SEO fields were left empty on purpose, so the engine generated them from the body — forty descriptions in one pass.",
        ],
      },
      {
        number: "03",
        title: "The result",
        paragraphs: [
          "Publishing is now a dashboard action, and their writers stopped needing a git client.",
        ],
      },
    ],
    results: [
      { metric: "Posts migrated", value: "40" },
      { metric: "Time to migrate", value: "1 afternoon" },
      { metric: "Meta descriptions written by hand", value: "0" },
    ],
    tags: ["Migration", "Case Study"],
  },
};

async function main() {
  const wantedSlug = process.argv[2];

  const org = wantedSlug
    ? await prisma.organization.findUnique({ where: { slug: wantedSlug } })
    : await prisma.organization.findFirst({ orderBy: { createdAt: "desc" } });

  if (!org) {
    console.error(
      wantedSlug
        ? `No organization with slug "${wantedSlug}".`
        : "No organizations exist yet. Sign up first, then run this again.",
    );
    process.exitCode = 1;
    return;
  }

  const blogType = await prisma.contentType.findUnique({
    where: { orgId_slug: { orgId: org.id, slug: "blog" } },
  });
  if (!blogType) {
    console.error(`Organization "${org.slug}" has no "blog" content type.`);
    process.exitCode = 1;
    return;
  }

  const author = "Ada Okafor";
  const covers = await seedCovers(org.id);

  for (const post of POSTS) {
    const cover = covers.get(post.slug) ?? "";
    const fields = {
      content: sanitizeContentHtml(post.body.trim(), { orgDomain: org.domain }),
      summary: post.summary,
      coverImage: cover,
      coverImageAlt: cover ? `${post.title} cover image` : "",
      tags: post.tags,
    };

    const seo = buildSeo({
      title: post.title,
      slug: post.slug,
      typeSlug: "blog",
      fields,
      template: (blogType.seoTemplate ?? {}) as SeoTemplate,
      orgDomain: org.domain,
    });

    const offsetDays = post.daysAgo ?? 0;
    const when = new Date(Date.now() - offsetDays * 86_400_000);

    const common = {
      title: post.title,
      fields: toJson(fields),
      status: post.status,
      author,
      publishedAt: post.status === "published" ? when : null,
      scheduledAt: post.status === "scheduled" ? when : null,
      readingTime: readingTimeFromHtml(fields.content),
      faqs: toJson(post.faqs ?? []),
      metaTitle: seo.metaTitle,
      metaDescription: seo.metaDescription,
      excerpt: seo.excerpt,
      canonicalUrl: seo.canonicalUrl,
      ogImage: seo.ogImage,
    };

    await prisma.content.upsert({
      where: {
        orgId_contentTypeId_slug: { orgId: org.id, contentTypeId: blogType.id, slug: post.slug },
      },
      update: common,
      create: { orgId: org.id, contentTypeId: blogType.id, slug: post.slug, ...common },
    });
  }

  const caseStudyType = await prisma.contentType.findUnique({
    where: { orgId_slug: { orgId: org.id, slug: "case-study" } },
  });

  if (caseStudyType) {
    const seo = buildSeo({
      title: CASE_STUDY.title,
      slug: CASE_STUDY.slug,
      typeSlug: "case-study",
      fields: CASE_STUDY.fields,
      template: (caseStudyType.seoTemplate ?? {}) as SeoTemplate,
      orgDomain: org.domain,
    });

    const common = {
      title: CASE_STUDY.title,
      fields: toJson(CASE_STUDY.fields),
      status: "published",
      author,
      publishedAt: new Date(Date.now() - 14 * 86_400_000),
      faqs: toJson([]),
      metaTitle: seo.metaTitle,
      metaDescription: seo.metaDescription,
      excerpt: seo.excerpt,
      canonicalUrl: seo.canonicalUrl,
      ogImage: seo.ogImage,
    };

    await prisma.content.upsert({
      where: {
        orgId_contentTypeId_slug: {
          orgId: org.id,
          contentTypeId: caseStudyType.id,
          slug: CASE_STUDY.slug,
        },
      },
      update: common,
      create: {
        orgId: org.id,
        contentTypeId: caseStudyType.id,
        slug: CASE_STUDY.slug,
        ...common,
      },
    });
  }

  const [total, images] = await Promise.all([
    prisma.content.count({ where: { orgId: org.id } }),
    prisma.media.count({ where: { orgId: org.id } }),
  ]);
  console.log(`Filled "${org.name}" (${org.slug}) — ${total} content items, ${images} images.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
