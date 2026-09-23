import { prisma } from "@comlabs/cms-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — liveness and readiness in one.
 *
 * Platform health checks (Render, Fly, Kubernetes) poll this to decide whether
 * an instance should receive traffic. It touches the database on purpose: an
 * instance that cannot reach Postgres cannot serve a single useful request, so
 * reporting it healthy would just route traffic into errors.
 *
 * Deliberately cheap — `SELECT 1`, no table access — because it runs often.
 */
export async function GET(): Promise<Response> {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", database: "reachable", latencyMs: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[health] database unreachable", error);
    return Response.json(
      {
        status: "error",
        database: "unreachable",
        // No error detail: this endpoint is unauthenticated and a driver
        // message can carry the host and credentials from the DSN.
        latencyMs: Date.now() - startedAt,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
