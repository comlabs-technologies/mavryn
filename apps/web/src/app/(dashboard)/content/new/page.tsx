import { notFound } from "next/navigation";
import { emptyFields, parseContentTypeSchema } from "@comlabs/cms-core";
import { prisma } from "@comlabs/cms-db";
import { ContentEditor } from "@/components/editor/content-editor";
import { orgSettings } from "@/lib/content-service";
import { requireDashboardContext } from "@/lib/session";

export const metadata = { title: "New content" };
export const dynamic = "force-dynamic";

export default async function NewContentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const context = await requireDashboardContext();
  const { type: typeSlug } = await searchParams;

  const type = await prisma.contentType.findFirst({
    where: { orgId: context.org.id, ...(typeSlug ? { slug: typeSlug } : { slug: "blog" }) },
  });
  if (!type) notFound();

  const schema = parseContentTypeSchema(type.schema);

  return (
    <ContentEditor
      readOnly={context.role === "viewer"}
      contentType={{ id: type.id, name: type.name, slug: type.slug, fields: schema.fields }}
      orgDomain={context.org.domain}
      initial={{
        id: null,
        title: "",
        slug: "",
        status: "draft",
        author: orgSettings(context.org).authorName ?? context.userName,
        scheduledAt: null,
        fields: emptyFields(schema),
        faqs: [],
        seo: { metaTitle: "", metaDescription: "", excerpt: "", canonicalUrl: "", ogImage: "" },
      }}
    />
  );
}
