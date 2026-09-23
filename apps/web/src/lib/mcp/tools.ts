import {
  CmsError,
  fieldsJsonSchema,
  type JsonSchema,
  parseContentTypeSchema,
} from "@comlabs/cms-core";
import { prisma, type ContentType, type Organization } from "@comlabs/cms-db";
import {
  createContent,
  deleteContent,
  findContentById,
  findContentBySlug,
  listContent,
  serializeContent,
  updateContent,
  type ContentStatus,
} from "@/lib/content-service";
import { decodeBase64Image, uploadMedia, uploadMediaFromUrl } from "@/lib/media";

export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  /** Scope an API key must hold to call this tool. */
  scope: "read" | "write" | "admin";
  handler: (args: Record<string, unknown>, org: Organization) => Promise<unknown>;
}

/** `case-study` -> `case_study`, so tool names stay valid identifiers. */
function toolSuffix(typeSlug: string): string {
  return typeSlug.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const FAQ_SCHEMA: JsonSchema = {
  type: "array",
  description: "Questions and answers rendered as schema.org FAQPage.",
  items: {
    type: "object",
    properties: { question: { type: "string" }, answer: { type: "string" } },
    required: ["question", "answer"],
    additionalProperties: false,
  },
};

const SEO_PROPERTIES: Record<string, JsonSchema> = {
  metaTitle: { type: "string", description: "Leave empty to auto-generate from the title (60 chars)." },
  metaDescription: { type: "string", description: "Leave empty to auto-generate from the body (155 chars)." },
  excerpt: { type: "string", description: "Leave empty to auto-generate from the body (160 chars)." },
  canonicalUrl: { type: "string", description: "Must stay on the organization's own domain." },
  ogImage: { type: "string", description: "Defaults to the cover image." },
};

function str(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

function requireStr(args: Record<string, unknown>, key: string): string {
  const value = str(args, key);
  if (!value?.trim()) throw CmsError.badRequest(`"${key}" is required.`);
  return value.trim();
}

/** The six CRUD tools a single content type gets. */
function toolsForType(type: ContentType): McpTool[] {
  const suffix = toolSuffix(type.slug);
  const schema = parseContentTypeSchema(type.schema);
  const label = type.name.toLowerCase();

  const writeProperties: Record<string, JsonSchema> = {
    title: { type: "string" },
    slug: { type: "string", description: "Defaults to a slug derived from the title." },
    fields: fieldsJsonSchema(schema),
    status: { type: "string", enum: ["draft", "published", "scheduled", "archived"] },
    author: { type: "string" },
    scheduledAt: { type: "string", format: "date-time" },
    faqs: FAQ_SCHEMA,
    ...SEO_PROPERTIES,
  };

  return [
    {
      name: `list_${suffix}`,
      title: `List ${type.name}`,
      description: `List ${label} items, newest first. Filter by status, tag or a search term.`,
      scope: "read",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "published", "scheduled", "archived", "any"] },
          search: { type: "string" },
          tag: { type: "string" },
          limit: { type: "number", description: "1-100, default 20." },
          page: { type: "number", description: "1-based, default 1." },
        },
        additionalProperties: false,
      },
      handler: async (args, org) => {
        const result = await listContent({
          orgId: org.id,
          typeSlug: type.slug,
          status: (str(args, "status") as ContentStatus | "any" | undefined) ?? "any",
          search: str(args, "search"),
          tag: str(args, "tag"),
          limit: typeof args.limit === "number" ? args.limit : 20,
          page: typeof args.page === "number" ? args.page : 1,
        });
        return {
          total: result.total,
          page: result.page,
          hasMore: result.hasMore,
          // Summaries only — a full body per item would swamp the context window.
          items: result.items.map((item) => ({
            id: item.id,
            title: item.title,
            slug: item.slug,
            status: item.status,
            excerpt: item.excerpt,
            publishedAt: item.publishedAt?.toISOString() ?? null,
            updatedAt: item.updatedAt.toISOString(),
          })),
        };
      },
    },
    {
      name: `get_${suffix}`,
      title: `Get ${type.name}`,
      description: `Fetch one ${label} in full, by id or by slug.`,
      scope: "read",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" }, slug: { type: "string" } },
        additionalProperties: false,
      },
      handler: async (args, org) => {
        const id = str(args, "id");
        const slug = str(args, "slug");
        if (!id && !slug) throw CmsError.badRequest('Provide either "id" or "slug".');
        const content = id
          ? await findContentById(org.id, id)
          : await findContentBySlug(org.id, type.slug, slug!);
        return serializeContent(content, content.contentType, org);
      },
    },
    {
      name: `create_${suffix}`,
      title: `Create ${type.name}`,
      description:
        `Create a ${label}. Defaults to draft status. SEO fields left empty are generated ` +
        `automatically, HTML is sanitized, and external links are made nofollow.`,
      scope: "write",
      inputSchema: {
        type: "object",
        properties: writeProperties,
        required: ["title"],
        additionalProperties: false,
      },
      handler: async (args, org) => {
        const { content, warnings } = await createContent(org, type, {
          ...args,
          title: requireStr(args, "title"),
        });
        return { ...serializeContent(content, content.contentType, org), warnings };
      },
    },
    {
      name: `update_${suffix}`,
      title: `Update ${type.name}`,
      description: `Partially update a ${label}. Only the keys you send are changed.`,
      scope: "write",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          ...writeProperties,
          fields: fieldsJsonSchema(schema, { allOptional: true }),
        },
        required: ["id"],
        additionalProperties: false,
      },
      handler: async (args, org) => {
        const { content, warnings } = await updateContent(org, requireStr(args, "id"), args);
        return { ...serializeContent(content, content.contentType, org), warnings };
      },
    },
    {
      name: `publish_${suffix}`,
      title: `Publish ${type.name}`,
      description:
        `Set a ${label}'s status. Publishing stamps publishedAt and pings IndexNow ` +
        `when the organization has a key configured.`,
      scope: "write",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string", enum: ["draft", "published", "scheduled", "archived"] },
          scheduledAt: { type: "string", format: "date-time" },
        },
        required: ["id"],
        additionalProperties: false,
      },
      handler: async (args, org) => {
        const { content } = await updateContent(org, requireStr(args, "id"), {
          status: (str(args, "status") as ContentStatus | undefined) ?? "published",
          scheduledAt: str(args, "scheduledAt"),
        });
        return {
          id: content.id,
          slug: content.slug,
          status: content.status,
          publishedAt: content.publishedAt?.toISOString() ?? null,
        };
      },
    },
    {
      name: `delete_${suffix}`,
      title: `Delete ${type.name}`,
      description: `Permanently delete a ${label}. This cannot be undone.`,
      scope: "admin",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      handler: async (args, org) => {
        const id = requireStr(args, "id");
        await deleteContent(org.id, id);
        return { id, deleted: true };
      },
    },
  ];
}

