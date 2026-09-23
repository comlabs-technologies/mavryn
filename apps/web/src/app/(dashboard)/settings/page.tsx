import { prisma } from "@comlabs/cms-db";
import { ApiKeysPanel } from "@/components/settings/api-keys-panel";
import { IntegrationSnippets } from "@/components/settings/integration-snippets";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";
import { orgSettings } from "@/lib/content-service";
import { requireDashboardContext } from "@/lib/session";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await requireDashboardContext();
  const settings = orgSettings(context.org);

  const [keys, members] = await Promise.all([
    prisma.apiKey.findMany({
      where: { orgId: context.org.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.orgMembership.findMany({
      where: { orgId: context.org.id },
      include: { user: { select: { email: true, name: true } } },
      orderBy: { id: "asc" },
    }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="grid gap-8">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Organization</h2>
        <div className="mt-4">
          <OrgSettingsForm
            readOnly={context.role === "viewer"}
            initial={{
              name: context.org.name,
              domain: context.org.domain ?? "",
              authorName: settings.authorName ?? "",
              logoUrl: settings.logoUrl ?? "",
              indexNowKey: settings.indexNowKey ?? "",
            }}
          />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">API keys</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          One key authenticates the REST API, the React SDK and the MCP server. Keys are hashed —
          the full value is shown once, at creation.
        </p>
        <div className="mt-4">
          <ApiKeysPanel
            canManage={context.role === "owner"}
            keys={keys.map((key) => ({
              id: key.id,
              name: key.name,
              prefix: key.prefix,
              scopes: key.scopes,
              lastUsed: key.lastUsed?.toISOString() ?? null,
              createdAt: key.createdAt.toISOString(),
            }))}
          />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Connect your site</h2>
        <div className="mt-4">
          <IntegrationSnippets appUrl={appUrl} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Team</h2>
        <ul className="mt-4 divide-y divide-[var(--color-line)] text-sm">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="font-medium">{member.user.name ?? member.user.email}</p>
                <p className="text-xs text-[var(--color-muted)]">{member.user.email}</p>
              </div>
              <span className="badge bg-neutral-100 text-neutral-600">{member.role}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Invitations arrive in Phase 2. For now, members are added directly in the database.
        </p>
      </section>
    </div>
  );
}
