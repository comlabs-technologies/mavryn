import { prisma } from "@comlabs/cms-db";
import { MediaLibrary } from "@/components/media-library";
import { currentProvider } from "@/lib/media";
import { requireDashboardContext } from "@/lib/session";

export const metadata = { title: "Media" };
export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const context = await requireDashboardContext();

  const media = await prisma.media.findMany({
    where: { orgId: context.org.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Media</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Stored with the <code className="rounded bg-neutral-100 px-1.5 py-0.5">{currentProvider()}</code>{" "}
          provider. Change it with <code className="rounded bg-neutral-100 px-1.5 py-0.5">MEDIA_PROVIDER</code>.
        </p>
      </div>

      <MediaLibrary
        readOnly={context.role === "viewer"}
        initial={media.map((item) => ({
          id: item.id,
          url: item.url,
          filename: item.filename,
          size: item.size,
          createdAt: item.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
