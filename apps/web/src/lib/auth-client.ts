"use client";

import { createAuthClient } from "better-auth/react";

/**
 * The auth API is served by this same app, so the browser can simply talk to
 * the origin it was loaded from. Deriving it at runtime rather than reading
 * NEXT_PUBLIC_APP_URL keeps the URL out of the build: the same image can be
 * deployed to a preview URL, a Render subdomain and a custom domain without
 * rebuilding.
 */
function resolveBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export const authClient = createAuthClient({ baseURL: resolveBaseUrl() });

export const { signIn, signUp, signOut, useSession } = authClient;
