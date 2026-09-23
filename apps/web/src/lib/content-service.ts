import {
  buildSeo,
  buildStructuredData,
  CmsError,
  contentUrl,
  type Faq,
  parseContentTypeSchema,
  readingTimeFromHtml,
  type SeoTemplate,
  slugify,
  uniqueSlug,
  submitToIndexNow,
  validateFields,
} from "@comlabs/cms-core";
import { sanitizeContentHtml } from "@comlabs/cms-core/server";
import {
  prisma,
  type Content,
  type ContentType,
  type Organization,
  type Prisma,
} from "@comlabs/cms-db";

export const CONTENT_STATUSES = ["draft", "published", "scheduled", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export interface OrgSettings {
  indexNowKey?: string;
  authorName?: string;
  logoUrl?: string;
}

export function orgSettings(org: Organization): OrgSettings {
  return (org.settings ?? {}) as OrgSettings;
}

function seoTemplate(type: ContentType): SeoTemplate {
  return (type.seoTemplate ?? {}) as SeoTemplate;
}

function asFaqs(value: unknown): Faq[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
    .map((f) => ({ question: String(f.question ?? ""), answer: String(f.answer ?? "") }))
    .filter((f) => f.question.trim() && f.answer.trim());
}

export async function resolveContentType(orgId: string, typeSlug: string): Promise<ContentType> {
  const type = await prisma.contentType.findUnique({
    where: { orgId_slug: { orgId, slug: typeSlug } },
  });
  if (!type) throw CmsError.notFound(`No content type "${typeSlug}" in this organization.`);
  return type;
}

// ---------------------------------------------------------------------------
// Serialization — the single shape the REST API, the SDK and MCP all speak.
// ---------------------------------------------------------------------------

export interface SerializedContent {
  id: string;
  type: string;
  typeName: string;
  title: string;
  slug: string;
  url: string;
  fields: Record<string, unknown>;
  seo: {
    metaTitle: string;
    metaDescription: string;
    excerpt: string;
    canonicalUrl: string;
    ogImage: string;
  };
  faqs: Faq[];
  status: string;
  author: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
  readingTime: number | null;
  structuredData: Record<string, unknown>;
}

export function serializeContent(
  content: Content,
  type: ContentType,
  org: Organization,
): SerializedContent {
  const template = seoTemplate(type);
  const url = contentUrl(org.domain, type.slug, content.slug, template.urlPattern);
  const faqs = asFaqs(content.faqs);
  const settings = orgSettings(org);

  return {
    id: content.id,
    type: type.slug,
    typeName: type.name,
    title: content.title,
    slug: content.slug,
    url,
    fields: (content.fields ?? {}) as Record<string, unknown>,
    seo: {
      metaTitle: content.metaTitle,
      metaDescription: content.metaDescription,
      excerpt: content.excerpt,
      canonicalUrl: content.canonicalUrl,
      ogImage: content.ogImage,
    },
    faqs,
    status: content.status,
    author: content.author,
    publishedAt: content.publishedAt?.toISOString() ?? null,
    scheduledAt: content.scheduledAt?.toISOString() ?? null,
    updatedAt: content.updatedAt.toISOString(),
    readingTime: content.readingTime,
    structuredData: buildStructuredData({
      title: content.title,
      description: content.metaDescription || content.excerpt,
      url: content.canonicalUrl || url,
      image: content.ogImage || undefined,
      author: content.author,
      publishedAt: content.publishedAt,
      updatedAt: content.updatedAt,
      faqs,
      orgName: org.name,
      orgDomain: org.domain,
      orgLogo: settings.logoUrl ?? null,
      typeSlug: type.slug,
      typeName: type.name,
    }),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface ListContentOptions {
  orgId: string;
  typeSlug?: string;
  /** Omit for the public API, which only ever returns published content. */
  status?: ContentStatus | "any";
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest" | "title";
}

export interface ListContentResult {
  items: (Content & { contentType: ContentType })[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export const MAX_PAGE_SIZE = 100;

export async function listContent(options: ListContentOptions): Promise<ListContentResult> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, options.limit ?? 20));

  const where: Prisma.ContentWhereInput = { orgId: options.orgId };
  if (options.typeSlug) where.contentType = { slug: options.typeSlug };
  if (options.status && options.status !== "any") where.status = options.status;
  if (options.search) {
    where.OR = [
      { title: { contains: options.search, mode: "insensitive" } },
      { excerpt: { contains: options.search, mode: "insensitive" } },
      { slug: { contains: options.search, mode: "insensitive" } },
    ];
  }
  // Tags live inside the JSON `fields` blob, so this is a containment check
  // rather than a column filter.
  if (options.tag) {
    where.fields = { path: ["tags"], array_contains: [options.tag] };
  }

  const orderBy: Prisma.ContentOrderByWithRelationInput =
    options.sort === "oldest"
      ? { publishedAt: "asc" }
      : options.sort === "title"
        ? { title: "asc" }
        : { publishedAt: "desc" };

  const [items, total] = await Promise.all([
    prisma.content.findMany({
      where,
      include: { contentType: true },
      orderBy: [orderBy, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.content.count({ where }),
  ]);

  return { items, total, page, limit, hasMore: page * limit < total };
}

export async function findContentBySlug(
  orgId: string,
  typeSlug: string | undefined,
  slug: string,
  options: { publishedOnly?: boolean } = {},
) {
  const content = await prisma.content.findFirst({
    where: {
      orgId,
      slug,
      ...(typeSlug ? { contentType: { slug: typeSlug } } : {}),
      ...(options.publishedOnly ? { status: "published" } : {}),
    },
    include: { contentType: true },
  });
  if (!content) throw CmsError.notFound(`No content with slug "${slug}".`);
  return content;
}

export async function findContentById(orgId: string, id: string) {
  const content = await prisma.content.findFirst({
    where: { orgId, id },
    include: { contentType: true },
  });
  if (!content) throw CmsError.notFound(`No content with id "${id}".`);
  return content;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface ContentWriteInput {
  title?: string;
  slug?: string;
  fields?: Record<string, unknown>;
  status?: ContentStatus;
  author?: string | null;
  scheduledAt?: string | null;
  faqs?: Faq[];
  metaTitle?: string;
  metaDescription?: string;
  excerpt?: string;
  canonicalUrl?: string;
  ogImage?: string;
}

export interface WriteResult {
  content: Content & { contentType: ContentType };
  /** Non-fatal notes, e.g. a rejected off-domain canonical. */
  warnings: string[];
}

function sanitizeRichText(
  fields: Record<string, unknown>,
  type: ContentType,
  org: Organization,
): Record<string, unknown> {
  const schema = parseContentTypeSchema(type.schema);
  const out = { ...fields };
  for (const field of schema.fields) {
    if (field.type === "richtext" && typeof out[field.key] === "string") {
      out[field.key] = sanitizeContentHtml(out[field.key] as string, { orgDomain: org.domain });
    }
  }
  return out;
}

async function nextSlug(
  orgId: string,
  contentTypeId: string,
  desired: string,
  excludeId?: string,
): Promise<string> {
  const taken = await prisma.content.findMany({
    where: { orgId, contentTypeId, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { slug: true },
  });
  return uniqueSlug(desired, taken.map((c) => c.slug));
}

function validateStatus(status: string | undefined): ContentStatus | undefined {
  if (status === undefined) return undefined;
  if (!(CONTENT_STATUSES as readonly string[]).includes(status)) {
    throw CmsError.badRequest(`Status must be one of: ${CONTENT_STATUSES.join(", ")}.`);
  }
  return status as ContentStatus;
}

export async function createContent(
  org: Organization,
  type: ContentType,
  input: ContentWriteInput,
): Promise<WriteResult> {
  const title = input.title?.trim();
  if (!title) throw CmsError.badRequest("A title is required.");

  const schema = parseContentTypeSchema(type.schema);
  const validated = validateFields(schema, input.fields ?? {});
  if (!validated.ok) {
    throw CmsError.badRequest("Some fields are invalid.", validated.errors);
  }

  const fields = sanitizeRichText(validated.value, type, org);
  const status = validateStatus(input.status) ?? "draft";
  const slug = await nextSlug(org.id, type.id, input.slug?.trim() || slugify(title));

  const seo = buildSeo({
    title,
    slug,
    typeSlug: type.slug,
    fields,
    template: seoTemplate(type),
    orgDomain: org.domain,
    overrides: input,
  });

  const template = seoTemplate(type);
  const body = fields[template.bodyField ?? "content"];

  const content = await prisma.content.create({
    data: {
      orgId: org.id,
      contentTypeId: type.id,
      title,
      slug,
      fields: fields as Prisma.InputJsonValue,
      status,
      author: input.author ?? orgSettings(org).authorName ?? null,
      publishedAt: status === "published" ? new Date() : null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      readingTime: typeof body === "string" ? readingTimeFromHtml(body) : null,
      faqs: (input.faqs ?? []) as unknown as Prisma.InputJsonValue,
      metaTitle: seo.metaTitle,
      metaDescription: seo.metaDescription,
      excerpt: seo.excerpt,
      canonicalUrl: seo.canonicalUrl,
      ogImage: seo.ogImage,
    },
    include: { contentType: true },
  });

  if (status === "published") await pingIndexNow(org, content, type);
  return { content, warnings: seo.warnings };
}

export async function updateContent(
  org: Organization,
  id: string,
  input: ContentWriteInput,
): Promise<WriteResult> {
  const existing = await findContentById(org.id, id);
  const type = existing.contentType;
  const schema = parseContentTypeSchema(type.schema);

  const mergedFields = { ...((existing.fields ?? {}) as Record<string, unknown>) };
  if (input.fields) {
    const validated = validateFields(schema, input.fields, { partial: true });
    if (!validated.ok) throw CmsError.badRequest("Some fields are invalid.", validated.errors);
    Object.assign(mergedFields, sanitizeRichText(validated.value, type, org));
  }

  const title = input.title?.trim() || existing.title;
  const status = validateStatus(input.status) ?? (existing.status as ContentStatus);
  const slug =
    input.slug && input.slug.trim() !== existing.slug
      ? await nextSlug(org.id, type.id, input.slug.trim(), existing.id)
      : existing.slug;

  // Re-derive SEO from the merged state, keeping any value the author has
  // already set on the record unless this request overrides it.
  const seo = buildSeo({
    title,
    slug,
    typeSlug: type.slug,
    fields: mergedFields,
    template: seoTemplate(type),
    orgDomain: org.domain,
    // A stored SEO value is treated as authored and kept; clearing a field in
    // the editor (sending "") hands it back to the generator.
    overrides: {
      metaTitle: input.metaTitle ?? existing.metaTitle,
      metaDescription: input.metaDescription ?? existing.metaDescription,
      excerpt: input.excerpt ?? existing.excerpt,
      canonicalUrl: input.canonicalUrl ?? existing.canonicalUrl,
      ogImage: input.ogImage ?? existing.ogImage,
    },
  });

  const template = seoTemplate(type);
  const body = mergedFields[template.bodyField ?? "content"];
  const goingLive = status === "published" && existing.status !== "published";

  const content = await prisma.content.update({
    where: { id: existing.id },
    data: {
      title,
      slug,
      fields: mergedFields as Prisma.InputJsonValue,
      status,
      author: input.author === undefined ? existing.author : input.author,
      publishedAt: goingLive ? new Date() : status === "published" ? existing.publishedAt : null,
      scheduledAt:
        input.scheduledAt === undefined
          ? existing.scheduledAt
          : input.scheduledAt
            ? new Date(input.scheduledAt)
            : null,
      readingTime: typeof body === "string" ? readingTimeFromHtml(body) : existing.readingTime,
      faqs: (input.faqs ?? (existing.faqs as unknown)) as Prisma.InputJsonValue,
      metaTitle: seo.metaTitle,
      metaDescription: seo.metaDescription,
      excerpt: seo.excerpt,
      canonicalUrl: seo.canonicalUrl,
      ogImage: seo.ogImage,
      version: { increment: 1 },
    },
    include: { contentType: true },
  });

  if (status === "published") await pingIndexNow(org, content, type);
  return { content, warnings: seo.warnings };
}

export async function deleteContent(orgId: string, id: string): Promise<void> {
  const existing = await findContentById(orgId, id);
  await prisma.content.delete({ where: { id: existing.id } });
}

async function pingIndexNow(org: Organization, content: Content, type: ContentType) {
  const settings = orgSettings(org);
  if (!settings.indexNowKey || !org.domain) return;
  const url = content.canonicalUrl || contentUrl(org.domain, type.slug, content.slug, seoTemplate(type).urlPattern);
  try {
    await submitToIndexNow({ key: settings.indexNowKey, orgDomain: org.domain, urls: [url] });
  } catch (error) {
    // Search-engine pings are an optimisation; never fail a publish over one.
    console.warn("[indexnow] submission failed", error);
  }
}

/**
 * Flip any scheduled content whose time has come. Called opportunistically from
 * the public list/feed endpoints so a self-hosted install needs no cron.
 */
export async function releaseDueScheduledContent(orgId: string): Promise<number> {
  const due = await prisma.content.updateMany({
    where: { orgId, status: "scheduled", scheduledAt: { lte: new Date() } },
    data: { status: "published", publishedAt: new Date() },
  });
  return due.count;
}
