"use client";

import { useEffect, useState } from "react";
import { useCmsClient } from "./provider";
import type { CmsContent, CmsListQuery, CmsListResult } from "./types";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Fetch a list of content. Pass `null` to skip the request — that is how
 * components handed pre-fetched `items` avoid a redundant round trip.
 */
export function useContentList(query: CmsListQuery | null): AsyncState<CmsListResult> {
  const client = useCmsClient();
  const [state, setState] = useState<AsyncState<CmsListResult>>({
    data: null,
    loading: query !== null,
    error: null,
  });

  // Serialized so a fresh object literal each render does not refetch forever.
  const key = JSON.stringify(query);

  useEffect(() => {
    if (key === "null") {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));

    client
      .list(JSON.parse(key) as CmsListQuery)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });

    return () => {
      cancelled = true;
    };
  }, [client, key]);

  return state;
}

/**
 * Fetch one item. An empty `slug` is treated as "nothing to fetch", which is
 * how components that were handed pre-fetched content skip the request.
 */
export function useContent(slug: string, type?: string): AsyncState<CmsContent> {
  const client = useCmsClient();
  const [state, setState] = useState<AsyncState<CmsContent>>({
    data: null,
    loading: slug !== "",
    error: null,
  });

  useEffect(() => {
    if (!slug) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));

    client
      .get(slug, type)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });

    return () => {
      cancelled = true;
    };
  }, [client, slug, type]);

  return state;
}
