/** The shape `/api/v1/content` returns. Mirrors the server's SerializedContent. */
export interface CmsContent {
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
  faqs: { question: string; answer: string }[];
  status: string;
  author: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
  readingTime: number | null;
  structuredData: Record<string, unknown>;
}

export interface CmsListMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CmsListResult {
  data: CmsContent[];
  meta: CmsListMeta;
}

export interface CmsListQuery {
  type?: string;
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest" | "title";
}

/** Built-in looks. Every component also accepts a `className` for full control. */
export type DesignPreset = "minimal" | "magazine" | "documentation" | "marketing";

export class CmsApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "CmsApiError";
    this.status = status;
    this.code = code;
  }
}
