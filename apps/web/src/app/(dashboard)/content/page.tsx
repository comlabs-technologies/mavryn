import Link from "next/link";
import { prisma } from "@comlabs/cms-db";
import { listContent, type ContentStatus } from "@/lib/content-service";
import { requireDashboardContext } from "@/lib/session";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Content" };
export const dynamic = "force-dynamic";

type Search = Promise<{ type?: string; status?: string; search?: string; page?: string }>;

export default async function ContentListPage({ searchParams }: { searchParams: Search }) {
  const { org } = await requireDashboardContext();
  const params = await searchParams;

  const types = await prisma.contentType.findMany({
    where: { orgId: org.id },
    orderBy: [{ builtIn: "desc" }, { name: "asc" }],
  });

  const result = await listContent({
    orgId: org.id,
    typeSlug: params.type || undefined,
    status: (params.status as ContentStatus | undefined) ?? "any",
    search: params.search || undefined,
    page: Number(params.page ?? 1),
    limit: 25,
  });

  const queryFor = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...overrides, page: undefined })) {
      if (value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/content?${query}` : "/content";
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Content</h1>
        <div className="flex gap-2">
          {types.map((type) => (
            <Link key={type.id} href={`/content/new?type=${type.slug}`} className="btn-secondary">
              New {type.name.toLowerCase()}
            </Link>
          ))}
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-3" action="/content">
        <div className="min-w-[12rem] flex-1">
          <label className="label" htmlFor="search">Search</label>
          <input
            id="search"
            name="search"
            defaultValue={params.search ?? ""}
            className="field"
            placeholder="Title, slug or excerpt"
          />
        </div>
        <div>
          <label className="label" htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue={params.type ?? ""} className="field">
            <option value="">All</option>
            {types.map((type) => (
              <option key={type.id} value={type.slug}>{type.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={params.status ?? ""} className="field">
            <option value="">All</option>
            {["draft", "published", "scheduled", "archived"].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">Filter</button>
        {(params.search || params.type || params.status) && (
          <Link href="/content" className="self-center text-sm text-[var(--color-muted)] hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="card overflow-hidden">
        {result.items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-[var(--color-muted)]">
            No content matches these filters.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {result.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/content/${item.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-[var(--color-muted)]">
                      /{item.contentType.slug}/{item.slug}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--color-muted)]">
                    {(item.publishedAt ?? item.updatedAt).toISOString().slice(0, 10)}
                  </span>
                  <StatusBadge status={item.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {result.total > result.limit && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-muted)]">
            Page {result.page} · {result.total} items
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link href={`${queryFor({})}${queryFor({}).includes("?") ? "&" : "?"}page=${result.page - 1}`} className="btn-secondary">
                Previous
              </Link>
            )}
            {result.hasMore && (
              <Link href={`${queryFor({})}${queryFor({}).includes("?") ? "&" : "?"}page=${result.page + 1}`} className="btn-secondary">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
