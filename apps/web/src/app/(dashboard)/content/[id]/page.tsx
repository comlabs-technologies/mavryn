import { notFound } from "next/navigation";
import { parseContentTypeSchema } from "@comlabs/cms-core";
import { prisma } from "@comlabs/cms-db";
import { ContentEditor } from "@/components/editor/content-editor";
import { requireDashboardContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const content = await prisma.content.findUnique({ where: { id }, select: { title: true } });
  return { title: content?.title ?? "Content" };
}

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireDashboardContext();
  const { id } = await params;

  const content = await prisma.content.findFirst({
    where: { id, orgId: context.org.id },
    include: { contentType: true },
  });
  if (!content) notFound();

  const schema = parseContentTypeSchema(content.contentType.schema);

  return (
    <ContentEditor
      readOnly={context.role === "viewer"}
      contentType={{
        id: content.contentType.id,
        name: content.contentType.name,
        slug: content.contentType.slug,
        fields: schema.fields,
      }}
      orgDomain={context.org.domain}
      initial={{
        id: content.id,
        title: content.title,
        slug: content.slug,
        status: content.status,
        author: content.author ?? "",
        scheduledAt: content.scheduledAt?.toISOString() ?? null,
        fields: (content.fields ?? {}) as Record<string, unknown>,
        faqs: (content.faqs ?? []) as { question: string; answer: string }[],
        seo: {
          metaTitle: content.metaTitle,
          metaDescription: content.metaDescription,
          excerpt: content.excerpt,
          canonicalUrl: content.canonicalUrl,
          ogImage: content.ogImage,
        },
      }}
    />
  );
}
