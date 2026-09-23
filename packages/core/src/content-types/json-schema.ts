import type { ContentTypeSchema, SubFieldDefinition } from "./schema.js";

export type JsonSchema = Record<string, unknown>;

const SCALAR_JSON_SCHEMA: Record<string, JsonSchema> = {
  string: { type: "string" },
  richtext: { type: "string", description: "HTML markup." },
  markdown: { type: "string", description: "Markdown source." },
  number: { type: "number" },
  boolean: { type: "boolean" },
  date: { type: "string", format: "date-time" },
  media: { type: "string", description: "Absolute image URL." },
  tags: { type: "array", items: { type: "string" } },
  json: {},
};

function shapeToJsonSchema(shape: Record<string, SubFieldDefinition>): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const [key, def] of Object.entries(shape)) {
    properties[key] = fieldToJsonSchema(def);
    if (def.required) required.push(key);
  }
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

function fieldToJsonSchema(def: SubFieldDefinition): JsonSchema {
  const base: JsonSchema =
    def.type === "object"
      ? shapeToJsonSchema(def.schema ?? {})
      : def.type === "array"
        ? {
            type: "array",
            items: def.itemSchema
              ? shapeToJsonSchema(def.itemSchema)
              : (SCALAR_JSON_SCHEMA[def.itemType ?? "string"] ?? { type: "string" }),
          }
        : def.type === "select"
          ? { type: "string", enum: def.options ?? [] }
          : { ...(SCALAR_JSON_SCHEMA[def.type] ?? { type: "string" }) };

  if (def.label) base.title = def.label;
  return base;
}

/**
 * JSON Schema for a content type's `fields` object.
 *
 * This is what an MCP client sees as the shape of `create_<type>` /
 * `update_<type>` input, so it is generated from the same definition the
 * dashboard form and the REST validator use.
 */
export function fieldsJsonSchema(
  schema: ContentTypeSchema,
  options: { allOptional?: boolean } = {},
): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const field of schema.fields) {
    const node = fieldToJsonSchema(field);
    if (field.description) node.description = field.description;
    properties[field.key] = node;
    if (field.required && !options.allOptional) required.push(field.key);
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}
