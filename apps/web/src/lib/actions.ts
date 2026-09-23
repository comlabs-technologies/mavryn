"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BUILT_IN_PRESETS,
  CmsError,
  generateIndexNowKey,
  slugify,
  uniqueSlug,
} from "@comlabs/cms-core";
import { generateApiKey } from "@comlabs/cms-core/server";
import { prisma, type Prisma } from "@comlabs/cms-db";
import {
  createContent,
  deleteContent,
  orgSettings,
  resolveContentType,
  updateContent,
  type ContentWriteInput,
} from "./content-service";
import { assertCanWrite, assertIsOwner, getSessionUser, requireDashboardContext } from "./session";

export interface ActionState {
  error?: string;
  /** Surfaced once after a successful write, e.g. a freshly minted API key. */
  notice?: string;
  secret?: string;
}

function message(error: unknown): string {
  if (error instanceof CmsError) {
    const details = Array.isArray(error.details)
      ? ` (${(error.details as { path: string; message: string }[])
          .map((d) => `${d.path}: ${d.message}`)
          .join("; ")})`
      : "";
    return `${error.message}${details}`;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export async function createOrganization(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const name = String(formData.get("name") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim();
  if (!name) return { error: "Give your organization a name." };

  let orgId: string;
  try {
    const existing = await prisma.organization.findMany({ select: { slug: true } });
    const slug = uniqueSlug(slugify(name), existing.map((o) => o.slug));

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        domain: domain || null,
        settings: { indexNowKey: generateIndexNowKey(), authorName: user.name ?? undefined },
        users: { create: { userId: user.id, role: "owner" } },
        // Every org starts with the built-in types, so the MCP server and the
        // dashboard have something to work with immediately.
        contentTypes: {
          create: BUILT_IN_PRESETS.map((preset) => ({
            name: preset.name,
            slug: preset.slug,
            builtIn: true,
            icon: preset.icon,
            schema: preset.schema as unknown as Prisma.InputJsonValue,
            seoTemplate: preset.seoTemplate as unknown as Prisma.InputJsonValue,
          })),
        },
      },
    });
    orgId = org.id;

    await prisma.user.update({ where: { id: user.id }, data: { activeOrgId: org.id } });
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath("/", "layout");
  redirect(`/dashboard?org=${orgId}`);
}

export async function switchOrganization(orgId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const membership = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId: user.id, orgId } },
  });
  if (!membership) throw new Error("You are not a member of that organization.");

  await prisma.user.update({ where: { id: user.id }, data: { activeOrgId: orgId } });
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/** Turn the editor's flat form payload into a ContentWriteInput. */
function readContentForm(formData: FormData): ContentWriteInput & { type: string } {
  const parseJson = <T,>(key: string, fallback: T): T => {
    const raw = formData.get(key);
    if (typeof raw !== "string" || !raw.trim()) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();

  return {
    type: String(formData.get("type") ?? ""),
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    status: (String(formData.get("status") ?? "draft") || "draft") as ContentWriteInput["status"],
    author: String(formData.get("author") ?? "") || null,
    scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    fields: parseJson<Record<string, unknown>>("fields", {}),
    faqs: parseJson<{ question: string; answer: string }[]>("faqs", []),
    metaTitle: String(formData.get("metaTitle") ?? ""),
    metaDescription: String(formData.get("metaDescription") ?? ""),
    excerpt: String(formData.get("excerpt") ?? ""),
    canonicalUrl: String(formData.get("canonicalUrl") ?? ""),
    ogImage: String(formData.get("ogImage") ?? ""),
  };
}

export async function saveContent(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireDashboardContext();

  let destination: string;
  try {
    assertCanWrite(context);
    const input = readContentForm(formData);
    const id = String(formData.get("id") ?? "");

    if (id) {
      const { content } = await updateContent(context.org, id, input);
      destination = `/content/${content.id}`;
    } else {
      const type = await resolveContentType(context.org.id, input.type);
      const { content } = await createContent(context.org, type, input);
      destination = `/content/${content.id}`;
    }
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath("/content");
  redirect(destination);
}

export async function setContentStatus(id: string, status: string): Promise<void> {
  const context = await requireDashboardContext();
  assertCanWrite(context);
  await updateContent(context.org, id, { status: status as ContentWriteInput["status"] });
  revalidatePath("/content");
  revalidatePath(`/content/${id}`);
}

export async function removeContent(id: string): Promise<void> {
  const context = await requireDashboardContext();
  assertCanWrite(context);
  await deleteContent(context.org.id, id);
  revalidatePath("/content");
  redirect("/content");
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateOrgSettings(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireDashboardContext();
  try {
    assertCanWrite(context);
    const current = orgSettings(context.org);

    await prisma.organization.update({
      where: { id: context.org.id },
      data: {
        name: String(formData.get("name") ?? "").trim() || context.org.name,
        domain: String(formData.get("domain") ?? "").trim() || null,
        settings: {
          ...current,
          authorName: String(formData.get("authorName") ?? "").trim() || undefined,
          logoUrl: String(formData.get("logoUrl") ?? "").trim() || undefined,
          indexNowKey: String(formData.get("indexNowKey") ?? "").trim() || undefined,
        },
      },
    });
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath("/settings");
  return { notice: "Settings saved." };
}

export async function createApiKeyAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireDashboardContext();
  try {
    assertIsOwner(context);
    const name = String(formData.get("name") ?? "").trim() || "Untitled key";
    const scopes = formData.getAll("scopes").map(String).filter(Boolean);
    if (scopes.length === 0) return { error: "Pick at least one scope." };

    const generated = generateApiKey();
    await prisma.apiKey.create({
      data: {
        orgId: context.org.id,
        name,
        keyHash: generated.keyHash,
        prefix: generated.prefix,
        scopes,
      },
    });

    revalidatePath("/settings");
    // The raw key is returned once and never stored, so the UI must show it now.
    return { notice: `Key "${name}" created. Copy it now — it is not shown again.`, secret: generated.key };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function revokeApiKey(id: string): Promise<void> {
  const context = await requireDashboardContext();
  assertIsOwner(context);
  await prisma.apiKey.deleteMany({ where: { id, orgId: context.org.id } });
  revalidatePath("/settings");
}
