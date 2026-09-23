"use client";

import { useContentList } from "../use-content";
import type { CmsContent, DesignPreset } from "../types";

export interface BlogListProps {
  type?: string;
  tag?: string;
  search?: string;
  limit?: number;
  page?: number;
  design?: DesignPreset;
  className?: string;
  /** Build the href for a post. Defaults to `/{type}/{slug}`. */
  hrefFor?: (item: CmsContent) => string;
  /** Pre-fetched items, e.g. from a server component. Skips the client fetch. */
  items?: CmsContent[];
  emptyMessage?: string;
}

function defaultHref(item: CmsContent): string {
  return `/${item.type}/${item.slug}`;
}

function coverImage(item: CmsContent): string | null {
  const field = item.fields.coverImage;
  const url = typeof field === "string" && field ? field : item.seo.ogImage;
  return url || null;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Index of published content.
 *
 * `design` picks a preset layout; everything is class-named `cms-*` so a host
 * site can restyle it without forking the component.
 */
export function BlogList({
  type = "blog",
  tag,
  search,
  limit = 12,
  page = 1,
  design = "minimal",
  className,
  hrefFor = defaultHref,
  items,
  emptyMessage = "No posts yet.",
}: BlogListProps) {
  const state = useContentList(items ? null : { type, tag, search, limit, page });
  const resolved = items ?? state.data?.data ?? [];

  if (!items && state.loading) {
    return (
      <div className={`cms-list cms-list--${design} cms-list--loading ${className ?? ""}`.trim()}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="cms-card cms-card--skeleton" aria-hidden />
        ))}
        <span className="cms-sr-only">Loading posts…</span>
      </div>
    );
  }

  if (!items && state.error) {
    return (
      <p role="alert" className={`cms-error ${className ?? ""}`.trim()}>
        {state.error.message}
      </p>
    );
  }

  if (resolved.length === 0) {
    return <p className={`cms-empty ${className ?? ""}`.trim()}>{emptyMessage}</p>;
  }

  return (
    <ul className={`cms-list cms-list--${design} ${className ?? ""}`.trim()}>
      {resolved.map((item) => {
        const image = coverImage(item);
        const tags = Array.isArray(item.fields.tags) ? (item.fields.tags as string[]) : [];

        return (
          <li key={item.id} className="cms-card">
            <a href={hrefFor(item)} className="cms-card__link">
              {image && design !== "documentation" && (
                <img src={image} alt="" className="cms-card__image" loading="lazy" decoding="async" />
              )}
              <div className="cms-card__body">
                {tags.length > 0 && (
                  <p className="cms-card__tags">
                    {tags.slice(0, 3).map((t) => (
                      <span key={t} className="cms-tag">{t}</span>
                    ))}
                  </p>
                )}
                <h3 className="cms-card__title">{item.title}</h3>
                <p className="cms-card__excerpt">{item.seo.excerpt}</p>
                <p className="cms-card__meta">
                  {item.author && <span>{item.author}</span>}
                  {item.publishedAt && <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>}
                  {item.readingTime ? <span>{item.readingTime} min read</span> : null}
                </p>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
