import Link from "next/link";
import { requireDashboardContext } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/content", label: "Content" },
  { href: "/media", label: "Media" },
  { href: "/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireDashboardContext();

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-line)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            Comlabs CMS
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-[var(--color-muted)] transition-colors hover:bg-neutral-100 hover:text-[var(--color-ink)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-[var(--color-muted)] sm:inline">
              {context.org.name}
              {context.role === "viewer" && " · view only"}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
