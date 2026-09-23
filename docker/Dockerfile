# syntax=docker/dockerfile:1.7
#
# Self-hosted Comlabs CMS.
#
# Build from the repository root:
#     docker build -f docker/Dockerfile -t comlabs-cms .
#
# Or use docker/docker-compose.yml, which also brings up PostgreSQL.

# --- deps: install once, cached on the lockfile ------------------------------
FROM node:22-bookworm-slim AS deps
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/sdk/package.json ./packages/sdk/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# --- build: generate the Prisma client, then compile Next --------------------
FROM node:22-bookworm-slim AS builder
RUN corepack enable
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=1

# Prisma needs a syntactically valid URL to generate; it never connects here.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter @comlabs/cms-db generate

# NEXT_PUBLIC_* values are inlined at build time. Override with a build arg
# when the deployment is not served from localhost.
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV BETTER_AUTH_SECRET="build-time-placeholder-not-used-at-runtime"

RUN pnpm --filter @comlabs/cms-web build

# --- runner: minimal image, non-root -----------------------------------------
# Debian rather than Alpine: Prisma's query engine is built against glibc and
# OpenSSL 3, which is the combination its default `native` binary target
# resolves to here, and the one Prisma documents for production.
FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV MEDIA_PROVIDER=local
ENV LOCAL_MEDIA_DIR=/app/.media

RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m -s /usr/sbin/nologin nextjs

# Standalone output carries its own trimmed node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Migrations plus a standalone Prisma CLI, so the container can migrate on boot.
# Installed directly rather than copied from the builder: pnpm's node_modules is
# a tree of symlinks into a store this stage does not have.
ARG PRISMA_VERSION=6.19.3
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/prisma ./migrator/prisma
RUN cd /app/migrator && \
    npm install --no-save --no-audit --no-fund prisma@${PRISMA_VERSION} && \
    chown -R nextjs:nodejs /app/migrator

COPY --chown=nextjs:nodejs docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && \
    mkdir -p /app/.media && chown -R nextjs:nodejs /app/.media

USER nextjs
EXPOSE 3000
VOLUME ["/app/.media"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/sign-in').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "apps/web/server.js"]
