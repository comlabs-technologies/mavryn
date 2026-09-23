"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { CmsClient, type CmsClientOptions } from "./client";

const CmsContext = createContext<CmsClient | null>(null);

/**
 * Wrap your app once. Components below read the client from context, so
 * individual pages never repeat the key or base URL.
 */
export function CmsProvider({
  apiKey,
  baseUrl,
  fetchOptions,
  children,
}: CmsClientOptions & { children: ReactNode }) {
  const client = useMemo(
    () => new CmsClient({ apiKey, baseUrl, fetchOptions }),
    [apiKey, baseUrl, fetchOptions],
  );

  return <CmsContext.Provider value={client}>{children}</CmsContext.Provider>;
}

export function useCmsClient(): CmsClient {
  const client = useContext(CmsContext);
  if (!client) {
    throw new Error("Wrap your app in <CmsProvider> before using Comlabs CMS components.");
  }
  return client;
}
