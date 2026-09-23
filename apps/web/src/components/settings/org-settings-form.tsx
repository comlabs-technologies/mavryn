"use client";

import { useActionState } from "react";
import { updateOrgSettings, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

export function OrgSettingsForm({
  initial,
  readOnly,
}: {
  initial: { name: string; domain: string; authorName: string; logoUrl: string; indexNowKey: string };
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateOrgSettings, initialState);

  return (
    <form action={formAction} className="grid max-w-lg gap-4">
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input id="name" name="name" className="field" readOnly={readOnly} defaultValue={initial.name} />
      </div>

      <div>
        <label className="label" htmlFor="domain">Website</label>
        <input
          id="domain"
          name="domain"
          className="field"
          readOnly={readOnly}
          defaultValue={initial.domain}
          placeholder="https://acme.com"
        />
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">
          Canonical URLs, RSS links and internal-link detection are all derived from this.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="authorName">Default author</label>
        <input
          id="authorName"
          name="authorName"
          className="field"
          readOnly={readOnly}
          defaultValue={initial.authorName}
        />
      </div>

      <div>
        <label className="label" htmlFor="logoUrl">Logo URL</label>
        <input
          id="logoUrl"
          name="logoUrl"
          className="field"
          readOnly={readOnly}
          defaultValue={initial.logoUrl}
          placeholder="Used as the publisher logo in structured data"
        />
      </div>

      <div>
        <label className="label" htmlFor="indexNowKey">IndexNow key</label>
        <input
          id="indexNowKey"
          name="indexNowKey"
          className="field font-mono text-xs"
          readOnly={readOnly}
          defaultValue={initial.indexNowKey}
        />
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">
          Publishing pings IndexNow with this key. Host it at{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5">
            {initial.domain || "https://your-site"}/{initial.indexNowKey || "<key>"}.txt
          </code>{" "}
          for search engines to verify ownership. Clear it to disable pings.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.notice && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.notice}</p>
      )}

      {!readOnly && (
        <button type="submit" className="btn-primary w-fit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
      )}
    </form>
  );
}
