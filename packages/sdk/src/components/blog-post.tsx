"use client";

import { useContent } from "../use-content";
import { ContentSeo } from "./content-seo";
import type { CmsContent, DesignPreset } from "../types";

export interface BlogPostProps {
  slug: string;
  type?: string;
  design?: DesignPreset;
  className?: string;
  /** Pre-fetched item, e.g. from a server component. Skips the client fetch. */
  content?: CmsContent;
  /** Emit the JSON-LD script alongside the article. On by default. */
  includeStructuredData?: boolean;
}

/**
 * A full article.
 *
 * The body HTML has already been sanitized server-side on save — scripts
 * removed, external links marked nofollow — which is what makes
 * `dangerouslySetInnerHTML` the right call here rather than a parser.
 */
export function BlogPost({
  slug,
  type = "blog",
  design = "minimal",
  className,
  content,
  includeStructuredData = true,
}: BlogPostProps) {
  const state = useContent(content ? "" : slug, type);
  const item = content ?? state.data;

  if (!content && state.loading) {
    return <div className="cms-article cms-article--skeleton" aria-busy="true" />;
  }
  if (!content && state.error) {
    return <p role="alert" className="cms-error">{state.error.message}</p>;
  }
  if (!item) return null;

  const body = typeof item.fields.content === "string" ? item.fields.content : "";
  const cover = typeof item.fields.coverImage === "string" ? item.fields.coverImage : "";
  const coverAlt = typeof item.fields.coverImageAlt === "string" ? item.fields.coverImageAlt : "";

  return (
    <article className={`cms-article cms-article--${design} ${className ?? ""}`.trim()}>
      {includeStructuredData && <ContentSeo content={item} />}

      <header className="cms-article__header">
        <h1 className="cms-article__title">{item.title}</h1>
        <p className="cms-article__meta">
          {item.author && <span>{item.author}</span>}
          {item.publishedAt && (
            <time dateTime={item.publishedAt}>
              {new Date(item.publishedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          )}
          {item.readingTime ? <span>{item.readingTime} min read</span> : null}
        </p>
      </header>

      {cover && <img src={cover} alt={coverAlt} className="cms-article__cover" />}

      <div className="cms-article__body" dangerouslySetInnerHTML={{ __html: body }} />
    </article>
  );
}
