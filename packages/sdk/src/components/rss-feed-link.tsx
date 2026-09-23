"use client";

import { useCmsClient } from "../provider";

export interface RssFeedLinkProps {
  type?: string;
  title?: string;
}

/**
 * `<link rel="alternate">` pointing at the CMS-hosted feed.
 *
 * The URL carries the API key as a query parameter, so use a read-only key
 * here — it is visible in the page source by design, the same way a
 * publishable key is.
 */
export function RssFeedLink({ type = "blog", title = "RSS Feed" }: RssFeedLinkProps) {
  const client = useCmsClient();
  return <link rel="alternate" type="application/rss+xml" title={title} href={client.feedUrl(type)} />;
}
