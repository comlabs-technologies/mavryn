#!/bin/sh
# Apply pending migrations, then hand off to the server.
#
# Safe to run on every boot: `migrate deploy` only applies migrations that have
# not run yet, and it never generates or resets anything.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Comlabs CMS requires PostgreSQL." >&2
  exit 1
fi

if [ -z "$BETTER_AUTH_SECRET" ]; then
  echo "BETTER_AUTH_SECRET is not set. Generate one with: openssl rand -base64 32" >&2
  exit 1
fi

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "Applying database migrations…"
  cd /app/migrator
  ./node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma
  cd /app
fi

exec "$@"
