/**
 * Seed a demo organization so a fresh install has something to look at.
 *
 * Idempotent: re-running updates the demo rows rather than duplicating them.
 * It never touches an org it did not create (matched on slug "demo").
 */
import {
  BUILT_IN_PRESETS,
  buildSeo,
  generateIndexNowKey,
  readingTimeFromHtml,
} from "@comlabs/cms-core";
import { generateApiKey, sanitizeContentHtml } from "@comlabs/cms-core/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_SLUG = "demo";
const DEMO_DOMAIN = "https://demo.example.com";

const DEMO_POST_HTML = `
<p>Agents get stuck in loops for a boring reason: a tool keeps returning the same
error, and nothing in the loop treats a repeated failure differently from a first one.</p>
<h2>Detect the repeat, not the error</h2>
<p>The fix is not better error messages. It is remembering what you already tried.
Hash the tool call and its result; when the same pair comes back twice, escalate
instead of retrying.</p>
<h2>Escalation beats retry</h2>
<p>Escalating can mean asking the user, switching strategy, or stopping with a
clear report. All three are better than a third identical call.</p>
<p>See the <a href="https://modelcontextprotocol.io">MCP specification</a> for how
tool results are shaped.</p>
`.trim();

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: DEMO_SLUG },
    update: { domain: DEMO_DOMAIN },
    create: {
      name: "Demo Organization",
      slug: DEMO_SLUG,
      domain: DEMO_DOMAIN,
      plan: "free",
      settings: { indexNowKey: generateIndexNowKey(), authorName: "Demo Team" },
    },
  });

  for (const preset of BUILT_IN_PRESETS) {
    await prisma.contentType.upsert({
      where: { orgId_slug: { orgId: org.id, slug: preset.slug } },
      update: {
        name: preset.name,
        icon: preset.icon,
        schema: preset.schema,
        seoTemplate: preset.seoTemplate,
      },
      create: {
        orgId: org.id,
        name: preset.name,
        slug: preset.slug,
        builtIn: true,
        icon: preset.icon,
        schema: preset.schema,
        seoTemplate: preset.seoTemplate,
      },
    });
  }

  const blogType = await prisma.contentType.findUniqueOrThrow({
    where: { orgId_slug: { orgId: org.id, slug: "blog" } },
  });

  const title = "When AI Agents Get Stuck in Loops";
  const slug = "when-ai-agents-get-stuck-in-loops";
  const fields = {
    content: sanitizeContentHtml(DEMO_POST_HTML, { orgDomain: org.domain }),
    summary: "Repeated tool failures are a signal to escalate, not to retry.",
    coverImage: "",
    coverImageAlt: "",
    tags: ["Agents", "Reliability"],
  };

  const seo = buildSeo({
    title,
    slug,
    typeSlug: "blog",
    fields,
    template: blogType.seoTemplate as Record<string, string>,
    orgDomain: org.domain,
  });

  await prisma.content.upsert({
    where: { orgId_contentTypeId_slug: { orgId: org.id, contentTypeId: blogType.id, slug } },
    update: { fields, ...toSeoColumns(seo) },
    create: {
      orgId: org.id,
      contentTypeId: blogType.id,
      title,
      slug,
      fields,
      status: "published",
      author: "Demo Team",
      publishedAt: new Date(),
      readingTime: readingTimeFromHtml(fields.content),
      faqs: [
        {
          question: "Why do agents loop?",
          answer: "Because a retry is indistinguishable from a first attempt unless you track what you already tried.",
        },
      ],
      ...toSeoColumns(seo),
    },
  });

  // Only mint a demo key when the org has none, so re-seeding does not pile
  // up unusable keys.
  const existingKeys = await prisma.apiKey.count({ where: { orgId: org.id } });
  if (existingKeys === 0) {
    const generated = generateApiKey();
    await prisma.apiKey.create({
      data: {
        orgId: org.id,
        name: "Seed key",
        keyHash: generated.keyHash,
        prefix: generated.prefix,
        scopes: ["read", "write"],
      },
    });
    console.log(`\n  Demo API key (shown once): ${generated.key}\n`);
  }

  console.log(`Seeded organization "${org.name}" (${org.slug}) with ${BUILT_IN_PRESETS.length} content types.`);
}

function toSeoColumns(seo: ReturnType<typeof buildSeo>) {
  return {
    metaTitle: seo.metaTitle,
    metaDescription: seo.metaDescription,
    excerpt: seo.excerpt,
    canonicalUrl: seo.canonicalUrl,
    ogImage: seo.ogImage,
  };
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

