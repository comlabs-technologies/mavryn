import Link from "next/link";
import { prisma } from "@comlabs/cms-db";
import { requireDashboardContext } from "@/lib/session";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { org } = await requireDashboardContext();

  const [byStatus, types, recent, mediaCount, keyCount] = await Promise.all([
    prisma.content.groupBy({ by: ["status"], where: { orgId: org.id }, _count: true }),
    prisma.contentType.findMany({ where: { orgId: org.id }, orderBy: { name: "asc" } }),
    prisma.content.findMany({
      where: { orgId: org.id },
      include: { contentType: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.media.count({ where: { orgId: org.id } }),
    prisma.apiKey.count({ where: { orgId: org.id } }),
  ]);

  const count = (status: string) => byStatus.find((row) => row.status === status)?._count ?? 0;
  const stats = [
    { label: "Published", value: count("published") },
    { label: "Drafts", value: count("draft") },
    { label: "Scheduled", value: count("scheduled") },
    { label: "Images", value: mediaCount },
  ];

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{org.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {org.domain ?? "No website configured yet"}
          </p>
        </div>
        <Link href="/content/new?type=blog" className="btn-primary">
          New blog post
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
          <h2 className="text-sm font-semibold">Recently edited</h2>
          <Link href="/content" className="text-sm text-[var(--color-accent)] hover:underline">
            All content
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
            Nothing yet. Create your first post, or let an agent do it over MCP.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {recent.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/content/${item.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                  <span className="text-xs text-[var(--color-muted)]">{item.contentType.name}</span>
                  <StatusBadge status={item.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <h2 className="text-sm font-semibold">Content types</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {types.map((type) => (
              <li key={type.id} className="flex items-center gap-2">
                <span aria-hidden>{type.icon ?? "•"}</span>
                <span>{type.name}</span>
                <code className="ml-auto rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-[var(--color-muted)]">
                  {type.slug}
                </code>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold">Connect your site</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {keyCount === 0
              ? "Create an API key to use the REST API, the React SDK or the MCP server."
              : `${keyCount} API key${keyCount === 1 ? "" : "s"} active.`}
          </p>
          <Link href="/settings" className="btn-secondary mt-3">
            Manage API keys
          </Link>
        </div>
      </section>
    </div>
  );
}
