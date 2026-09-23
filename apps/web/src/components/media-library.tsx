"use client";

import { useState } from "react";

export interface MediaItem {
  id: string;
  url: string;
  filename: string;
  size: number;
  createdAt: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaLibrary({
  initial,
  readOnly,
}: {
  initial: MediaItem[];
  readOnly?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);

    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/media", { method: "POST", body });
      const payload = (await response.json()) as
        | { data: MediaItem }
        | { error: { message: string } };

      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error.message : `Could not upload ${file.name}.`);
        continue;
      }
      setItems((current) => [payload.data, ...current]);
    }
  }

  return (
    <div className="grid gap-4">
      {!readOnly && (
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void upload(event.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
            dragging ? "border-[var(--color-accent)] bg-blue-50" : "border-[var(--color-line)] bg-white"
          }`}
        >
          <p className="text-sm font-medium">Drop images here, or click to choose</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">PNG, JPEG, WebP, AVIF, GIF or SVG up to 10 MB</p>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => void upload(event.target.files)}
          />
        </label>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="card px-4 py-12 text-center text-sm text-[var(--color-muted)]">
          No images yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" className="h-32 w-full bg-neutral-50 object-cover" />
              <div className="p-2.5">
                <p className="truncate text-xs font-medium" title={item.filename}>
                  {item.filename}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">{formatSize(item.size)}</p>
                <button
                  type="button"
                  className="mt-2 w-full rounded border border-[var(--color-line)] px-2 py-1 text-xs hover:bg-neutral-50"
                  onClick={async () => {
                    await navigator.clipboard.writeText(new URL(item.url, window.location.origin).toString());
                    setCopied(item.id);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                >
                  {copied === item.id ? "Copied" : "Copy URL"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
