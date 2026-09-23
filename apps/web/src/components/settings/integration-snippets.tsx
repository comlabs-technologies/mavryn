"use client";

import { useState } from "react";

const TABS = ["React SDK", "REST", "MCP", "RSS"] as const;
type Tab = (typeof TABS)[number];

export function IntegrationSnippets({ appUrl }: { appUrl: string }) {
  const [tab, setTab] = useState<Tab>("React SDK");
  const base = `${appUrl.replace(/\/$/, "")}/api/v1`;

  const snippets: Record<Tab, { language: string; code: string; note: string }> = {
    "React SDK": {
      language: "tsx",
      note: "Install with `npm i @comlabs/cms-sdk`, then wrap your app once.",
      code: `import { CmsProvider, BlogList, BlogPost, FaqAccordion } from "@comlabs/cms-sdk";

// app/layout.tsx
<CmsProvider apiKey={process.env.NEXT_PUBLIC_CMS_KEY!} baseUrl="${base}">
  {children}
</CmsProvider>

// app/blog/page.tsx
<BlogList type="blog" design="minimal" />

// app/blog/[slug]/page.tsx
<BlogPost slug={params.slug} />
<FaqAccordion slug={params.slug} />`,
    },
    REST: {
      language: "bash",
      note: "Any language, any framework. Read keys only ever see published content.",
      code: `curl "${base}/content?type=blog&limit=10" \\
  -H "Authorization: Bearer cm_live_..."

curl "${base}/content/when-ai-agents-get-stuck-in-loops?type=blog" \\
  -H "Authorization: Bearer cm_live_..."

curl -X POST "${base}/content" \\
  -H "Authorization: Bearer cm_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"type":"blog","title":"Hello","fields":{"content":"<p>Hi</p>"}}'`,
    },
    MCP: {
      language: "json",
      note: "Tools are generated from your content types, so a new type means new tools.",
      code: `{
  "mcpServers": {
    "comlabs-cms": {
      "type": "http",
      "url": "${base}/mcp",
      "headers": { "Authorization": "Bearer cm_live_..." }
    }
  }
}`,
    },
    RSS: {
      language: "html",
      note: "Link it from your site's <head> so readers and crawlers find the feed.",
      code: `<link rel="alternate" type="application/rss+xml"
      title="Blog"
      href="${base}/feed.xml?type=blog&api_key=cm_live_..." />`,
    },
  };

  const active = snippets[tab];

  return (
    <div>
      <div className="flex gap-1 border-b border-[var(--color-line)]">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === name
                ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-[var(--color-muted)]">{active.note}</p>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-neutral-900 p-4 text-xs leading-relaxed text-neutral-100">
        <code>{active.code}</code>
      </pre>
    </div>
  );
}
