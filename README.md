# Comlabs CMS

A multi-tenant, AI-native content platform. Content lives here; your site reads
it over a REST API, a React SDK or a drop-in script, and your agents write to it
over MCP — all with the same API key.

It is the publishing layer of a WordPress or a Shopify, rebuilt around the way
content actually gets made now: a person in a rich-text editor and a model
calling tools, working on the same records, through the same validation.

```
Your website ──────►  REST API  ─┐
Claude / ChatGPT ──►  MCP        ├──►  Content Service  ──►  PostgreSQL
Dashboard ─────────►  Admin API ─┘          │
                                            ├─ SEO/AEO engine
                                            └─ Media store
```

## What you get

| | |
|---|---|
| **Multi-tenant** | Every row is scoped to an organization. Nothing is hard-coded to one brand — site name, domain, author and IndexNow key are per-org settings. |
| **Content types as data** | A content type declares its fields as JSON. That one definition drives the editor form, REST validation *and* the MCP tool schemas, so a custom type needs no code. |
| **MCP built in** | `/api/v1/mcp` generates CRUD tools per content type. Two types produce 14 tools. Tools are filtered by the calling key's scopes. |
| **SEO that fills itself in** | Meta title, description, excerpt and canonical are generated from the content when left blank, and never overwrite what an author typed. |
| **AEO** | FAQs are first-class and publish as schema.org `FAQPage`, alongside `BlogPosting`/`Article` and `BreadcrumbList`. |
| **Safe by default** | Body HTML is sanitized on save: scripts dropped, injected `noindex` stripped, external links marked `nofollow noopener`, internal links left alone. |
| **Self-hostable** | `docker compose up`. Or run it as SaaS. |

## Repository layout

```
apps/
  web/        Next.js — dashboard, REST API (/api/v1), MCP endpoint
packages/
  core/       Content-type engine + SEO/AEO engine. No framework, no database.
  db/         Prisma schema, migrations, seed
  sdk/        @comlabs/cms-sdk — React components and API client
docker/       Dockerfile + docker-compose for self-hosting
```

`packages/core` is deliberately dependency-light and pure: everything that
decides what a meta description or a canonical URL should be lives there, is
unit-tested in isolation, and is reused unchanged by the dashboard preview, the
REST API and the MCP tools. That is why the editor's search preview matches what
the server actually saves.

## Quick start (local)

Requires Node 20+, pnpm 10+, and PostgreSQL 14+.

```bash
pnpm install
cp .env.example .env            # set DATABASE_URL and BETTER_AUTH_SECRET
pnpm db:generate
pnpm db:migrate
pnpm db:seed                    # optional demo org; prints an API key once
pnpm dev
```

Open http://localhost:3000, create an account, and the onboarding step creates
your organization with Blog and Case Study content types ready to use.

Generate a secret with `openssl rand -base64 32`.

## Self-hosting with Docker

```bash
cd docker
cp .env.example .env            # set POSTGRES_PASSWORD and BETTER_AUTH_SECRET
docker compose up --build
```

Postgres comes up alongside the app, migrations run automatically on boot, and
uploads persist to a named volume. `APP_URL` must match the URL you actually
browse to — it is baked into the client bundle at build time.

## Using the API

Create a key in **Settings → API keys**. Scopes are cumulative: `admin` implies
`write`, `write` implies `read`. A `read` key only ever sees published content.

```bash
curl "https://cms.example.com/api/v1/content?type=blog&limit=10" \
  -H "Authorization: Bearer cm_live_..."
```

| Endpoint | Method | Scope | |
|---|---|---|---|
| `/api/v1/content` | GET | read | List. `type`, `tag`, `search`, `page`, `limit`, `sort` |
| `/api/v1/content` | POST | write | Create |
| `/api/v1/content/:idOrSlug` | GET | read | One item, by id or slug |
| `/api/v1/content/:id` | PATCH | write | Partial update |
| `/api/v1/content/:id` | DELETE | admin | Permanent |
| `/api/v1/types` | GET | read | Content types and their JSON Schema |
| `/api/v1/media` | GET/POST | read/write | Library; upload multipart or base64 |
| `/api/v1/media/from-url` | POST | write | Copy a remote image into the library |
| `/api/v1/feed.xml` | GET | read | RSS 2.0 |
| `/api/v1/sitemap-entries` | GET | read | Entries for your own sitemap |
| `/api/v1/schema/:slug` | GET | read | JSON-LD for one item |
| `/api/v1/mcp` | POST | read+ | Model Context Protocol |

Errors are `{ "error": { "code", "message", "details? } }` with a matching HTTP
status. Field validation failures come back as `400` with a `details` array of
`{ path, message }`.

## Connecting an agent

```json
{
  "mcpServers": {
    "comlabs-cms": {
      "type": "http",
      "url": "https://cms.example.com/api/v1/mcp",
      "headers": { "Authorization": "Bearer cm_live_..." }
    }
  }
}
```

The server is stateless Streamable HTTP: the key identifies the organization and
the tool list is rebuilt from its content types on every call, so adding a
content type in the dashboard immediately adds working tools.

## Connecting a site

```bash
npm install @comlabs/cms-sdk
```

```tsx
import { CmsProvider, BlogList, BlogPost, FaqAccordion } from "@comlabs/cms-sdk";
import "@comlabs/cms-sdk/styles.css";   // optional

// app/layout.tsx
<CmsProvider apiKey={process.env.NEXT_PUBLIC_CMS_KEY!} baseUrl="https://cms.example.com/api/v1">
  {children}
</CmsProvider>

// app/blog/page.tsx
<BlogList type="blog" design="magazine" />

// app/blog/[slug]/page.tsx
<BlogPost slug={params.slug} />
<FaqAccordion slug={params.slug} />
```

Use a **read-only** key in the browser. For server rendering, use `CmsClient`
directly and pass the result in — the components accept pre-fetched data and
skip the client request:

```tsx
import { CmsClient, metadataFromContent } from "@comlabs/cms-sdk";

const client = new CmsClient({ apiKey: process.env.CMS_KEY!, baseUrl });

export async function generateMetadata({ params }) {
  return metadataFromContent(await client.get(params.slug, "blog"));
}
```

## Content types

A type's schema is JSON:

```json
{
  "fields": [
    { "key": "content", "type": "richtext", "label": "Body", "required": true },
    { "key": "coverImage", "type": "media", "label": "Cover Image" },
    { "key": "tags", "type": "tags", "label": "Tags" },
    { "key": "sections", "type": "array", "label": "Sections", "itemSchema": {
      "title": { "type": "string", "required": true },
      "paragraphs": { "type": "array", "itemType": "string" }
    }}
  ]
}
```

Field types: `string`, `richtext`, `markdown`, `number`, `boolean`, `date`,
`media`, `tags`, `select`, `object`, `array`, `json`.

A type's `seoTemplate` tells the SEO engine which field is the body, which is
the image, and what the URL looks like on your site — which is how auto-SEO
stays content-type agnostic.

## Development

```bash
pnpm typecheck     # every package
pnpm test          # core + sdk unit tests
pnpm build         # all packages and the app
pnpm db:studio     # browse the database
```

## Status

MVP (Phase 1) is complete: orgs and onboarding, the blog type, the Tiptap
editor, auto-SEO, the FAQ builder, REST, MCP, the React SDK, RSS and Docker.

Phase 2: custom content types in the dashboard UI, webhooks with retry and a
delivery log, embeddable vanilla-JS widgets, more design presets, team
invitations, and the AI-assisted AEO features (FAQ suggestions, entity
extraction, content scoring).
