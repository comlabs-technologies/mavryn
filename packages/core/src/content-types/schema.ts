import { z } from "zod";

/**
 * A content type describes its own fields as JSON. Everything downstream —
 * the dashboard form, REST validation, and the MCP tool input schemas — is
 * derived from this one definition, so adding a custom type needs no code.
 */

export const SCALAR_FIELD_TYPES = [
  "string",
  "richtext",
  "markdown",
  "number",
  "boolean",
  "date",
  "media",
  "tags",
  "select",
  "json",
] as const;

export const FIELD_TYPES = [...SCALAR_FIELD_TYPES, "object", "array"] as const;

export type FieldType = (typeof FIELD_TYPES)[number];
export type ScalarFieldType = (typeof SCALAR_FIELD_TYPES)[number];

/** A nested property inside an `object` field or an `array` item. */
export interface SubFieldDefinition {
  type: FieldType;
  label?: string;
  required?: boolean;
  options?: string[];
  /** For `object`. */
  schema?: Record<string, SubFieldDefinition>;
  /** For `array` of objects. */
  itemSchema?: Record<string, SubFieldDefinition>;
  /** For `array` of scalars. */
  itemType?: ScalarFieldType;
}

export interface FieldDefinition extends SubFieldDefinition {
  key: string;
  description?: string;
  /** Shown in the editor when the value is empty. */
  placeholder?: string;
}

export interface ContentTypeSchema {
  fields: FieldDefinition[];
}

const subFieldSchema: z.ZodType<SubFieldDefinition> = z.lazy(() =>
  z.object({
    type: z.enum(FIELD_TYPES),
    label: z.string().optional(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    schema: z.record(z.string(), subFieldSchema).optional(),
    itemSchema: z.record(z.string(), subFieldSchema).optional(),
    itemType: z.enum(SCALAR_FIELD_TYPES).optional(),
  }),
);

export const fieldDefinitionSchema: z.ZodType<FieldDefinition> = z.lazy(() =>
  z.object({
    key: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Field keys must be alphanumeric and start with a letter."),
    type: z.enum(FIELD_TYPES),
    label: z.string().optional(),
    description: z.string().optional(),
    placeholder: z.string().optional(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    schema: z.record(z.string(), subFieldSchema).optional(),
    itemSchema: z.record(z.string(), subFieldSchema).optional(),
    itemType: z.enum(SCALAR_FIELD_TYPES).optional(),
  }),
);

export const contentTypeSchema = z.object({
  fields: z.array(fieldDefinitionSchema).max(100),
});

/** Parse a `ContentType.schema` JSON column, throwing on anything malformed. */
export function parseContentTypeSchema(value: unknown): ContentTypeSchema {
  const parsed = contentTypeSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid content type schema: ${parsed.error.issues[0]?.message ?? "unknown error"}`);
  }
  const keys = new Set<string>();
  for (const field of parsed.data.fields) {
    if (keys.has(field.key)) throw new Error(`Duplicate field key "${field.key}".`);
    keys.add(field.key);
  }
  return parsed.data;
}

export const seoTemplateSchema = z
  .object({
    bodyField: z.string().optional(),
    imageField: z.string().optional(),
    summaryField: z.string().optional(),
    titleSuffix: z.string().optional(),
    urlPattern: z.string().optional(),
  })
  .strict();
