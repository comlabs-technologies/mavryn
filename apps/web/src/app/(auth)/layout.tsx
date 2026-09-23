export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-lg font-semibold tracking-tight">Comlabs CMS</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Content for your site, your API and your agents.
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
