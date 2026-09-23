"use client";

import { useActionState, useState, useTransition } from "react";
import { createApiKeyAction, revokeApiKey, type ActionState } from "@/lib/actions";

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsed: string | null;
  createdAt: string;
}

const SCOPES = [
  { value: "read", hint: "Read published content" },
  { value: "write", hint: "Create, update and publish" },
  { value: "admin", hint: "Everything, including delete" },
];

const initialState: ActionState = {};

export function ApiKeysPanel({ keys, canManage }: { keys: ApiKeySummary[]; canManage: boolean }) {
  const [state, formAction, pending] = useActionState(createApiKeyAction, initialState);
  const [revoking, startRevoke] = useTransition();
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid gap-5">
      {state.secret && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-900">{state.notice}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 font-mono text-xs">
              {state.secret}
            </code>
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(state.secret!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {keys.length > 0 && (
        <ul className="divide-y divide-[var(--color-line)] text-sm">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{key.name}</p>
                <p className="font-mono text-xs text-[var(--color-muted)]">{key.prefix}…</p>
              </div>
              <div className="flex gap-1">
                {key.scopes.map((scope) => (
                  <span key={scope} className="badge bg-neutral-100 text-neutral-600">{scope}</span>
                ))}
              </div>
              <span className="text-xs text-[var(--color-muted)]">
                {key.lastUsed ? `Used ${key.lastUsed.slice(0, 10)}` : "Never used"}
              </span>
              {canManage && (
                <button
                  type="button"
                  className="btn-danger"
                  disabled={revoking}
                  onClick={() => {
                    if (!window.confirm(`Revoke "${key.name}"? Anything using it stops working immediately.`)) {
                      return;
                    }
                    startRevoke(() => void revokeApiKey(key.id));
                  }}
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <form action={formAction} className="grid gap-3 rounded-lg border border-[var(--color-line)] p-4">
          <div>
            <label className="label" htmlFor="key-name">New key name</label>
            <input id="key-name" name="name" className="field" placeholder="Production website" />
          </div>

          <fieldset>
            <legend className="label">Scopes</legend>
            <div className="grid gap-1.5">
              {SCOPES.map((scope) => (
                <label key={scope.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="scopes"
                    value={scope.value}
                    defaultChecked={scope.value === "read"}
                    className="h-4 w-4 rounded border-[var(--color-line)]"
                  />
                  <span className="font-medium">{scope.value}</span>
                  <span className="text-xs text-[var(--color-muted)]">{scope.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {state.error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <button type="submit" className="btn-primary w-fit" disabled={pending}>
            {pending ? "Creating…" : "Create key"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-[var(--color-muted)]">Only an owner can create or revoke keys.</p>
      )}
    </div>
  );
}
