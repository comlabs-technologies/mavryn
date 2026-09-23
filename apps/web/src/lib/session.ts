import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, type Organization } from "@comlabs/cms-db";
import { auth } from "./auth";

export interface DashboardContext {
  userId: string;
  userName: string;
  userEmail: string;
  org: Organization;
  role: string;
}

/** The signed-in user, or null. Cached per request. */
export const getSessionUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

/**
 * Resolve the org the dashboard should operate on: the user's `activeOrgId`
 * when they are still a member of it, otherwise their first membership.
 * Returns null when the user belongs to no org yet (pre-onboarding).
 */
export const getDashboardContext = cache(async (): Promise<DashboardContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const memberships = await prisma.orgMembership.findMany({
    where: { userId: user.id },
    include: { org: true },
    orderBy: { id: "asc" },
  });
  if (memberships.length === 0) return null;

  const activeOrgId = (user as { activeOrgId?: string | null }).activeOrgId;
  const membership = memberships.find((m) => m.orgId === activeOrgId) ?? memberships[0]!;

  return {
    userId: user.id,
    userName: user.name ?? user.email,
    userEmail: user.email,
    org: membership.org,
    role: membership.role,
  };
});

/** Dashboard pages call this: bounces to sign-in or onboarding as needed. */
export async function requireDashboardContext(): Promise<DashboardContext> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const context = await getDashboardContext();
  if (!context) redirect("/onboarding");
  return context;
}

/** Throws when the member may not write. Viewers get read-only dashboards. */
export function assertCanWrite(context: DashboardContext): void {
  if (context.role === "viewer") {
    throw new Error("Your role on this organization is view-only.");
  }
}

export function assertIsOwner(context: DashboardContext): void {
  if (context.role !== "owner") {
    throw new Error("Only an organization owner can do this.");
  }
}
