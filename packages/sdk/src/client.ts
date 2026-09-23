import {
  CmsApiError,
  type CmsContent,
  type CmsListQuery,
  type CmsListResult,
} from "./types";

export interface CmsClientOptions {
  apiKey: string;
  /** e.g. "https://cms.example.com/api/v1" */
  baseUrl: string;
  /** Passed through to fetch, so Next.js callers can set revalidate tags. */
  fetchOptions?: RequestInit;
}

/**
 * Thin API client. Usable on its own in a server component or a route handler
 * when you want the data without the components.
 */
export class CmsClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchOptions: RequestInit;

  constructor(options: CmsClientOptions) {
    if (!options.apiKey) throw new Error("CmsClient requires an apiKey.");
    if (!options.baseUrl) throw new Error("CmsClient requires a baseUrl.");
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchOptions = options.fetchOptions ?? {};
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...this.fetchOptions,
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(this.fetchOptions.headers ?? {}),
        ...(init.headers ?? {}),
      },
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: { code: string; message: string } }
      | null;

    if (!response.ok) {
      throw new CmsApiError(
        response.status,
        payload?.error?.code ?? "request_failed",
        payload?.error?.message ?? `Request to ${path} failed with ${response.status}.`,
      );
    }
    return payload as T;
  }

  list(query: CmsListQuery = {}): Promise<CmsListResult> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    const search = params.toString();
    return this.request<CmsListResult>(`/content${search ? `?${search}` : ""}`);
  }

  async get(slug: string, type?: string): Promise<CmsContent> {
    const search = type ? `?type=${encodeURIComponent(type)}` : "";
    const result = await this.request<{ data: CmsContent }>(
      `/content/${encodeURIComponent(slug)}${search}`,
    );
    return result.data;
  }

  /** Absolute URL of the RSS feed, for a `<link rel="alternate">` tag. */
  feedUrl(type = "blog"): string {
    return `${this.baseUrl}/feed.xml?type=${encodeURIComponent(type)}&api_key=${encodeURIComponent(this.apiKey)}`;
  }

  async sitemapEntries(type?: string): Promise<
    { url: string; lastModified: string; changeFrequency: string; priority: number }[]
  > {
    const search = type ? `?type=${encodeURIComponent(type)}` : "";
    const result = await this.request<{ data: never[] }>(`/sitemap-entries${search}`);
    return result.data;
  }
}
