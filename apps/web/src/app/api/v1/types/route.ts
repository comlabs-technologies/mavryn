import { authenticateApiRequest } from "@/lib/api-auth";
import { json, preflight, route } from "@/lib/http";
import { fieldsJsonSchema, parseContentTypeSchema } from "@comlabs/cms-core";
import { prisma } from "@comlabs/cms-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

/**
 * GET /api/v1/types — the org's content types and their field definitions.
 * Clients use the JSON Schema to build forms or validate before writing.
 */
export const GET = route(async (request) => {
  const { org } = await authenticateApiRequest(request, "read");

  const types = await prisma.contentType.findMany({
    where: { orgId: org.id },
    orderBy: [{ builtIn: "desc" }, { name: "asc" }],
  });

  return json({
    data: types.map((type) => {
      const schema = parseContentTypeSchema(type.schema);
      return {
        id: type.id,
        name: type.name,
        slug: type.slug,
        icon: type.icon,
        builtIn: type.builtIn,
        fields: schema.fields,
        fieldsSchema: fieldsJsonSchema(schema),
        seoTemplate: type.seoTemplate ?? {},
      };
    }),
  });
});
