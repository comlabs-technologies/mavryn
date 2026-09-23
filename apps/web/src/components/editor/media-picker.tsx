"use client";

import { useState } from "react";

export function MediaPicker({
  value,
  onChange,
  readOnly,
  uploadImage,
}: {
  value: string;
  onChange: (url: string) => void;
  readOnly?: boolean;
  uploadImage: (file: File) => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(file));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <input
          className="field"
          readOnly={readOnly}
          value={value}
          placeholder="https://… or upload"
          onChange={(event) => onChange(event.target.value)}
        />
        {!readOnly && (
          <label className="btn-secondary shrink-0 cursor-pointer">
            {busy ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </label>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="max-h-40 w-fit rounded-lg border border-[var(--color-line)] object-cover"
        />
      )}
    </div>
  );
}
