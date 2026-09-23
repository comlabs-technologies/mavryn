"use client";

import { SEO_LIMITS } from "@comlabs/cms-core";

export interface SeoValues {
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  canonicalUrl: string;
  ogImage: string;
}

function CharCount({ value, limit }: { value: string; limit: number }) {
  const over = value.length > limit;
  return (
    <span className={`text-xs tabular-nums ${over ? "text-red-600" : "text-[var(--color-muted)]"}`}>
      {value.length}/{limit}
    </span>
  );
}

/**
 * Every field here is optional. Left empty, the server generates it on save —
 * the placeholder shows what it will produce, so authors can see the result
 * before deciding to override it.
 */
export function SeoPanel({
  values,
  generated,
  onChange,
  readOnly,
}: {
  values: SeoValues;
  /** What auto-generation would produce right now, for placeholders. */
  generated: Pick<SeoValues, "metaTitle" | "metaDescription" | "excerpt" | "canonicalUrl">;
  onChange: (patch: Partial<SeoValues>) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="grid gap-4">
      <p className="text-xs text-[var(--color-muted)]">
        Leave a field empty to generate it from the content on save.
      </p>

      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="metaTitle">Meta title</label>
          <CharCount value={values.metaTitle || generated.metaTitle} limit={SEO_LIMITS.metaTitle} />
        </div>
        <input
          id="metaTitle"
          className="field"
          readOnly={readOnly}
          value={values.metaTitle}
          placeholder={generated.metaTitle}
          onChange={(event) => onChange({ metaTitle: event.target.value })}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="metaDescription">Meta description</label>
          <CharCount
            value={values.metaDescription || generated.metaDescription}
            limit={SEO_LIMITS.metaDescription}
          />
        </div>
        <textarea
          id="metaDescription"
          rows={3}
          className="field"
          readOnly={readOnly}
          value={values.metaDescription}
          placeholder={generated.metaDescription}
          onChange={(event) => onChange({ metaDescription: event.target.value })}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="excerpt">Excerpt</label>
          <CharCount value={values.excerpt || generated.excerpt} limit={SEO_LIMITS.excerpt} />
        </div>
        <textarea
          id="excerpt"
          rows={3}
          className="field"
          readOnly={readOnly}
          value={values.excerpt}
          placeholder={generated.excerpt}
          onChange={(event) => onChange({ excerpt: event.target.value })}
        />
      </div>

      <div>
        <label className="label" htmlFor="canonicalUrl">Canonical URL</label>
        <input
          id="canonicalUrl"
          className="field"
          readOnly={readOnly}
          value={values.canonicalUrl}
          placeholder={generated.canonicalUrl}
          onChange={(event) => onChange({ canonicalUrl: event.target.value })}
        />
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">
          Must stay on your own domain. A canonical pointing elsewhere is rejected on save.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="ogImage">Social image</label>
        <input
          id="ogImage"
          className="field"
          readOnly={readOnly}
          value={values.ogImage}
          placeholder="Defaults to the cover image"
          onChange={(event) => onChange({ ogImage: event.target.value })}
        />
      </div>

      <div className="rounded-lg border border-[var(--color-line)] bg-neutral-50 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Search preview
        </p>
        <p className="truncate text-xs text-green-800">
          {values.canonicalUrl || generated.canonicalUrl || "https://example.com/blog/…"}
        </p>
        <p className="truncate text-base text-blue-800">
          {values.metaTitle || generated.metaTitle || "Untitled"}
        </p>
        <p className="line-clamp-2 text-sm text-[var(--color-muted)]">
          {values.metaDescription || generated.metaDescription || "No description yet."}
        </p>
      </div>
    </div>
  );
}
