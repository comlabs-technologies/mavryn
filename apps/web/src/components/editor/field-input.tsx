"use client";

import type { FieldDefinition, SubFieldDefinition } from "@comlabs/cms-core";
import { RichTextEditor } from "./rich-text-editor";
import { MediaPicker } from "./media-picker";

/**
 * Render one field from its definition. Custom content types get a working
 * form for free — nothing here knows about blogs or case studies.
 */
export function FieldInput({
  definition,
  value,
  onChange,
  readOnly,
  uploadImage,
}: {
  definition: FieldDefinition;
  value: unknown;
  onChange: (next: unknown) => void;
  readOnly?: boolean;
  uploadImage: (file: File) => Promise<string>;
}) {
  const label = definition.label ?? definition.key;

  return (
    <div>
      <label className="label" htmlFor={`field-${definition.key}`}>
        {label}
        {definition.required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <FieldControl
        id={`field-${definition.key}`}
        definition={definition}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        uploadImage={uploadImage}
      />
      {definition.description && (
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">{definition.description}</p>
      )}
    </div>
  );
}

function FieldControl({
  id,
  definition,
  value,
  onChange,
  readOnly,
  uploadImage,
}: {
  id?: string;
  definition: SubFieldDefinition & { key?: string; placeholder?: string };
  value: unknown;
  onChange: (next: unknown) => void;
  readOnly?: boolean;
  uploadImage: (file: File) => Promise<string>;
}) {
  switch (definition.type) {
    case "richtext":
      return (
        <RichTextEditor
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          readOnly={readOnly}
          placeholder={definition.placeholder ?? "Start writing…"}
          onRequestUpload={uploadImage}
        />
      );

    case "markdown":
      return (
        <textarea
          id={id}
          rows={16}
          readOnly={readOnly}
          className="field font-mono text-[13px]"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case "media":
      return (
        <MediaPicker
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          readOnly={readOnly}
          uploadImage={uploadImage}
        />
      );

    case "tags": {
      const tags = Array.isArray(value) ? (value as string[]) : [];
      return (
        <input
          id={id}
          readOnly={readOnly}
          className="field"
          value={tags.join(", ")}
          placeholder="Comma separated"
          onChange={(event) =>
            onChange(
              event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            )
          }
        />
      );
    }

    case "boolean":
      return (
        <input
          id={id}
          type="checkbox"
          disabled={readOnly}
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-[var(--color-line)]"
        />
      );

    case "number":
      return (
        <input
          id={id}
          type="number"
          readOnly={readOnly}
          className="field"
          value={typeof value === "number" ? value : ""}
          onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
        />
      );

    case "date":
      return (
        <input
          id={id}
          type="datetime-local"
          readOnly={readOnly}
          className="field"
          value={typeof value === "string" && value ? value.slice(0, 16) : ""}
          onChange={(event) =>
            onChange(event.target.value ? new Date(event.target.value).toISOString() : "")
          }
        />
      );

    case "select":
      return (
        <select
          id={id}
          disabled={readOnly}
          className="field"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Choose…</option>
          {(definition.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );

    case "json":
      return (
        <textarea
          id={id}
          rows={6}
          readOnly={readOnly}
          className="field font-mono text-[13px]"
          defaultValue={JSON.stringify(value ?? null, null, 2)}
          onBlur={(event) => {
            try {
              onChange(JSON.parse(event.target.value || "null"));
            } catch {
              // Leave the previous value in place; the text stays for correction.
            }
          }}
        />
      );

    case "object": {
      const object = (value ?? {}) as Record<string, unknown>;
      return (
        <div className="grid gap-3 rounded-lg border border-[var(--color-line)] bg-neutral-50 p-3">
          {Object.entries(definition.schema ?? {}).map(([key, sub]) => (
            <div key={key}>
              <label className="label">{sub.label ?? key}{sub.required && <span className="ml-1 text-red-500">*</span>}</label>
              <FieldControl
                definition={sub}
                value={object[key]}
                onChange={(next) => onChange({ ...object, [key]: next })}
                readOnly={readOnly}
                uploadImage={uploadImage}
              />
            </div>
          ))}
        </div>
      );
    }

    case "array":
      return (
        <ArrayField
          definition={definition}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          readOnly={readOnly}
          uploadImage={uploadImage}
        />
      );

    default:
      return (
        <input
          id={id}
          readOnly={readOnly}
          className="field"
          placeholder={definition.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}

function ArrayField({
  definition,
  value,
  onChange,
  readOnly,
  uploadImage,
}: {
  definition: SubFieldDefinition;
  value: unknown[];
  onChange: (next: unknown[]) => void;
  readOnly?: boolean;
  uploadImage: (file: File) => Promise<string>;
}) {
  const blank = definition.itemSchema ? {} : "";

  const replace = (index: number, next: unknown) =>
    onChange(value.map((item, i) => (i === index ? next : item)));

  return (
    <div className="grid gap-2">
      {value.map((item, index) => (
        <div key={index} className="rounded-lg border border-[var(--color-line)] bg-neutral-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-muted)]">#{index + 1}</span>
            {!readOnly && (
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            )}
          </div>

          {definition.itemSchema ? (
            <div className="grid gap-3">
              {Object.entries(definition.itemSchema).map(([key, sub]) => (
                <div key={key}>
                  <label className="label">{sub.label ?? key}</label>
                  <FieldControl
                    definition={sub}
                    value={(item as Record<string, unknown>)?.[key]}
                    onChange={(next) =>
                      replace(index, { ...((item ?? {}) as Record<string, unknown>), [key]: next })
                    }
                    readOnly={readOnly}
                    uploadImage={uploadImage}
                  />
                </div>
              ))}
            </div>
          ) : (
            <FieldControl
              definition={{ type: definition.itemType ?? "string" }}
              value={item}
              onChange={(next) => replace(index, next)}
              readOnly={readOnly}
              uploadImage={uploadImage}
            />
          )}
        </div>
      ))}

      {!readOnly && (
        <button type="button" className="btn-secondary w-fit" onClick={() => onChange([...value, blank])}>
          Add item
        </button>
      )}
    </div>
  );
}
