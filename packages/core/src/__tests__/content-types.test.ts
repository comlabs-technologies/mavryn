import { describe, expect, it } from "vitest";
import { BLOG_PRESET, CASE_STUDY_PRESET } from "../content-types/presets";
import { parseContentTypeSchema } from "../content-types/schema";
import { emptyFields, validateFields } from "../content-types/validate";
import { fieldsJsonSchema } from "../content-types/json-schema";
import { extractApiKey, generateApiKey, hasScope, hashApiKey, hashesMatch } from "../server";

describe("content type schema", () => {
  it("accepts both built-in presets", () => {
    expect(() => parseContentTypeSchema(BLOG_PRESET.schema)).not.toThrow();
    expect(() => parseContentTypeSchema(CASE_STUDY_PRESET.schema)).not.toThrow();
  });

  it("rejects duplicate field keys", () => {
    expect(() =>
      parseContentTypeSchema({
        fields: [
          { key: "a", type: "string" },
          { key: "a", type: "number" },
        ],
      }),
    ).toThrow(/Duplicate field key/);
  });

  it("rejects field keys that are not identifiers", () => {
    expect(() => parseContentTypeSchema({ fields: [{ key: "not a key", type: "string" }] })).toThrow();
  });
});

describe("validateFields", () => {
  const schema = parseContentTypeSchema(BLOG_PRESET.schema);

  it("reports missing required fields by label", () => {
    const result = validateFields(schema, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.message).toContain("Body");
  });

  it("coerces and de-duplicates tags", () => {
    const result = validateFields(schema, { content: "<p>x</p>", tags: ["A", "A", " B "] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tags).toEqual(["A", "B"]);
  });

  it("rejects a media field that is not a URL", () => {
    const result = validateFields(schema, { content: "<p>x</p>", coverImage: "not-a-url" });
    expect(result.ok).toBe(false);
  });

  it("drops unknown keys instead of failing the write", () => {
    const result = validateFields(schema, { content: "<p>x</p>", somethingNew: 42 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).not.toHaveProperty("somethingNew");
  });

  it("skips required checks for keys absent from a partial update", () => {
    const result = validateFields(schema, { tags: ["x"] }, { partial: true });
    expect(result.ok).toBe(true);
  });

  it("validates nested objects and arrays of objects", () => {
    const caseStudy = parseContentTypeSchema(CASE_STUDY_PRESET.schema);
    const good = validateFields(caseStudy, {
      headline: { highlight: "Shipped in 6 weeks" },
      sections: [{ title: "Discovery", paragraphs: ["We started with..."] }],
    });
    expect(good.ok).toBe(true);

    const bad = validateFields(caseStudy, { sections: [{ paragraphs: ["missing title"] }] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]?.path).toBe("sections[0].title");
  });

  it("produces type-appropriate defaults", () => {
    expect(emptyFields(schema)).toEqual({
      content: "",
      summary: "",
      coverImage: "",
      coverImageAlt: "",
      tags: [],
    });
  });
});

describe("fieldsJsonSchema", () => {
  it("marks required fields and keeps nesting", () => {
    const schema = fieldsJsonSchema(parseContentTypeSchema(CASE_STUDY_PRESET.schema));
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.headline?.type).toBe("object");
    expect((props.sections as { items: Record<string, unknown> }).items.type).toBe("object");
  });

  it("drops required entries for partial update tools", () => {
    const schema = fieldsJsonSchema(parseContentTypeSchema(BLOG_PRESET.schema), { allOptional: true });
    expect(schema.required).toBeUndefined();
  });
});

describe("api keys", () => {
  it("hashes the key and exposes only a short prefix", () => {
    const { key, keyHash, prefix } = generateApiKey();
    expect(key.startsWith("cm_live_")).toBe(true);
    expect(keyHash).toBe(hashApiKey(key));
    expect(prefix).toHaveLength("cm_live_".length + 8);
    expect(keyHash).not.toContain(key);
  });

  it("compares hashes without leaking length mismatches", () => {
    const a = hashApiKey("one");
    expect(hashesMatch(a, a)).toBe(true);
    expect(hashesMatch(a, hashApiKey("two"))).toBe(false);
    expect(hashesMatch(a, "")).toBe(false);
  });

  it("reads the key from the header or the query string", () => {
    const url = new URL("https://cms.test/api/v1/content?api_key=cm_live_q");
    expect(extractApiKey(new Headers({ authorization: "Bearer cm_live_h" }), url)).toBe("cm_live_h");
    expect(extractApiKey(new Headers(), url)).toBe("cm_live_q");
  });

  it("treats admin as implying write and write as implying read", () => {
    expect(hasScope(["admin"], "write")).toBe(true);
    expect(hasScope(["write"], "read")).toBe(true);
    expect(hasScope(["read"], "write")).toBe(false);
  });
});