const MEDIA_TOOLS: McpTool[] = [
  {
    name: "upload_image",
    title: "Upload image",
    description: "Upload an image from base64 data (or a data: URI) and return its hosted URL.",
    scope: "write",
    inputSchema: {
      type: "object",
      properties: {
        data: { type: "string", description: "Base64 payload, or a full data: URI." },
        filename: { type: "string" },
        contentType: { type: "string", description: "Defaults to image/png when not a data: URI." },
      },
      required: ["data"],
      additionalProperties: false,
    },
    handler: async (args, org) => {
      const decoded = decodeBase64Image(requireStr(args, "data"), str(args, "contentType"));
      const media = await uploadMedia({
        org,
        data: decoded.data,
        filename: str(args, "filename") ?? "upload",
        contentType: decoded.contentType,
      });
      return { id: media.id, url: media.url, size: media.size };
    },
  },
  {
    name: "upload_image_from_url",
    title: "Upload image from URL",
    description:
      "Copy a remote image into this organization's media library so published content " +
      "serves its own assets instead of hotlinking.",
    scope: "write",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
      additionalProperties: false,
    },
    handler: async (args, org) => {
      const media = await uploadMediaFromUrl(org, requireStr(args, "url"));
      return { id: media.id, url: media.url, size: media.size };
    },
  },
];

/**
 * Build the tool list for an organization.
 *
 * Every content type — built-in or custom — yields the same six CRUD tools,
 * with input schemas derived from its own field definitions. Adding a content
 * type in the dashboard therefore adds working MCP tools with no code change.
 */
export async function buildToolsForOrg(orgId: string): Promise<McpTool[]> {
  const types = await prisma.contentType.findMany({
    where: { orgId },
    orderBy: [{ builtIn: "desc" }, { name: "asc" }],
  });

  return [...types.flatMap(toolsForType), ...MEDIA_TOOLS];
}
