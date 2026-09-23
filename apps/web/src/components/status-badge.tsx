const STYLES: Record<string, string> = {
  published: "bg-green-50 text-green-700",
  draft: "bg-neutral-100 text-neutral-600",
  scheduled: "bg-amber-50 text-amber-700",
  archived: "bg-neutral-100 text-neutral-400",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STYLES[status] ?? STYLES.draft}`}>{status}</span>;
}
