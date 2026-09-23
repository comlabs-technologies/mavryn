"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { buildSeo, type FieldDefinition, slugify } from "@comlabs/cms-core";
import { saveContent, type ActionState } from "@/lib/actions";
import { FaqBuilder, type FaqEntry } from "./faq-builder";
import { FieldInput } from "./field-input";
import { SeoPanel, type SeoValues } from "./seo-panel";

export interface EditorContentType {
  id: string;
  name: string;
  slug: string;
  fields: FieldDefinition[];
}

export interface EditorInitial {
  id: string | null;
  title: string;
  slug: string;
  status: string;
  author: string;
  scheduledAt: string | null;
  fields: Record<string, unknown>;
  faqs: FaqEntry[];
  seo: SeoValues;
}

const TABS = ["Content", "SEO", "FAQs"] as const;
type Tab = (typeof TABS)[number];

const initialState: ActionState = {};

export function ContentEditor({
  contentType,
  initial,
  orgDomain,
  readOnly,
}: {
  contentType: EditorContentType;
  initial: EditorInitial;
  orgDomain: string | null;
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveContent, initialState);
  const [tab, setTab] = useState<Tab>("Content");

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [status, setStatus] = useState(initial.status);
  const [author, setAuthor] = useState(initial.author);
  const [scheduledAt, setScheduledAt] = useState(initial.scheduledAt ?? "");
  const [fields, setFields] = useState(initial.fields);
  const [faqs, setFaqs] = useState<FaqEntry[]>(initial.faqs);
  const [seo, setSeo] = useState<SeoValues>(initial.seo);

  const effectiveSlug = slug || slugify(title);

  /**
   * Run the same generator the server will run, so the SEO tab shows exactly
   * what saving would produce rather than an approximation.
   */
  const generated = useMemo(
    () =>
      buildSeo({
        title: title || "Untitled",
        slug: effectiveSlug || "untitled",
        typeSlug: contentType.slug,
        fields,
        orgDomain,
        template: { urlPattern: `/${contentType.slug}/:slug` },
      }),
    [title, effectiveSlug, contentType.slug, fields, orgDomain],
  );

  async function uploadImage(file: File): Promise<string> {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/admin/media", { method: "POST", body });
    const payload = (await response.json()) as
      | { data: { url: string } }
      | { error: { message: string } };

    if (!response.ok || "error" in payload) {
      throw new Error("error" in payload ? payload.error.message : "Upload failed.");
    }
    return payload.data.url;
  }

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {/* Values edited through React state are submitted as hidden inputs. */}
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="type" value={contentType.slug} />
      <input type="hidden" name="fields" value={JSON.stringify(fields)} />
      <input type="hidden" name="faqs" value={JSON.stringify(faqs)} />
      <input type="hidden" name="metaTitle" value={seo.metaTitle} />
      <input type="hidden" name="metaDescription" value={seo.metaDescription} />
      <input type="hidden" name="excerpt" value={seo.excerpt} />
      <input type="hidden" name="canonicalUrl" value={seo.canonicalUrl} />
      <input type="hidden" name="ogImage" value={seo.ogImage} />
      <input type="hidden" name="status" value={status} />

      <div className="grid gap-4">
        <div className="flex items-center gap-3">
          <Link href="/content" className="text-sm text-[var(--color-muted)] hover:underline">
            ← Content
          </Link>
          <span className="text-sm text-[var(--color-muted)]">{contentType.name}</span>
        </div>

        <input
          name="title"
          required
          readOnly={readOnly}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          className="w-full border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight outline-none placeholder:text-neutral-300"
        />

        <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <span>/{contentType.slug}/</span>
          <input
            name="slug"
            readOnly={readOnly}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder={slugify(title) || "slug"}
            className="min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 outline-none hover:border-[var(--color-line)] focus:border-[var(--color-accent)]"
          />
        </div>

        {state.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="flex gap-1 border-b border-[var(--color-line)]">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === name
                  ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {name}
              {name === "FAQs" && faqs.length > 0 && (
                <span className="ml-1.5 text-xs text-[var(--color-muted)]">{faqs.length}</span>
              )}
            </button>
          ))}
        </div>

        {tab === "Content" && (
          <div className="grid gap-5">
            {contentType.fields.map((definition) => (
              <FieldInput
                key={definition.key}
                definition={definition}
                value={fields[definition.key]}
                readOnly={readOnly}
                uploadImage={uploadImage}
                onChange={(next) => setFields((current) => ({ ...current, [definition.key]: next }))}
              />
            ))}
          </div>
        )}

        {tab === "SEO" && (
          <SeoPanel
            values={seo}
            generated={generated}
            readOnly={readOnly}
            onChange={(patch) => setSeo((current) => ({ ...current, ...patch }))}
          />
        )}

        {tab === "FAQs" && <FaqBuilder value={faqs} onChange={setFaqs} readOnly={readOnly} />}
      </div>

      <aside className="grid h-fit gap-4 lg:sticky lg:top-6">
        <div className="card grid gap-4 p-4">
          <div>
            <label className="label" htmlFor="status-select">Status</label>
            <select
              id="status-select"
              className="field"
              disabled={readOnly}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {status === "scheduled" && (
            <div>
              <label className="label" htmlFor="scheduledAt">Publish at</label>
              <input
                id="scheduledAt"
                name="scheduledAt"
                type="datetime-local"
                className="field"
                readOnly={readOnly}
                value={scheduledAt ? scheduledAt.slice(0, 16) : ""}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </div>
          )}

          <div>
            <label className="label" htmlFor="author">Author</label>
            <input
              id="author"
              name="author"
              className="field"
              readOnly={readOnly}
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
            />
          </div>

          {!readOnly && (
            <button type="submit" className="btn-primary w-full" disabled={pending}>
              {pending ? "Saving…" : initial.id ? "Save changes" : "Create"}
            </button>
          )}
          {readOnly && (
            <p className="text-xs text-[var(--color-muted)]">
              Your role on this organization is view-only.
            </p>
          )}
        </div>

        {generated.warnings.length > 0 && (
          <div className="card border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {generated.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}
      </aside>
    </form>
  );
}
