import type {
  ContentTypeSchema,
  FieldDefinition,
  ScalarFieldType,
  SubFieldDefinition,
} from "./schema.js";

export interface FieldError {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; errors: FieldError[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceScalar(
  type: ScalarFieldType | "object" | "array",
  value: unknown,
  path: string,
  def: SubFieldDefinition,
  errors: FieldError[],
): unknown {
  switch (type) {
    case "string":
    case "richtext":
    case "markdown":
    case "media": {
      if (typeof value !== "string") {
        errors.push({ path, message: `Expected a string, received ${typeof value}.` });
        return undefined;
      }
      if (type === "media" && value && !/^(https?:\/\/|\/)/.test(value)) {
        errors.push({ path, message: "Media fields must hold an absolute URL or a root-relative path." });
        return undefined;
      }
      return value;
    }
    case "number": {
      const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
      if (typeof n !== "number" || Number.isNaN(n)) {
        errors.push({ path, message: "Expected a number." });
        return undefined;
      }
      return n;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;
      errors.push({ path, message: "Expected a boolean." });
      return undefined;
    }
    case "date": {
      if (value instanceof Date) return value.toISOString();
      if (typeof value !== "string") {
        errors.push({ path, message: "Expected an ISO-8601 date string." });
        return undefined;
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        errors.push({ path, message: `"${value}" is not a valid date.` });
        return undefined;
      }
      return parsed.toISOString();
    }
    case "tags": {
      if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
        errors.push({ path, message: "Expected an array of strings." });
        return undefined;
      }
      return [...new Set((value as string[]).map((v) => v.trim()).filter(Boolean))];
    }
    case "select": {
      if (typeof value !== "string" || !(def.options ?? []).includes(value)) {
        errors.push({
          path,
          message: `Expected one of: ${(def.options ?? []).join(", ") || "(no options configured)"}.`,
        });
        return undefined;
      }
      return value;
    }
    case "json":
      return value;
    default:
      errors.push({ path, message: `Unsupported field type "${type}".` });
      return undefined;
  }
}

function validateValue(
  def: SubFieldDefinition,
  value: unknown,
  path: string,
  errors: FieldError[],
): unknown {
  if (def.type === "object") {
    if (!isPlainObject(value)) {
      errors.push({ path, message: "Expected an object." });
      return undefined;
    }
    return validateShape(def.schema ?? {}, value, path, errors);
  }

  if (def.type === "array") {
    if (!Array.isArray(value)) {
      errors.push({ path, message: "Expected an array." });
      return undefined;
    }
    return value.map((item, i) => {
      const itemPath = `${path}[${i}]`;
      if (def.itemSchema) {
        if (!isPlainObject(item)) {
          errors.push({ path: itemPath, message: "Expected an object." });
          return undefined;
        }
        return validateShape(def.itemSchema, item, itemPath, errors);
      }
      return coerceScalar(def.itemType ?? "string", item, itemPath, def, errors);
    });
  }

  return coerceScalar(def.type, value, path, def, errors);
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

function validateShape(
  shape: Record<string, SubFieldDefinition>,
  input: Record<string, unknown>,
  prefix: string,
  errors: FieldError[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(shape)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const raw = input[key];
    if (isEmpty(raw)) {
      if (def.required) errors.push({ path, message: "This field is required." });
      continue;
    }
    const parsed = validateValue(def, raw, path, errors);
    if (parsed !== undefined) out[key] = parsed;
  }
  return out;
}

/**
 * Validate and coerce a content item's `fields` against its content type.
 *
 * Unknown keys are dropped rather than rejected: a client on an older schema
 * should not have its writes fail because the type gained a field.
 */
export function validateFields(
  schema: ContentTypeSchema,
  input: Record<string, unknown>,
  options: { partial?: boolean } = {},
): ValidationResult {
  const errors: FieldError[] = [];
  const out: Record<string, unknown> = {};

  for (const field of schema.fields as FieldDefinition[]) {
    const raw = input[field.key];
    if (isEmpty(raw)) {
      // On a partial update an absent key means "leave as-is", so a required
      // field is only enforced when the caller is writing the whole object.
      if (field.required && !(options.partial && !(field.key in input))) {
        errors.push({ path: field.key, message: `"${field.label ?? field.key}" is required.` });
      }
      if (field.key in input) out[field.key] = raw ?? "";
      continue;
    }
    const parsed = validateValue(field, raw, field.key, errors);
    if (parsed !== undefined) out[field.key] = parsed;
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: out };
}

/** Defaults for a brand-new content item of this type. */
export function emptyFields(schema: ContentTypeSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of schema.fields) {
    switch (field.type) {
      case "tags":
      case "array":
        out[field.key] = [];
        break;
      case "object":
        out[field.key] = {};
        break;
      case "boolean":
        out[field.key] = false;
        break;
      case "number":
        out[field.key] = 0;
        break;
      default:
        out[field.key] = "";
    }
  }
  return out;
}
