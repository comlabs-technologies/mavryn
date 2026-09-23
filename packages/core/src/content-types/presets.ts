import type { SeoTemplate } from "../seo/auto-metadata";
import type { ContentTypeSchema } from "./schema";

export interface ContentTypePreset {
  name: string;
  slug: string;
  icon: string;
  schema: ContentTypeSchema;
  seoTemplate: SeoTemplate;
}

/** Blog post — the MVP content type, seeded for every new organization. */
export const BLOG_PRESET: ContentTypePreset = {
  name: "Blog Post",
  slug: "blog",
  icon: "📝",
  schema: {
    fields: [
      {
        key: "content",
        type: "richtext",
        label: "Body",
        required: true,
        description: "The article itself. HTML is sanitized and links are rewritten on save.",
      },
      {
        key: "summary",
        type: "string",
        label: "Summary",
        description: "One or two sentences. Used for the excerpt and meta description when set.",
        placeholder: "What will a reader take away from this post?",
      },
      { key: "coverImage", type: "media", label: "Cover Image" },
      { key: "coverImageAlt", type: "string", label: "Cover Image Alt Text" },
      { key: "tags", type: "tags", label: "Tags" },
    ],
  },
  seoTemplate: {
    bodyField: "content",
    imageField: "coverImage",
    summaryField: "summary",
    urlPattern: "/blog/:slug",
  },
};

/**
 * Case study — Phase 2 in the plan, seeded but not wired into the dashboard's
 * preset picker yet. It models the sectioned layout Comlabs uses today.
 */
export const CASE_STUDY_PRESET: ContentTypePreset = {
  name: "Case Study",
  slug: "case-study",
  icon: "📊",
  schema: {
    fields: [
      {
        key: "headline",
        type: "object",
        label: "Headline",
        schema: {
          before: { type: "string", label: "Before highlight" },
          highlight: { type: "string", label: "Highlighted words", required: true },
          after: { type: "string", label: "After highlight" },
        },
      },
      { key: "client", type: "string", label: "Client" },
      { key: "industry", type: "string", label: "Industry" },
      { key: "summary", type: "string", label: "Summary" },
      { key: "coverImage", type: "media", label: "Cover Image" },
      {
        key: "sections",
        type: "array",
        label: "Sections",
        itemSchema: {
          number: { type: "string", label: "Number" },
          title: { type: "string", label: "Title", required: true },
          paragraphs: { type: "array", itemType: "string", label: "Paragraphs" },
          image: { type: "media", label: "Image" },
        },
      },
      {
        key: "results",
        type: "array",
        label: "Results",
        itemSchema: {
          metric: { type: "string", label: "Metric", required: true },
          value: { type: "string", label: "Value", required: true },
        },
      },
      { key: "tags", type: "tags", label: "Tags" },
    ],
  },
  seoTemplate: {
    summaryField: "summary",
    imageField: "coverImage",
    urlPattern: "/work/:slug",
  },
};

export const BUILT_IN_PRESETS: ContentTypePreset[] = [BLOG_PRESET, CASE_STUDY_PRESET];
